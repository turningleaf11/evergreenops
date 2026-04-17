import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
].join(' ');

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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
    if (!supabaseUrl || !anonKey || !clientId) {
      return json({ error: 'OAuth not configured' }, 500);
    }

    const supabase = createClient(
      supabaseUrl,
      anonKey,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = claims.claims.sub;

    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roleRow) return json({ error: 'Admin only' }, 403);

    const { data: profile } = await supabase
      .from('profiles')
      .select('workspace_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (!profile?.workspace_id) return json({ error: 'No workspace' }, 400);

    const returnOrigin = resolveReturnOrigin(req);
    if (!returnOrigin) return json({ error: 'Missing request origin' }, 400);

    const state = await signState({
      u: userId,
      w: profile.workspace_id,
      o: returnOrigin,
      n: crypto.randomUUID(),
      t: Date.now(),
    });

    const redirectUri = `${supabaseUrl}/functions/v1/gmail-oauth-callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent select_account',
      state,
    });

    const authorizeUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return json({ authorize_url: authorizeUrl, state });
  } catch (e) {
    console.error('gmail-oauth-start error', e);
    return json({ error: String(e) }, 500);
  }
});

function resolveReturnOrigin(req: Request): string | null {
  return normalizeOrigin(req.headers.get('origin'))
    ?? normalizeOrigin(req.headers.get('referer'))
    ?? normalizeOrigin(Deno.env.get('GOOGLE_OAUTH_REDIRECT_URI'));
}

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

async function signState(payload: OAuthStatePayload): Promise<string> {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await createSignature(encodedPayload);
  return `${encodedPayload}.${signature}`;
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

function base64UrlEncode(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
