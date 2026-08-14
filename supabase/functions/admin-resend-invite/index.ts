// Resend / regenerate an invite link for an already-invited user.
//
// Useful when:
//   - The Supabase Site URL was wrong when the original invite went out
//     (so the link redirects to the wrong place — happened with Vercel default)
//   - The original invite email got lost / spam-filtered
//   - The Supabase free-tier email rate limit blocked the first send
//
// Strategy: use auth.admin.generateLink({ type: 'invite' }) which:
//   - Creates a fresh invite token using the CURRENT Site URL config
//   - Does NOT send an email — returns the URL directly
//   - Admin can then copy the link to share, OR we trigger Supabase to email it
//
// We return the link in the response so the admin UI can copy-to-clipboard.
// This bypasses email delivery entirely if needed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) return json({ error: "Invalid token" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Admin access required" }, 403);

    const body = await req.json().catch(() => ({}));
    const { user_id, email: emailInput } = body;

    let email: string | undefined = emailInput;
    let targetUserId: string | undefined = user_id;

    // Resolve email from user_id if needed (we don't store email on profiles)
    if (targetUserId && !email) {
      const { data: targetUser, error: getErr } = await admin.auth.admin.getUserById(targetUserId);
      if (getErr || !targetUser?.user) {
        return json({ error: "Target user not found in auth" }, 404);
      }
      email = targetUser.user.email || undefined;
      if (!email) {
        return json({ error: "Target user has no email on file" }, 400);
      }

      // Team Hub accounts never went through the email-invite flow, so
      // email_confirmed_at is already set on day one — that's not a signal
      // they've logged in. Issue a fresh temp password instead of a link.
      const { data: roleRow } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", targetUserId)
        .eq("role", "team_hub")
        .maybeSingle();
      if (roleRow) {
        const tempPassword = generateTempPassword();
        const { error: pwErr } = await admin.auth.admin.updateUserById(targetUserId, { password: tempPassword });
        if (pwErr) return json({ error: pwErr.message, code: "generate_failed" }, 400);
        const { error: flagErr } = await admin.from("profiles").update({ must_set_credential: true }).eq("user_id", targetUserId);
        if (flagErr) console.warn("must_set_credential flag failed (non-fatal):", flagErr.message);
        return json({ success: true, email, temp_password: tempPassword });
      }

      // Already accepted?
      if (targetUser.user.email_confirmed_at) {
        return json({
          error: `${email} has already accepted their invite and confirmed their email — nothing to resend.`,
          code: "already_confirmed",
        }, 400);
      }
    }

    if (!email) {
      return json({ error: "Provide either user_id or email" }, 400);
    }

    // Generate a fresh invite link using the current Site URL config.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
    });

    if (linkErr) {
      console.error("generateLink failed:", linkErr);
      return json({ error: linkErr.message, code: "generate_failed" }, 400);
    }

    const actionLink = linkData.properties?.action_link;
    if (!actionLink) {
      return json({ error: "Supabase did not return an invite URL" }, 500);
    }

    return json({
      success: true,
      email,
      invite_url: actionLink,
      expires_at: linkData.properties?.email_otp ? null : null, // generateLink doesn't expose expiry directly
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("admin-resend-invite uncaught:", msg);
    return json({ error: msg }, 500);
  }
});

/** 12-char random password, alphanumeric — meets Supabase's minimum policy, never shown twice. */
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
