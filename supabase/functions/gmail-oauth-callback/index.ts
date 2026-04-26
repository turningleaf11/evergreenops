import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';

const CALLBACK_PATH = '/integrations/gmail/callback';
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

interface OAuthStatePayload {
  u: string;
  w: string;
  o: string;
  n: string;
  t: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method === 'GET') {
      return await handleGoogleRedirect(req);
    }

    if (req.method === 'POST') {
      return await handleLegacyCallback(req);
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (e) {
    console.error('gmail-oauth-callback error', e);
    return json({ error: String(e) }, 500);
  }
});

async function handleGoogleRedirect(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const googleError = url.searchParams.get('error');
  const parsed = state ? await verifyState(state) : null;
  const fallbackOrigin = parsed?.o ?? normalizeOrigin(Deno.env.get('GOOGLE_OAUTH_REDIRECT_URI'));

  if (googleError) {
    return redirectToApp(fallbackOrigin, { status: 'error', message: `Google returned: ${googleError}` });
  }

  if (!code || !state || !parsed) {
    return redirectToApp(fallbackOrigin, { status: 'error', message: 'Invalid or expired Gmail connection request.' });
  }

  const result = await completeConnection(code, parsed);
  if (!result.ok) {
    return redirectToApp(parsed.o, { status: 'error', message: result.error });
  }

  return redirectToApp(parsed.o, { status: 'success', email: result.email });
}

async function handleLegacyCallback(req: Request) {
  const body = await req.json().catch(() => null);
  const code = body?.code;
  const state = body?.state;
  if (!code || !state) return json({ error: 'Missing code/state' }, 400);

  const parsed = await verifyState(state);
  if (!parsed) return json({ error: 'Invalid or expired state' }, 400);

  const result = await completeConnection(code, parsed);
  if (!result.ok) {
    return json({ error: result.error }, result.status);
  }

  return json({ ok: true, email: result.email });
}

async function completeConnection(code: string, parsed: OAuthStatePayload) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
  if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret) {
    return { ok: false as const, status: 500, error: 'OAuth not configured' };
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const [{ data: profile }, { data: roleRow }] = await Promise.all([
    admin.from('profiles').select('workspace_id').eq('user_id', parsed.u).maybeSingle(),
    admin.from('user_roles').select('role').eq('user_id', parsed.u).eq('role', 'admin').maybeSingle(),
  ]);

  if (!roleRow) {
    return { ok: false as const, status: 403, error: 'Admin access required' };
  }

  if (!profile?.workspace_id || profile.workspace_id !== parsed.w) {
    return { ok: false as const, status: 400, error: 'Workspace mismatch' };
  }

  const redirectUri = `${supabaseUrl}/functions/v1/gmail-oauth-callback`;
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
    console.error('gmail token exchange failed', await tokenRes.text());
    return { ok: false as const, status: 400, error: 'Google token exchange failed' };
  }

  const tokens: { access_token: string; refresh_token?: string; scope?: string } = await tokenRes.json();
  if (!tokens.refresh_token) {
    return { ok: false as const, status: 400, error: 'Google did not return a refresh token. Try reconnecting and approving consent again.' };
  }

  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userInfoRes.ok) {
    console.error('gmail userinfo failed', await userInfoRes.text());
    return { ok: false as const, status: 400, error: 'Could not read Gmail account details' };
  }

  const userInfo: { email: string } = await userInfoRes.json();

  // Multi-account behavior:
  //  - If this same Gmail address is already connected (active) for the
  //    workspace, we treat this as a re-auth: rotate its refresh token and
  //    keep its `is_default` / `label`.
  //  - Otherwise we add it as a NEW account. If it's the workspace's first
  //    active account, mark it default automatically.
  const { data: existingAccount } = await admin
    .from('gmail_workspace_account')
    .select('id, refresh_token_secret_id, is_default')
    .eq('workspace_id', parsed.w)
    .eq('email', userInfo.email)
    .is('revoked_at', null)
    .maybeSingle();

  if (existingAccount) {
    // Rotate the token in place
    const { error: tokErr } = await admin
      .from('gmail_tokens')
      .update({ refresh_token: tokens.refresh_token, scopes: tokens.scope ?? null })
      .eq('id', existingAccount.refresh_token_secret_id);
    if (tokErr) {
      return { ok: false as const, status: 500, error: 'Failed to update Gmail token' };
    }
    await admin
      .from('gmail_workspace_account')
      .update({ connected_at: new Date().toISOString(), connected_by: parsed.u })
      .eq('id', existingAccount.id);
  } else {
    // Brand new account for this workspace
    const { data: insertedTok, error: tokErr } = await admin
      .from('gmail_tokens')
      .insert({
        workspace_id: parsed.w,
        refresh_token: tokens.refresh_token,
        scopes: tokens.scope ?? null,
      })
      .select('id')
      .single();
    if (tokErr) {
      return { ok: false as const, status: 500, error: 'Failed to store Gmail token' };
    }

    // First active account for this workspace?  -> default
    const { count: activeCount } = await admin
      .from('gmail_workspace_account')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', parsed.w)
      .is('revoked_at', null);

    const { error: insertErr } = await admin.from('gmail_workspace_account').insert({
      workspace_id: parsed.w,
      email: userInfo.email,
      refresh_token_secret_id: insertedTok.id,
      connected_by: parsed.u,
      connected_at: new Date().toISOString(),
      is_default: (activeCount ?? 0) === 0,
    });
    if (insertErr) {
      return { ok: false as const, status: 500, error: 'Failed to save workspace Gmail account' };
    }
  }

  await admin.from('gmail_access_rules').upsert({
    workspace_id: parsed.w,
  }, { onConflict: 'workspace_id', ignoreDuplicates: true });

  return { ok: true as const, email: userInfo.email };
}

function redirectToApp(origin: string | null, params: { status: 'success' | 'error'; message?: string; email?: string }) {
  if (!origin) {
    return json(
      params.status === 'success'
        ? { ok: true, email: params.email }
        : { error: params.message ?? 'OAuth failed' },
      params.status === 'success' ? 200 : 400,
    );
  }

  const redirectUrl = new URL(`${origin}${CALLBACK_PATH}`);
  redirectUrl.searchParams.set('status', params.status);
  if (params.message) redirectUrl.searchParams.set('message', params.message);
  if (params.email) redirectUrl.searchParams.set('email', params.email);
  return Response.redirect(redirectUrl.toString(), 302);
}

async function verifyState(state: string): Promise<OAuthStatePayload | null> {
  const [encodedPayload, signature] = state.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = await createSignature(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as OAuthStatePayload;
    if (!parsed.u || !parsed.w || !parsed.o || !parsed.t) return null;
    if (Date.now() - parsed.t > STATE_MAX_AGE_MS) return null;
    return { ...parsed, o: normalizeOrigin(parsed.o) ?? parsed.o };
  } catch {
    return null;
  }
}

async function createSignature(value: string): Promise<string> {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
  if (!secret) throw new Error('Missing OAuth signing secret');

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
