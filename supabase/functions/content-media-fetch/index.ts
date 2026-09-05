// Drains the inbound media queue: resolve the reference, fetch the bytes,
// store them, attach the result to the seed the message created.
//
// Runs separately from the webhook on purpose. Providers time out webhooks, and
// a slow download inside one would turn a delivered message into a retried
// message. Here a provider outage means the photo arrives late rather than the
// message being lost.
//
// Every fetch goes through the host allowlist in fetch_rules.ts. A media
// reference is external input, and this worker holds a service-role key.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import {
  classifyFailure,
  isAllowedMediaUrl,
  isSupportedMime,
  MAX_MEDIA_BYTES,
  storagePathFor,
} from './fetch_rules.ts';

const BUCKET = 'content-media';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL'), serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'not_configured' }, 500);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: claimed, error: claimError } = await admin.rpc('inbound_media_claim_next', { p_limit: 5, p_lease_seconds: 120 });
  if (claimError) return json({ error: 'claim_failed' }, 500);

  const items = (claimed ?? []) as Array<Record<string, string>>;
  if (!items.length) return json({ ok: true, processed: 0 }, 200);

  const results: string[] = [];
  for (const item of items) {
    try {
      results.push(await processOne(admin, item));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      await admin.rpc('inbound_media_complete', { p_id: item.id, p_status: 'failed', p_error: message });
      results.push('failed');
    }
  }
  return json({ ok: true, processed: items.length, results }, 200);
});

async function processOne(admin: SupabaseClient, item: Record<string, string>): Promise<string> {
  const provider = item.provider as 'meta' | 'twilio';
  const { url, mimeType, headers } = await resolveMedia(provider, item.media_ref, item.mime_type);

  if (!isSupportedMime(mimeType)) {
    await admin.rpc('inbound_media_complete', { p_id: item.id, p_status: 'skipped_unsupported', p_error: `mime ${mimeType}` });
    return 'skipped_unsupported';
  }
  // Checked again after resolution: for Meta the URL only exists at this point,
  // and it is the resolved URL that actually gets fetched.
  if (!isAllowedMediaUrl(url, provider)) {
    await admin.rpc('inbound_media_complete', { p_id: item.id, p_status: 'failed', p_error: 'media host not allowed' });
    return 'blocked_host';
  }

  const response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    const permanent = classifyFailure(response.status) === 'permanent';
    await admin.rpc('inbound_media_complete', {
      p_id: item.id,
      // Permanent failures are marked failed immediately rather than left to
      // burn through the attempt cap calling a host that will keep saying no.
      p_status: permanent ? 'failed' : 'pending',
      p_error: `provider responded ${response.status}`,
    });
    return permanent ? 'failed_permanent' : 'retry';
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_MEDIA_BYTES) {
    await admin.rpc('inbound_media_complete', { p_id: item.id, p_status: 'skipped_too_large', p_bytes: bytes.byteLength });
    return 'skipped_too_large';
  }

  const path = storagePathFor(item.workspace_id ?? 'unknown', item.id, mimeType);
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: mimeType, upsert: true });
  if (uploadError) throw new Error(`upload failed: ${uploadError.message}`);

  const { data: signed, error: signError } = await admin.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signError || !signed?.signedUrl) throw new Error('signed url failed');

  await admin.rpc('inbound_media_complete', {
    p_id: item.id,
    p_status: 'fetched',
    p_storage_path: path,
    p_bytes: bytes.byteLength,
    p_public_url: signed.signedUrl,
  });
  return 'fetched';
}

async function resolveMedia(
  provider: 'meta' | 'twilio',
  mediaRef: string,
  declaredMime: string | null,
): Promise<{ url: string; mimeType: string; headers: Record<string, string> }> {
  if (provider === 'twilio') {
    const sid = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '', token = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
    if (!sid || !token) throw new Error('twilio credentials not configured');
    // The reference is a URL straight out of a webhook body. It is host-checked
    // by the caller before anything is fetched.
    return {
      url: mediaRef,
      mimeType: declaredMime ?? 'application/octet-stream',
      headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}` },
    };
  }

  const token = Deno.env.get('META_ACCESS_TOKEN') ?? '';
  if (!token) throw new Error('meta access token not configured');
  const auth = { Authorization: `Bearer ${token}` };
  // Meta gives an id; the download URL is short-lived and fetched in two steps.
  const lookup = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(mediaRef)}`, {
    headers: auth,
    signal: AbortSignal.timeout(15000),
  });
  if (!lookup.ok) throw new Error(`meta media lookup failed ${lookup.status}`);
  const meta = await lookup.json() as { url?: string; mime_type?: string };
  if (!meta.url) throw new Error('meta media lookup returned no url');
  return { url: meta.url, mimeType: meta.mime_type ?? declaredMime ?? 'application/octet-stream', headers: auth };
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
