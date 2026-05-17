// Returns the list of GHL users in the configured location.
// Used by the Orbit member detail drawer to let admins link an EvergreenOps
// user to their GHL user account.
//
// Tries app_settings first (admin-configurable) then falls back to Supabase env vars.

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
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    // Admin gate
    const { data: roleRow } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Admin only" }, 403);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Pull GHL credentials: app_settings first, then env fallback
    const { data: settings } = await admin
      .from("app_settings")
      .select("key, value")
      .in("key", ["GHL_API_KEY", "GHL_LOCATION_ID"]);
    const settingMap: Record<string, string> = {};
    (settings ?? []).forEach((s: any) => { settingMap[s.key] = s.value; });

    const apiKey = settingMap.GHL_API_KEY || Deno.env.get("GHL_API_KEY");
    const locationId = settingMap.GHL_LOCATION_ID || Deno.env.get("GHL_LOCATION_ID");

    if (!apiKey || !locationId) {
      return json({ error: "GHL not configured", users: [] }, 400);
    }

    // v2 API accepts either an OAuth JWT (long) or a Private Integration Token (prefixed "pit-", often ~40 chars).
    // Only reject if it's clearly a legacy v1 key (short, no "pit-" prefix).
    if (!apiKey.startsWith("pit-") && apiKey.length < 100) {
      return json({
        error: "GHL API key looks like a v1 (legacy) key. The v2 endpoints used here need a Private Integration Token (starts with 'pit-'). In GHL go to Settings → Private Integrations → create a token with users.readonly + opportunities.readonly + calendars/events.readonly scopes, then paste it into Settings → Credentials as GHL_API_KEY.",
        users: [],
      }, 400);
    }

    const res = await fetch(`https://services.leadconnectorhq.com/users/?locationId=${encodeURIComponent(locationId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: "2021-07-28",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("GHL users fetch failed", res.status, txt.slice(0, 500));
      let hint = "";
      if (res.status === 401) {
        hint = " — your Private Integration Token is missing the 'View Users' (users.readonly) scope. In GHL: Settings → Private Integrations → edit the token → add the 'View Users' scope (and 'View Opportunities' + 'View Calendar Events' for the rest of Orbit sync). Save, then try again.";
      } else if (res.status === 403) {
        hint = " — the token is valid but not authorized for this location. Confirm GHL_LOCATION_ID matches the location the token was created in.";
      } else if (res.status === 404) {
        hint = " — endpoint not found, GHL_LOCATION_ID may be wrong.";
      }
      return json({
        error: `GHL API ${res.status}${hint}`,
        detail: txt.slice(0, 400),
        users: [],
      }, 200); // Return 200 so supabase.functions.invoke gives us the body
    }

    const data = await res.json();
    const rawUsers = data.users || data.data || [];
    const users = rawUsers.map((u: any) => ({
      id: u.id || u.userId || u._id,
      name: u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unnamed",
      email: u.email || null,
      role: u.role || u.type || null,
    })).filter((u: any) => u.id);

    return json({ users });
  } catch (e: any) {
    console.error("ghl-list-users error", e);
    return json({ error: String(e?.message ?? e), users: [] }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
