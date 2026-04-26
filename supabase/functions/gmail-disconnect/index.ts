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
    const { data: claims } = await supabase.auth.getClaims(token);
    const userId = claims?.claims?.sub;
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    const { data: roleRow } = await supabase
      .from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
    if (!roleRow) return json({ error: 'Admin only' }, 403);

    const { data: profile } = await supabase
      .from('profiles').select('workspace_id').eq('user_id', userId).single();
    if (!profile?.workspace_id) return json({ error: 'No workspace' }, 400);

    // Optional: { account_id } to target one account. If omitted, behavior is
    // "disconnect ALL accounts" for backward compat with the original UI.
    let accountId: string | null = null;
    try {
      const body = await req.json();
      accountId = body?.account_id ?? null;
    } catch { /* no body — disconnect all */ }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Pull the accounts we're about to remove (so we can revoke each refresh token at Google)
    let q = admin
      .from('gmail_workspace_account')
      .select('id, refresh_token_secret_id, is_default')
      .eq('workspace_id', profile.workspace_id);
    if (accountId) q = q.eq('id', accountId);
    const { data: targets } = await q;

    if (!targets || targets.length === 0) {
      return json({ ok: true });
    }

    let promotedNewDefault = false;
    for (const acc of targets) {
      if (acc.refresh_token_secret_id) {
        const { data: tok } = await admin
          .from('gmail_tokens').select('refresh_token').eq('id', acc.refresh_token_secret_id).single();
        if (tok?.refresh_token) {
          await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tok.refresh_token)}`, { method: 'POST' });
        }
        await admin.from('gmail_tokens').delete().eq('id', acc.refresh_token_secret_id);
      }
      await admin.from('gmail_workspace_account').delete().eq('id', acc.id);

      // If we just removed the default, promote the oldest remaining active account
      if (acc.is_default) {
        const { data: next } = await admin
          .from('gmail_workspace_account')
          .select('id')
          .eq('workspace_id', profile.workspace_id)
          .is('revoked_at', null)
          .order('connected_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (next) {
          await admin.from('gmail_workspace_account').update({ is_default: true }).eq('id', next.id);
          promotedNewDefault = true;
        }
      }
    }

    return json({ ok: true, removed: targets.length, promoted_new_default: promotedNewDefault });
  } catch (e) {
    console.error('gmail-disconnect', e);
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
