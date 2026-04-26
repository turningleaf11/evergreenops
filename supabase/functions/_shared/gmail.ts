// Shared helpers used by every gmail-* edge function.
//
// Multi-account support
// ---------------------
// A workspace can connect multiple Gmail accounts. Callers may target a
// specific account by passing an `account_id` (UUID of `gmail_workspace_account.id`):
//   - as ?account_id=... query string, or
//   - as { account_id } in JSON body, or
//   - as the `X-Gmail-Account-Id` request header.
// If omitted, the workspace's default account (`is_default = true`) is used.
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';

export interface GmailAccountSummary {
  id: string;
  email: string;
  label: string | null;
  is_default: boolean;
}

export interface GmailContext {
  userId: string;
  workspaceId: string;
  accessToken: string;
  email: string;
  accountId: string;
  accountLabel: string | null;
  admin: SupabaseClient;
  user: SupabaseClient;
}

/**
 * Authenticates the caller, verifies they have permission to use the workspace
 * Gmail integration, picks the right account (explicit or default), refreshes
 * its Google access token, and returns everything the caller needs to make
 * Gmail API requests.
 */
export async function getGmailContext(
  req: Request,
  opts: { accountId?: string } = {},
): Promise<{ ctx?: GmailContext; error?: { status: number; body: unknown } }> {
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

  // Resolve which account to use. Priority:
  //   1. opts.accountId (explicit caller arg)
  //   2. ?account_id=... query
  //   3. X-Gmail-Account-Id header
  //   4. workspace default
  const url = new URL(req.url);
  const explicitId =
    opts.accountId ??
    url.searchParams.get('account_id') ??
    req.headers.get('X-Gmail-Account-Id') ??
    null;

  let accountQuery = admin
    .from('gmail_workspace_account')
    .select('id, email, label, is_default, refresh_token_secret_id')
    .eq('workspace_id', profile.workspace_id)
    .is('revoked_at', null);

  if (explicitId) {
    accountQuery = accountQuery.eq('id', explicitId);
  } else {
    accountQuery = accountQuery.eq('is_default', true);
  }

  let { data: account } = await accountQuery.maybeSingle();

  // Fallback: if no default is set yet (e.g. legacy workspaces from before
  // the multi-account migration completed), grab the oldest active account.
  if (!account && !explicitId) {
    const { data: any } = await admin
      .from('gmail_workspace_account')
      .select('id, email, label, is_default, refresh_token_secret_id')
      .eq('workspace_id', profile.workspace_id)
      .is('revoked_at', null)
      .order('connected_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    account = any;
  }

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
          account_email: account.email,
          account_id: account.id,
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
      accountId: account.id,
      accountLabel: account.label,
      admin,
      user,
    },
  };
}

/**
 * Returns every active Gmail account for the caller's workspace. Used by
 * fan-out endpoints (e.g. inbox aggregation) and by UI selectors. Performs
 * the same auth + permission checks as `getGmailContext`.
 */
export async function listWorkspaceGmailAccounts(
  req: Request,
): Promise<{ accounts?: GmailAccountSummary[]; admin?: SupabaseClient; userId?: string; workspaceId?: string; error?: { status: number; body: unknown } }> {
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
  const { data: claims } = await user.auth.getClaims(token);
  const userId = claims?.claims?.sub;
  if (!userId) return { error: { status: 401, body: { error: 'Unauthorized' } } };

  const { data: profile } = await user.from('profiles').select('workspace_id').eq('user_id', userId).single();
  if (!profile?.workspace_id) return { error: { status: 400, body: { error: 'No workspace' } } };

  const { data: canUse } = await user.rpc('can_use_gmail', { _user_id: userId });
  if (!canUse) return { error: { status: 403, body: { error: 'No Gmail access' } } };

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: accounts } = await admin
    .from('gmail_workspace_account')
    .select('id, email, label, is_default')
    .eq('workspace_id', profile.workspace_id)
    .is('revoked_at', null)
    .order('is_default', { ascending: false })
    .order('connected_at', { ascending: true });

  return { accounts: (accounts ?? []) as GmailAccountSummary[], admin, userId, workspaceId: profile.workspace_id };
}

/**
 * Refresh a Google access token from a stored refresh token. Returns null when
 * Google rejects the refresh (e.g. token revoked or expired). Callers should
 * surface a `gmail_reauth_required` error to the client when this happens so
 * the UI can offer a Reconnect action.
 */
export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
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

/**
 * Build a one-off ad-hoc context for a specific account row. Used by
 * fan-out endpoints that already have the workspace + account in hand and
 * just need a fresh access token. Returns null on refresh failure.
 */
export async function buildContextForAccount(
  admin: SupabaseClient,
  account: { id: string; email: string; label: string | null; refresh_token_secret_id: string },
  userId: string,
  workspaceId: string,
): Promise<GmailContext | null> {
  const { data: tok } = await admin
    .from('gmail_tokens')
    .select('refresh_token')
    .eq('id', account.refresh_token_secret_id)
    .single();
  if (!tok) return null;
  const accessToken = await refreshAccessToken(tok.refresh_token);
  if (!accessToken) return null;
  // Lazily create a per-call user client placeholder; fan-out callers don't
  // typically need the user-scoped client.
  const user = admin;
  return {
    userId,
    workspaceId,
    accessToken,
    email: account.email,
    accountId: account.id,
    accountLabel: account.label,
    admin,
    user,
  };
}
