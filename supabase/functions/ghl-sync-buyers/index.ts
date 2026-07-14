// ghl-sync-buyers -- pulls buyer contacts from GoHighLevel into dispo_buyers,
// normalizing GHL's free-text buy-box into OpsHQ's controlled vocabulary.
//
// GHL is the capture layer (its AI can only write text fields, so values are
// messy). OpsHQ is the clean system of record: this canonicalizes states,
// strategies, and property types on the way in, so filtering + buyer<->deal
// matching actually join. Unmapped values are kept (title-cased) so outliers
// stay visible instead of silently polluting the vocabulary.
//
// Auth: JWT + admin, matching the other OpsHQ GHL functions.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// GHL fieldKey -> alias. Strategy is read from BOTH exit_strategy (where the AI
// writes) and buyer_strategy (legacy multi-select) and merged.
const FIELD_KEYS = {
  states: "contact.state_buyers",
  exitStrategy: "contact.exit_strategy",
  strategyMulti: "contact.buyer_strategy",
  city1: "contact.city_2",
  city2: "contact.city_3",
  countyMetro: "contact.county_or_metro",
  criteria: "contact.criteria",
  maxPrice: "contact.max_purchase_price",
  // No structured buyer property-type field in GHL (Deal Type retired) — buyer
  // property_types stays unmapped; the Type dimension only fires if it's set here.
} as const;

// -- Controlled vocabularies ------------------------------------------------

const STATE_PAIRS: [string, string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"],
  ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
  ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
  ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"],
  ["WI", "Wisconsin"], ["WY", "Wyoming"], ["DC", "District of Columbia"],
];
const STATE_MAP: Record<string, string> = {};
for (const [abbr, name] of STATE_PAIRS) {
  STATE_MAP[abbr.toLowerCase()] = name;
  STATE_MAP[name.toLowerCase()] = name;
}
for (const k of ["nationwide", "national", "nation wide", "usa", "us", "any", "anywhere", "all states", "all"]) {
  STATE_MAP[k] = "Nationwide";
}

// canonical -> alias list (aliases matched lowercased)
const STRATEGY_CANON: [string, string[]][] = [
  ["Fix & Flip", ["fix & flip", "fix and flip", "flip", "fix/flip", "f&f", "fix flip"]],
  ["Buy & Hold", ["buy & hold", "buy and hold", "hold", "rental", "rentals", "buy/hold", "long term rental", "ltr", "buy hold"]],
  ["BRRRR", ["brrrr", "brrr"]],
  ["Wholesale", ["wholesale", "wholesaling", "wholetail"]],
  ["Short-Term Rental", ["short-term rental", "short term rental", "str", "airbnb", "vacation rental"]],
  ["New Construction", ["new construction", "new build", "construction", "development", "build"]],
  ["Commercial", ["commercial", "cre"]],
  ["Multifamily", ["multifamily", "multi-family", "multi family", "mf", "apartments"]],
  ["Wrap", ["wrap", "wraparound", "wrap around", "wrap-around"]],
  ["Co-Living", ["co-living", "coliving", "co living"]],
  ["Group Home", ["group home", "group homes", "sober living", "assisted living"]],
];

const PROPTYPE_CANON: [string, string[]][] = [
  ["Single Family Residence", ["single family residence", "single family", "single-family", "single family home", "sfr", "sfh", "sf"]],
  ["Multifamily 2-4 Units", ["multifamily 2-4 units", "multifamily 2-4", "2-4 units", "2-4", "duplex", "triplex", "fourplex", "quadplex", "mf 2-4"]],
  ["Multifamily 5+", ["multifamily 5+", "multifamily 5plus", "5+ units", "5+", "apartment", "apartments", "mf 5+", "large multifamily"]],
  ["Townhouse", ["townhouse", "townhome", "town house"]],
  ["Condo", ["condo", "condominium", "condos"]],
  ["Mobile Home", ["mobile home", "manufactured home", "manufactured", "mobile"]],
  ["Mobile Home Park", ["mobile home park", "mhp", "mh park"]],
  ["RV Park", ["rv park", "rv", "rv parks"]],
  ["Land", ["land", "lot", "lots", "vacant land", "raw land"]],
  ["Commercial", ["commercial", "cre", "office", "retail", "industrial"]],
  ["Portfolio", ["portfolio", "package", "bulk"]],
];

function buildAliasMap(canon: [string, string[]][]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const [c, aliases] of canon) {
    m[c.toLowerCase()] = c;
    for (const a of aliases) m[a] = c;
  }
  return m;
}
const STRATEGY_MAP = buildAliasMap(STRATEGY_CANON);
const PROPTYPE_MAP = buildAliasMap(PROPTYPE_CANON);

