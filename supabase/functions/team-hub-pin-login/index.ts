// Signs in a Team Hub user by email + 4-digit PIN instead of a password —
// no auth header, this IS the login. Never sent by email, never a magic link.
//
// The PIN itself never touches Supabase Auth. On a correct match we mint a
// real session by generating a magiclink token server-side and redeeming it
// ourselves (the user never sees a link or an email) — the standard pattern
// for layering a custom credential on top of Supabase Auth.
//
// Rate-limited: 5 wrong PINs locks the account for 15 minutes. Errors are
// deliberately generic (never reveal whether the email exists) to avoid
// turning this into an account-enumeration or brute-force oracle.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const GENERIC_ERROR = "Incorrect email or PIN.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const anon = createClient(supabaseUrl, anonKey);

    const body = await req.json().catch(() => ({}));
    const { email, pin } = body;
    if (typeof email !== "string" || typeof pin !== "string") {
      return json({ error: GENERIC_ERROR }, 400);
    }
    const trimmedEmail = email.trim().toLowerCase();

    // Small team — a full listUsers page comfortably covers it. No admin
    // API for "get user by email" exists, so this mirrors invite-user's
    // existing lookup pattern.
    const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = usersPage?.users?.find((u: any) => (u.email || "").toLowerCase() === trimmedEmail);
    if (!found) return json({ error: GENERIC_ERROR }, 400);

    const { data: pinRow } = await admin
      .from("team_hub_pins")
      .select("pin_hash, failed_attempts, locked_until")
      .eq("user_id", found.id)
      .maybeSingle();
    if (!pinRow) return json({ error: GENERIC_ERROR }, 400);

    if (pinRow.locked_until && new Date(pinRow.locked_until) > new Date()) {
      return json({ error: `Too many failed attempts. Try again after ${new Date(pinRow.locked_until).toLocaleTimeString()}.` }, 429);
    }

    const matches = await bcrypt.compare(pin, pinRow.pin_hash);
    if (!matches) {
      const attempts = (pinRow.failed_attempts ?? 0) + 1;
      const locked = attempts >= MAX_ATTEMPTS;
      await admin.from("team_hub_pins").update({
        failed_attempts: locked ? 0 : attempts,
        locked_until: locked ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("user_id", found.id);
      return json({ error: locked ? `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.` : GENERIC_ERROR }, locked ? 429 : 400);
    }

    await admin.from("team_hub_pins").update({
      failed_attempts: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    }).eq("user_id", found.id);

    // Mint a real session without emailing anything: generate a magiclink
    // token server-side, then redeem it ourselves via verifyOtp.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: trimmedEmail,
    });
    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error("generateLink failed:", linkErr?.message);
      return json({ error: "Sign-in failed. Try again." }, 500);
    }

    const { data: verifyData, error: verifyErr } = await anon.auth.verifyOtp({
      type: "magiclink",
      token_hash: linkData.properties.hashed_token,
    });
    if (verifyErr || !verifyData?.session) {
      console.error("verifyOtp failed:", verifyErr?.message);
      return json({ error: "Sign-in failed. Try again." }, 500);
    }

    return json({
      access_token: verifyData.session.access_token,
      refresh_token: verifyData.session.refresh_token,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("team-hub-pin-login uncaught:", msg);
    return json({ error: "Sign-in failed. Try again." }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
