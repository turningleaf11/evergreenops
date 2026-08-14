// Lets a signed-in Team Hub user replace their admin-issued temp password
// with a real password or a 4-digit PIN of their own choosing. Called right
// after first login, while profiles.must_set_credential is still true — but
// also usable later if someone wants to change their credential.
//
// PIN is not stored as the Supabase Auth password (4 digits fails Supabase's
// length policy and would be brute-forceable in an unthrottled password
// field). It's hashed into team_hub_pins instead, with lockout enforced by
// team-hub-pin-login.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return json({ error: "Invalid token" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const { type, value } = body;

    if (type === "password") {
      if (typeof value !== "string" || value.length < 8) {
        return json({ error: "Password must be at least 8 characters." }, 400);
      }
      const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, { password: value });
      if (updateErr) return json({ error: updateErr.message }, 400);
    } else if (type === "pin") {
      if (typeof value !== "string" || !/^\d{4}$/.test(value)) {
        return json({ error: "PIN must be exactly 4 digits." }, 400);
      }
      const pinHash = await bcrypt.hash(value, 10);
      const { error: upsertErr } = await admin
        .from("team_hub_pins")
        .upsert({ user_id: user.id, pin_hash: pinHash, failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() });
      if (upsertErr) return json({ error: upsertErr.message }, 400);
    } else {
      return json({ error: "type must be 'password' or 'pin'" }, 400);
    }

    const { error: flagErr } = await admin
      .from("profiles")
      .update({ must_set_credential: false })
      .eq("user_id", user.id);
    if (flagErr) console.warn("Clearing must_set_credential failed (non-fatal):", flagErr.message);

    return json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("team-hub-set-credential uncaught:", msg);
    return json({ error: msg }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
