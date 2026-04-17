import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = claims.claims.sub;

    // Admin check
    const { data: roleRow } = await supabase
      .from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
    if (!roleRow) return json({ error: 'Admin only' }, 403);

    const { code, state } = await req.json();
    if (!code || !state) return json({ error: 'Missing code/state' }, 400);

    // Decode + verify state
    let parsed: { u: string; w: string; t: number };
    try {
      const padded = state.replace(/-/g, '+').replace(/_/g, '/') +
        '='.repeat((4 - state.length % 4) % 4);
      parsed = JSON.parse(atob(padded));
    } catch {
      return json({ error: 'Invalid state' }, 400);
    }
    if (parsed.u !== userId) return json({ error: 'State user mismatch' }, 400);
    if (Date.now() - parsed.t > 10 * 60 * 1000) return json({ error: 'State expired' }, 400);

    const { data: profile } = await supabase
      .from('profiles').select('workspace_id').eq('user_id', userId).single();
    if (!profile?.workspace_id || profile.workspace_id !== parsed.w) {
      return json({ error: 'Workspace mismatch' }, 400);
    }

    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!;
    const redirectUri = Deno.env.get('GOOGLE_OAUTH_REDIRECT_URI')!;

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      return json({ error: 'Token exchange failed', detail: text }, 400);
    }
    const tokens: { access_token: string; refresh_token?: string; scope?: string } = await tokenRes.json();
    if (!tokens.refresh_token) {
      return json({ error: 'No refresh_token returned. Re-consent required.' }, 400);
    }

    // Fetch email
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo: { email: string } = await userInfoRes.json();

    // Use service-role client to write tokens
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Insert/update token row
    const { data: existingTok } = await admin
      .from('gmail_tokens').select('id').eq('workspace_id', parsed.w).maybeSingle();

    let tokenRowId: string;
    if (existingTok) {
      tokenRowId = existingTok.id;
      await admin.from('gmail_tokens').update({
        refresh_token: tokens.refresh_token,
        scopes: tokens.scope ?? null,
      }).eq('id', tokenRowId);
    } else {
      const { data: inserted, error: insErr } = await admin.from('gmail_tokens').insert({
        workspace_id: parsed.w,
        refresh_token: tokens.refresh_token,
        scopes: tokens.scope ?? null,
      }).select('id').single();
      if (insErr) return json({ error: 'Token store failed', detail: insErr.message }, 500);
      tokenRowId = inserted.id;
    }

    // Upsert workspace gmail account record
    const { error: upErr } = await admin.from('gmail_workspace_account').upsert({
      workspace_id: parsed.w,
      email: userInfo.email,
      refresh_token_secret_id: tokenRowId,
      connected_by: userId,
      connected_at: new Date().toISOString(),
      revoked_at: null,
    }, { onConflict: 'workspace_id' });
    if (upErr) return json({ error: 'Account upsert failed', detail: upErr.message }, 500);

    // Ensure default access rules exist
    await admin.from('gmail_access_rules').upsert({
      workspace_id: parsed.w,
    }, { onConflict: 'workspace_id', ignoreDuplicates: true });

    return json({ ok: true, email: userInfo.email });
  } catch (e) {
    console.error('gmail-oauth-callback error', e);
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
