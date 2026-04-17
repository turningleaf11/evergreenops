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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: account } = await admin
      .from('gmail_workspace_account')
      .select('refresh_token_secret_id')
      .eq('workspace_id', profile.workspace_id)
      .maybeSingle();

    if (account?.refresh_token_secret_id) {
      // Best-effort revoke at Google
      const { data: tok } = await admin
        .from('gmail_tokens').select('refresh_token').eq('id', account.refresh_token_secret_id).single();
      if (tok?.refresh_token) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tok.refresh_token)}`, { method: 'POST' });
      }
      await admin.from('gmail_tokens').delete().eq('id', account.refresh_token_secret_id);
    }

    await admin.from('gmail_workspace_account')
      .update({ revoked_at: new Date().toISOString() })
      .eq('workspace_id', profile.workspace_id);

    // Hard delete so the workspace can reconnect cleanly
    await admin.from('gmail_workspace_account')
      .delete().eq('workspace_id', profile.workspace_id);

    return json({ ok: true });
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
