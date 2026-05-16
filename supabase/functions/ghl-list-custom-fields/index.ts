// Probes GHL custom fields to find call disposition + other config.
// Admin-gated, JWT-verified. Used once during setup to discover what
// disposition field names and values your GHL location actually has.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const { data: settings } = await admin
      .from("app_settings")
      .select("key, value")
      .in("key", ["GHL_API_KEY", "GHL_LOCATION_ID"]);
    const settingMap: Record<string, string> = {};
    (settings ?? []).forEach((s: any) => { settingMap[s.key] = s.value; });

    const apiKey = settingMap.GHL_API_KEY || Deno.env.get("GHL_API_KEY");
    const locationId = settingMap.GHL_LOCATION_ID || Deno.env.get("GHL_LOCATION_ID");

    if (!apiKey || !locationId) {
      return json({ error: "GHL not configured" }, 400);
    }

    // Pull custom fields for the location
    const res = await fetch(`https://services.leadconnectorhq.com/locations/${encodeURIComponent(locationId)}/customFields`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: "2021-07-28",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const txt = await res.text();
      return json({ error: `GHL ${res.status}`, detail: txt.slice(0, 300) }, res.status);
    }

    const data = await res.json();
    const fields = data.customFields || data.fields || [];

    // Surface fields that look like they could be dispositions
    const dispositionCandidates = fields.filter((f: any) => {
      const key = (f.fieldKey || f.name || "").toLowerCase();
      return (
        key.includes("disposition") ||
        key.includes("call_status") ||
        key.includes("call status") ||
        key.includes("outcome") ||
        key.includes("result")
      );
    });

    return json({
      total: fields.length,
      disposition_candidates: dispositionCandidates.map((f: any) => ({
        id: f.id,
        name: f.name,
        fieldKey: f.fieldKey,
        dataType: f.dataType,
        options: f.picklistOptions || f.options || null,
      })),
      all: fields.map((f: any) => ({
        name: f.name,
        fieldKey: f.fieldKey,
        dataType: f.dataType,
      })),
    });
  } catch (e: any) {
    console.error("ghl-list-custom-fields error", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
