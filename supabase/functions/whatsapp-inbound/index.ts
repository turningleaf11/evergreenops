// Inbound WhatsApp webhook.
//
// The only public, unauthenticated endpoint in this system. It does four things
// and deliberately nothing else: verify the request came from the provider,
// normalise it, hand it to inbound_message_record, and answer 200.
//
// It does NOT decide who is allowed to send — that is the sender allowlist in
// the database, and it is a separate question from whether the transport is
// authentic. A valid signature from Meta on a message from a stranger is a
// valid signature on a message from a stranger.
//
// Supports Meta Cloud API and Twilio, chosen by WHATSAPP_PROVIDER. Twilio's
// sandbox is the fast path to a working prototype; Meta Cloud API is the
// production target since Autumn already has Meta Business. Both are here so
// moving between them is a config change, not a rewrite.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import {
  NormalizedMessage,
  parseMetaPayload,
  parseTwilioPayload,
  Provider,
  timingSafeEqual,
  verifyMetaSignature,
  verifyTwilioSignature,
} from './verify.ts';

const MAX_BODY_BYTES = 256 * 1024;

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  const provider = (Deno.env.get('WHATSAPP_PROVIDER') ?? 'meta') as Provider;

  // Meta's one-time subscription handshake.
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? '';
    const challenge = url.searchParams.get('hub.challenge') ?? '';
    const supplied = url.searchParams.get('hub.verify_token') ?? '';
    if (url.searchParams.get('hub.mode') === 'subscribe' && verifyToken && timingSafeEqual(supplied, verifyToken)) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const declared = Number(req.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json({ error: 'request_too_large' }, 413);

  // Raw body, read once. Meta signs the exact bytes, so this must not be
  // re-serialised from parsed JSON before verification.
  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) return json({ error: 'request_too_large' }, 413);

  let messages: NormalizedMessage[];
  try {
    if (provider === 'twilio') {
      const params = Object.fromEntries(new URLSearchParams(rawBody));
      const ok = await verifyTwilioSignature(
        req.headers.get('X-Twilio-Signature'),
        Deno.env.get('WHATSAPP_PUBLIC_URL') ?? req.url,
        params,
        Deno.env.get('TWILIO_AUTH_TOKEN') ?? '',
      );
      if (!ok) return unauthorized(requestId, provider);
      messages = parseTwilioPayload(params);
    } else {
      const ok = await verifyMetaSignature(
        req.headers.get('X-Hub-Signature-256'),
        rawBody,
        Deno.env.get('META_APP_SECRET') ?? '',
      );
      if (!ok) return unauthorized(requestId, provider);
      messages = parseMetaPayload(JSON.parse(rawBody));
    }
  } catch (_error) {
    // Never echo the payload back. A malformed body from a signed source is
    // still a bad request, and the body may contain message content.
    console.error(JSON.stringify({ event: 'whatsapp_inbound_parse_failed', request_id: requestId, provider }));
    return json({ error: 'invalid_payload' }, 400);
  }

  // Delivery receipts and read markers arrive on the same webhook and contain
  // no messages. Acknowledge them; do not treat an empty batch as an error.
  if (!messages.length) return json({ ok: true, request_id: requestId, recorded: 0 }, 200);

  const supabaseUrl = Deno.env.get('SUPABASE_URL'), serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'not_configured' }, 500);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const dispositions: string[] = [];
  for (const message of messages) {
    const { data, error } = await admin.rpc('inbound_message_record', {
      p_channel: 'whatsapp',
      p_external_id: message.externalId,
      p_from_identifier: message.from,
      p_body: message.body,
      p_media: message.media,
    });
    if (error) {
      // A 5xx makes the provider retry the whole batch, which re-delivers
      // messages already recorded. The unique constraint makes that safe, so
      // failing loudly here is correct rather than swallowing the error.
      console.error(JSON.stringify({ event: 'whatsapp_inbound_record_failed', request_id: requestId }));
      return json({ error: 'record_failed', request_id: requestId }, 500);
    }
    dispositions.push(String((data?.[0] as Record<string, unknown> | undefined)?.status ?? 'unknown'));
  }

  // Kick the media fetcher without waiting for it. The provider is holding this
  // connection open and will retry the whole batch if we are slow, so the
  // download must not happen on this path — but a photo that only arrives on
  // the next inbound message is a poor experience, so it is started here and
  // allowed to finish after the response.
  if (dispositions.includes('routed') && messages.some((m) => m.media.length > 0)) {
    const drain = fetch(`${supabaseUrl}/functions/v1/content-media-fetch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: '{}',
    }).catch(() => {
      // Never fail the webhook because the fetcher is unhappy. The queue is
      // durable and leased; the item stays pending and is drained by the next
      // invocation.
      console.warn(JSON.stringify({ event: 'whatsapp_inbound_drain_failed', request_id: requestId }));
    });
    const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
    if (runtime?.waitUntil) runtime.waitUntil(drain); else await drain;
  }

  // 200 for everything recorded, including messages from unknown senders. They
  // were handled — refusing them is the handling — and a non-2xx would make the
  // provider retry a stranger's message indefinitely.
  console.log(JSON.stringify({ event: 'whatsapp_inbound', request_id: requestId, recorded: messages.length, dispositions }));
  return json({ ok: true, request_id: requestId, recorded: messages.length }, 200);
});

function unauthorized(requestId: string, provider: Provider): Response {
  console.warn(JSON.stringify({ event: 'whatsapp_inbound_bad_signature', request_id: requestId, provider }));
  return json({ error: 'invalid_signature' }, 403);
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
