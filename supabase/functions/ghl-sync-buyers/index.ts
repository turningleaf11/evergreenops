// ghl-sync-buyers — pulls buyer contacts from GoHighLevel into dispo_buyers.
//
// Unlike the standalone dispo app (which kept buy-box app-local), OpsHQ treats
// GHL as the source of truth for buy-box: this syncs BOTH contact info AND the
// buy-box / area-of-interest custom fields into dispo_buyers on every run.
//
// Buyers are identified by a GHL tag (app_settings.GHL_BUYER_TAG). Buy-box
// custom fields are matched by GHL fieldKey (stable) and resolved to their
// field IDs at runtime, so no brittle IDs are hardcoded.
//
// Auth: JWT + admin, matching the other OpsHQ GHL functions.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// GHL fieldKey → how it maps into dispo_buyers. Keys are the merge-field keys
// Autumn confirmed in the GHL location.
const FIELD_KEYS = {
  states: "contact.state_buyers",
  strategies: "contact.buyer_strategy",
  city1: "contact.city_2",
  city2: "contact.city_3",
  countyMetro: "contact.county_or_metro",
  criteria: "contact.criteria",
  maxPrice: "contact.max_purchase_price",
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ── Auth: signed-in admin only ─────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const { data: roleRow } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Admin only" }, 403);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // ── Config ─────────────────────────────────────────────────────────────
    const { data: settings } = await admin
      .from("app_settings")
      .select("key, value")
      .in("key", ["GHL_API_KEY", "GHL_LOCATION_ID", "GHL_BUYER_TAG"]);
    const cfg: Record<string, string> = {};
    (settings ?? []).forEach((s: any) => { cfg[s.key] = s.value; });

    const apiKey = cfg.GHL_API_KEY || Deno.env.get("GHL_API_KEY");
    const locationId = cfg.GHL_LOCATION_ID || Deno.env.get("GHL_LOCATION_ID");
    if (!apiKey || !locationId) return json({ error: "GHL not configured (GHL_API_KEY / GHL_LOCATION_ID)" }, 400);

    // Allow an override tag in the body; otherwise use the configured buyer tag.
    let tag = cfg.GHL_BUYER_TAG || "";
    try {
      const body = await req.json();
      if (typeof body?.tag === "string") tag = body.tag;
    } catch { /* no body */ }
    if (!tag) {
      return json({ error: "No buyer tag. Set app_settings.GHL_BUYER_TAG (or pass { tag } in the body)." }, 400);
    }

    const ghl = (path: string) =>
      fetch(`https://services.leadconnectorhq.com${path}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Version: "2021-07-28", Accept: "application/json" },
      });

    // ── Resolve buy-box fieldKeys → field IDs (once) ───────────────────────
    const cfRes = await ghl(`/locations/${encodeURIComponent(locationId)}/customFields`);
    if (!cfRes.ok) return json({ error: `GHL customFields ${cfRes.status}`, detail: (await cfRes.text()).slice(0, 300) }, 502);
    const cfData = await cfRes.json();
    const allFields = (cfData.customFields || cfData.fields || []) as any[];
    const idFor: Record<string, string> = {};
    for (const [alias, fieldKey] of Object.entries(FIELD_KEYS)) {
      const f = allFields.find((x) => (x.fieldKey || "").toLowerCase() === fieldKey.toLowerCase());
      if (f?.id) idFor[alias] = f.id;
    }

    // Read one custom field value off a contact by our alias.
    const cfValue = (contact: any, alias: keyof typeof FIELD_KEYS): string | null => {
      const id = idFor[alias];
      if (!id) return null;
      const list = (contact.customFields || contact.customField || []) as any[];
      const hit = list.find((c) => c.id === id);
      const v = hit?.value ?? hit?.fieldValue ?? hit?.field_value ?? null;
      return v == null || v === "" ? null : String(v);
    };

    // ── Page through tagged contacts, upsert into dispo_buyers ─────────────
    let synced = 0;
    let scanned = 0;
    let startAfterId = "";
    let startAfter = "";

    for (let page = 0; page < 200; page++) {
      const params = new URLSearchParams({ locationId, limit: "100" });
      if (startAfterId) { params.set("startAfterId", startAfterId); params.set("startAfter", startAfter); }

      const res = await ghl(`/contacts/?${params.toString()}`);
      if (!res.ok) return json({ error: `GHL contacts ${res.status}`, detail: (await res.text()).slice(0, 300) }, 502);
      const body = await res.json();
      const contacts = (body.contacts as any[]) || [];
      if (contacts.length === 0) break;
      scanned += contacts.length;

      const rows = contacts
        .filter((c) => {
          const tags = (c.tags as string[]) || [];
          return tags.some((t) => String(t).toLowerCase() === tag.toLowerCase());
        })
        .map((c) => {
          const markets = uniq([
            ...toArray(cfValue(c, "city1")),
            ...toArray(cfValue(c, "city2")),
            ...toArray(cfValue(c, "countyMetro")),
          ]);
          return {
            ghl_contact_id: c.id as string,
            first_name: (c.firstName as string) || "",
            last_name: (c.lastName as string) || "",
            email: (c.email as string) || null,
            phone: (c.phone as string) || null,
            company: (c.companyName as string) || null,
            source: "ghl_sync",
            // buy-box (GHL is source of truth → overwrite on every sync)
            states: toArray(cfValue(c, "states")),
            strategies: toArray(cfValue(c, "strategies")),
            markets,
            max_price: toNumber(cfValue(c, "maxPrice")),
            buy_box_notes: cfValue(c, "criteria"),
            updated_at: new Date().toISOString(),
          };
        });

      if (rows.length > 0) {
        const { error } = await admin.from("dispo_buyers").upsert(rows, { onConflict: "ghl_contact_id" });
        if (error) throw new Error(`Upsert failed: ${error.message}`);
        synced += rows.length;
      }

      const meta = (body.meta as any) || {};
      if (!meta.startAfterId || contacts.length < 100) break;
      startAfterId = String(meta.startAfterId);
      startAfter = String(meta.startAfter ?? "");
    }

    return json({ synced, scanned, tag, resolvedFields: Object.keys(idFor) });
  } catch (e: any) {
    console.error("ghl-sync-buyers error", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

// Split a GHL text/multi-select value into a clean string array.
function toArray(v: string | null): string[] {
  if (!v) return [];
  return v
    .split(/[,;\n|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function toNumber(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return isNaN(n) || n === 0 ? null : n;
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
