import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  normalizePhone,
  parseMetaPayload,
  parseTwilioPayload,
  timingSafeEqual,
  verifyMetaSignature,
  verifyTwilioSignature,
} from './verify.ts';

const SECRET = 'app-secret-value';

async function metaSignatureFor(body: string, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return 'sha256=' + [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.test('a genuine Meta signature is accepted', async () => {
  const body = '{"entry":[]}';
  assertEquals(await verifyMetaSignature(await metaSignatureFor(body), body, SECRET), true);
});

Deno.test('a forged or altered Meta request is refused', async () => {
  const body = '{"entry":[]}';
  const good = await metaSignatureFor(body);
  // Right signature, tampered body — the case that matters.
  assertEquals(await verifyMetaSignature(good, '{"entry":[{"evil":true}]}', SECRET), false);
  // Right body, wrong secret.
  assertEquals(await verifyMetaSignature(await metaSignatureFor(body, 'not-the-secret'), body, SECRET), false);
  // Missing, malformed, and downgraded-algorithm headers.
  assertEquals(await verifyMetaSignature(null, body, SECRET), false);
  assertEquals(await verifyMetaSignature('garbage', body, SECRET), false);
  assertEquals(await verifyMetaSignature('sha1=abc', body, SECRET), false);
  // No configured secret must never mean "allow".
  assertEquals(await verifyMetaSignature(good, body, ''), false);
});

Deno.test('Twilio signatures are verified over url plus sorted params', async () => {
  const url = 'https://example.supabase.co/functions/v1/whatsapp-inbound';
  const params = { From: 'whatsapp:+13055550101', Body: 'carbonara', MessageSid: 'SM1' };
  const token = 'twilio-token';
  const payload = url + Object.keys(params).sort().map((k) => k + (params as Record<string, string>)[k]).join('');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(token), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const expected = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))));

  assertEquals(await verifyTwilioSignature(expected, url, params, token), true);
  assertEquals(await verifyTwilioSignature(expected, url, { ...params, Body: 'something else' }, token), false);
  assertEquals(await verifyTwilioSignature(expected, url, params, 'wrong-token'), false);
  assertEquals(await verifyTwilioSignature(null, url, params, token), false);
});

Deno.test('comparison is length-safe and value-correct', () => {
  assertEquals(timingSafeEqual('abc', 'abc'), true);
  assertEquals(timingSafeEqual('abc', 'abd'), false);
  assertEquals(timingSafeEqual('abc', 'abcd'), false);
  assertEquals(timingSafeEqual('', ''), true);
});

// The allowlist is keyed on the normalised form. Get this wrong and every
// message from a known sender is silently treated as coming from a stranger.
Deno.test('phone numbers normalise to E.164 across providers', () => {
  assertEquals(normalizePhone('13055550101'), '+13055550101');
  assertEquals(normalizePhone('+13055550101'), '+13055550101');
  assertEquals(normalizePhone('whatsapp:+13055550101'), '+13055550101');
  assertEquals(normalizePhone('whatsapp:+1 (305) 555-0101'), '+13055550101');
});

Deno.test('a Meta photo with a caption becomes one message with media', () => {
  const messages = parseMetaPayload({
    entry: [{
      changes: [{
        value: {
          messages: [{
            id: 'wamid.1',
            from: '13055550101',
            type: 'image',
            image: { id: 'media-1', mime_type: 'image/jpeg', caption: 'first time it worked' },
          }],
        },
      }],
    }],
  });
  assertEquals(messages.length, 1);
  assertEquals(messages[0].externalId, 'wamid.1');
  assertEquals(messages[0].from, '+13055550101');
  assertEquals(messages[0].body, 'first time it worked');
  assertEquals(messages[0].media[0].media_id, 'media-1');
});

// Delivery receipts arrive on the same webhook. Treating one as a message
// would create a seed out of an acknowledgement.
Deno.test('Meta delivery receipts are not messages', () => {
  assertEquals(parseMetaPayload({ entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'delivered' }] } }] }] }).length, 0);
  assertEquals(parseMetaPayload({}).length, 0);
  assertEquals(parseMetaPayload({ entry: [{ changes: [{ value: { messages: [{ from: '1305' }] } }] }] }).length, 0);
});

Deno.test('Meta batches every message in the payload', () => {
  const messages = parseMetaPayload({
    entry: [{
      changes: [{
        value: {
          messages: [
            { id: 'wamid.1', from: '13055550101', text: { body: 'one' } },
            { id: 'wamid.2', from: '13055550101', text: { body: 'two' } },
          ],
        },
      }],
    }],
  });
  assertEquals(messages.map((m) => m.externalId), ['wamid.1', 'wamid.2']);
});

Deno.test('Twilio media messages carry their urls', () => {
  const messages = parseTwilioPayload({
    MessageSid: 'SM1',
    From: 'whatsapp:+13055550101',
    Body: '',
    NumMedia: '2',
    MediaUrl0: 'https://api.twilio.com/m0',
    MediaContentType0: 'image/jpeg',
    MediaUrl1: 'https://api.twilio.com/m1',
  });
  assertEquals(messages.length, 1);
  assertEquals(messages[0].body, null);
  assertEquals(messages[0].media.length, 2);
  assertEquals(parseTwilioPayload({ Body: 'no sid' }).length, 0);
});
