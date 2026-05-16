const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) return json({ error: "Invalid token" }, 401);

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      return json({ error: "Admin access required" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const { email, full_name, department_id, role } = body;

    if (!email || typeof email !== "string") {
      return json({ error: "Email is required" }, 400);
    }
    const trimmedEmail = email.trim().toLowerCase();

    // Check if a user with this email already exists — gives a clearer error than
    // letting inviteUserByEmail fail with a generic 422.
    try {
      const { data: existing } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      const found = existing?.users?.find((u: any) => (u.email || "").toLowerCase() === trimmedEmail);
      if (found) {
        return json({
          error: `A user with email "${trimmedEmail}" already exists in this workspace.`,
          code: "user_exists",
          existing_user_id: found.id,
        }, 400);
      }
    } catch (e) {
      console.warn("listUsers precheck failed (continuing):", e);
    }

    // inviteUserByEmail creates the user + sends the invite email
    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(trimmedEmail, {
        data: { full_name: full_name || "" },
      });

    if (inviteError) {
      // Map common errors to clearer messages so the UI can surface them properly
      const raw = inviteError.message || "Invite failed";
      console.error("inviteUserByEmail failed:", raw, "status:", (inviteError as any).status);

      let userMessage = raw;
      let code = "invite_failed";

      if (/already.*registered|already.*exists|duplicate/i.test(raw)) {
        userMessage = `A user with email "${trimmedEmail}" is already registered.`;
        code = "user_exists";
      } else if (/rate.?limit|too many/i.test(raw)) {
        userMessage = "Supabase Auth rate limit hit. Wait a few minutes and try again, or configure a custom SMTP provider in Supabase Auth settings.";
        code = "rate_limited";
      } else if (/smtp|email.*not.*sent|sender/i.test(raw)) {
        userMessage = "Couldn't send the invite email — Supabase SMTP needs configuring. Set up a custom SMTP provider in Supabase → Auth → Email Templates.";
        code = "smtp_error";
      } else if (/site.?url|redirect.?url/i.test(raw)) {
        userMessage = "Supabase Site URL isn't configured. Set it in Supabase → Auth → URL Configuration.";
        code = "site_url_missing";
      }

      return json({ error: userMessage, code, raw }, 400);
    }

    const newUserId = inviteData.user?.id;

    // Update profile with department and name if provided
    if (newUserId && (department_id || full_name)) {
      const updates: Record<string, string> = {};
      if (department_id) updates.department_id = department_id;
      if (full_name) updates.full_name = full_name;
      const { error: profileErr } = await adminClient
        .from("profiles")
        .update(updates)
        .eq("user_id", newUserId);
      if (profileErr) console.warn("Profile update failed (non-fatal):", profileErr.message);
    }

    // If role is admin, add admin role
    if (role === "admin" && newUserId) {
      const { error: roleErr } = await adminClient
        .from("user_roles")
        .insert({ user_id: newUserId, role: "admin" });
      if (roleErr) console.warn("Role insert failed (non-fatal):", roleErr.message);
    }

    return json({ success: true, user_id: newUserId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("invite-user uncaught:", msg, err);
    return json({ error: msg }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
