// Developer-only utility: force a refresh of a specific Gmail account's
// access token at Google. Used by the in-app Developer page to validate
// whether a stored refresh token still works.
//
// Gated to admins of the developer workspace (Evergreen HQ). Other workspaces
// will get a 403 even if they somehow guess the URL.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';
import { refreshAccessToken } from '../_shared/gmail.ts';

const DEVELOPER_WORKSPACE_ID = '2a918558-69fa-4d12-9b2d-fe59e0823997';

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

    // Server-side gate: must be admin of the developer workspace
    const [{ data: profile }, { data: roleRow }] = await Promise.all([
      supabase.from('profiles').select('workspace_id').eq('user_id', userId).single(),
      supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle(),
    ]);
    if (!profile || profile.workspace_id !== DEVELOPER_WORKSPACE_ID || !roleRow) {
      return json({ error: 'Developer-only endpoint' }, 403);
    }

    const { account_id } = await req.json();
    if (!account_id) return json({ error: 'account_id required' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: account } = await admin
      .from('gmail_workspace_account')
      .select('id, email, refresh_token_secret_id')
      .eq('id', account_id)
      .eq('workspace_id', DEVELOPER_WORKSPACE_ID)
      .maybeSingle();
    if (!account) return json({ error: 'Account not found' }, 404);

    const { data: tok } = await admin
      .from('gmail_tokens')
      .select('refresh_token, scopes')
      .eq('id', account.refresh_token_secret_id)
      .single();
    if (!tok) return json({ error: 'No refresh token row' }, 500);

    const access = await refreshAccessToken(tok.refresh_token);
    return json({
      ok: !!access,
      email: account.email,
      access_token_preview: access ? `${access.slice(0, 12)}…` : null,
      scopes: tok.scopes ?? null,
    }, access ? 200 : 502);
  } catch (e) {
    console.error('gmail-debug-refresh', e);
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