function titleCase(s: string): string {
  return s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
const normState = (v: string) => STATE_MAP[v.trim().toLowerCase()] ?? titleCase(v.trim());
const normStrategy = (v: string) => STRATEGY_MAP[v.trim().toLowerCase()] ?? (v.trim() ? titleCase(v.trim()) : "");
const normPropType = (v: string) => PROPTYPE_MAP[v.trim().toLowerCase()] ?? (v.trim() ? titleCase(v.trim()) : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // -- Auth: signed-in admin only -----------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const { data: roleRow } = await userClient
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Admin only" }, 403);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // -- Config -------------------------------------------------------------
    const { data: settings } = await admin
      .from("app_settings").select("key, value").in("key", ["GHL_API_KEY", "GHL_LOCATION_ID", "GHL_BUYER_TAG"]);
    const cfg: Record<string, string> = {};
    (settings ?? []).forEach((s: any) => { cfg[s.key] = s.value; });

    const apiKey = cfg.GHL_API_KEY || Deno.env.get("GHL_API_KEY");
    const locationId = cfg.GHL_LOCATION_ID || Deno.env.get("GHL_LOCATION_ID");
    if (!apiKey || !locationId) return json({ error: "GHL not configured (GHL_API_KEY / GHL_LOCATION_ID)" }, 400);

    let tagStr = cfg.GHL_BUYER_TAG || "";
    try {
      const body = await req.json();
      if (typeof body?.tag === "string") tagStr = body.tag;
    } catch { /* no body */ }
    const tags = tagStr.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (tags.length === 0) return json({ error: "No buyer tag. Set app_settings.GHL_BUYER_TAG (comma-separated for multiple)." }, 400);

    const ghl = (path: string) =>
      fetch(`https://services.leadconnectorhq.com${path}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Version: "2021-07-28", Accept: "application/json" },
      });

    // -- Resolve buy-box fieldKeys -> field IDs (once) -----------------------
    const cfRes = await ghl(`/locations/${encodeURIComponent(locationId)}/customFields`);
    if (!cfRes.ok) return json({ error: `GHL customFields ${cfRes.status}`, detail: (await cfRes.text()).slice(0, 300) }, 502);
    const cfData = await cfRes.json();
    const allFields = (cfData.customFields || cfData.fields || []) as any[];
    const idFor: Record<string, string> = {};
    for (const [alias, fieldKey] of Object.entries(FIELD_KEYS)) {
      const f = allFields.find((x) => (x.fieldKey || "").toLowerCase() === fieldKey.toLowerCase());
      if (f?.id) idFor[alias] = f.id;
    }

    const cfValue = (contact: any, alias: keyof typeof FIELD_KEYS): string | null => {
      const id = idFor[alias];
      if (!id) return null;
      const list = (contact.customFields || contact.customField || []) as any[];
      const hit = list.find((c) => c.id === id);
      const v = hit?.value ?? hit?.fieldValue ?? hit?.field_value ?? null;
      return v == null || v === "" ? null : (Array.isArray(v) ? v.join(", ") : String(v));
    };

    // -- Page through ALL contacts, upsert the tagged ones into dispo_buyers --
    let synced = 0, scanned = 0;
    let total: number | null = null;
    let startAfterId = "", startAfter = "";

    for (let page = 0; page < 500; page++) {
      const params = new URLSearchParams({ locationId, limit: "100" });
      if (startAfterId) { params.set("startAfterId", startAfterId); params.set("startAfter", startAfter); }

      const res = await ghl(`/contacts/?${params.toString()}`);
      if (!res.ok) return json({ error: `GHL contacts ${res.status}`, detail: (await res.text()).slice(0, 300) }, 502);
      const body = await res.json();
      const contacts = (body.contacts as any[]) || [];
      const meta = (body.meta as any) || {};
      if (page === 0 && typeof meta.total === "number") total = meta.total;
      if (contacts.length === 0) break;
      scanned += contacts.length;

      const rows = contacts
        .filter((c) => {
          const ctags = ((c.tags as string[]) || []).map((t) => String(t).toLowerCase());
          return ctags.some((t) => tags.includes(t));
        })
        .map((c) => ({
          ghl_contact_id: c.id as string,
          first_name: (c.firstName as string) || "",
          last_name: (c.lastName as string) || "",
          email: (c.email as string) || null,
          phone: (c.phone as string) || null,
          company: (c.companyName as string) || null,
          source: "ghl_sync",
          // buy-box, normalized to OpsHQ's controlled vocabulary
          states: dedupe(splitVals(cfValue(c, "states")).map(normState)),
          strategies: dedupe([...splitVals(cfValue(c, "exitStrategy")), ...splitVals(cfValue(c, "strategyMulti"))].map(normStrategy)),
          markets: dedupe([...splitVals(cfValue(c, "city1")), ...splitVals(cfValue(c, "city2"))].map((s) => titleCase(s))),
          county_metro: dedupe(splitVals(cfValue(c, "countyMetro")).map((s) => titleCase(s))),
          max_price: toNumber(cfValue(c, "maxPrice")),
          buy_box_notes: cfValue(c, "criteria"),
          updated_at: new Date().toISOString(),
        }));

      if (rows.length > 0) {
        const { error } = await admin.from("dispo_buyers").upsert(rows, { onConflict: "ghl_contact_id" });
        if (error) throw new Error(`Upsert failed: ${error.message}`);
        synced += rows.length;
      }

      const nextId = meta.startAfterId ? String(meta.startAfterId) : "";
      const nextAfter = meta.startAfter != null ? String(meta.startAfter) : "";
      if (!nextId || (nextId === startAfterId && nextAfter === startAfter)) break;
      startAfterId = nextId;
      startAfter = nextAfter;
    }

    return json({ synced, scanned, total, tags, resolvedFields: Object.keys(idFor) });
  } catch (e: any) {
    console.error("ghl-sync-buyers error", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

// Split a GHL value into clean tokens. Handles plain text, delimited text, and
// JSON-array strings (multi-select fields sometimes arrive as '["A","B"]').
function splitVals(v: string | null): string[] {
  if (!v) return [];
  const s = v.trim();
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map((x) => String(x).trim()).filter(Boolean);
    } catch { /* fall through */ }
  }
  return s.split(/[,;\n|]+/).map((x) => x.trim()).filter(Boolean);
}

function toNumber(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return isNaN(n) || n === 0 ? null : n;
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
