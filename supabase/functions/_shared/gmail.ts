// Shared helpers used by every gmail-* edge function.
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';

export interface GmailContext {
  userId: string;
  workspaceId: string;
  accessToken: string;
  email: string;
  admin: SupabaseClient;
  user: SupabaseClient;
}

/**
 * Authenticates the caller, verifies they have permission to use the workspace
 * Gmail account, refreshes a Google access token, and returns everything the
 * caller needs to make Gmail API requests.
 */
export async function getGmailContext(req: Request): Promise<{ ctx?: GmailContext; error?: { status: number; body: unknown } }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: { status: 401, body: { error: 'Unauthorized' } } };
  }

  const user = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace('Bearer ', '');
  const { data: claims, error: claimsErr } = await user.auth.getClaims(token);
  if (claimsErr || !claims?.claims) {
    return { error: { status: 401, body: { error: 'Unauthorized' } } };
  }
  const userId = claims.claims.sub;

  // Resolve workspace + permission via SQL helper
  const { data: profile } = await user.from('profiles').select('workspace_id').eq('user_id', userId).single();
  if (!profile?.workspace_id) {
    return { error: { status: 400, body: { error: 'No workspace' } } };
  }
  const { data: canUse, error: canErr } = await user.rpc('can_use_gmail', { _user_id: userId });
  if (canErr) {
    return { error: { status: 500, body: { error: canErr.message } } };
  }
  if (!canUse) {
    return { error: { status: 403, body: { error: 'No Gmail access' } } };
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: account } = await admin
    .from('gmail_workspace_account')
    .select('email, refresh_token_secret_id')
    .eq('workspace_id', profile.workspace_id)
    .is('revoked_at', null)
    .maybeSingle();
  if (!account) {
    return { error: { status: 400, body: { error: 'Gmail not connected' } } };
  }

  const { data: tok } = await admin
    .from('gmail_tokens')
    .select('refresh_token')
    .eq('id', account.refresh_token_secret_id)
    .single();
  if (!tok) {
    return { error: { status: 500, body: { error: 'Missing refresh token' } } };
  }

  const accessToken = await refreshAccessToken(tok.refresh_token);
  if (!accessToken) {
    return {
      error: {
        status: 401,
        body: {
          error: 'gmail_reauth_required',
          message: 'Your Gmail connection has expired. Please reconnect your Gmail account.',
        },
      },
    };
  }

  return {
    ctx: {
      userId,
      workspaceId: profile.workspace_id,
      accessToken,
      email: account.email,
      admin,
      user,
    },
  };
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    console.error('refresh failed', await res.text());
    return null;
  }
  const data: { access_token: string } = await res.json();
  return data.access_token ?? null;
}

export async function gmail(ctx: GmailContext, path: string, init: RequestInit = {}): Promise<Response> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me${path}`;
  const headers = new Headers(init.headers ?? {});
  headers.set('Authorization', `Bearer ${ctx.accessToken}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(url, { ...init, headers });
}
