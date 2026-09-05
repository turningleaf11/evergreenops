// Signature verification and payload normalisation for the inbound webhook.
//
// Kept separate from index.ts so it is testable without a server: these are the
// parts that must be right, and "it looked right" is not a standard for the one
// public endpoint in the system.
//
// IMPORTANT — what a valid signature does and does not prove. It proves the
// request came from the provider. It proves nothing about WHO sent the message.
// Authorship is decided later by the sender allowlist in inbound_message_record.
// Conflating the two is how a public endpoint becomes an injection vector.

export type Provider = 'meta' | 'twilio';

export interface NormalizedMessage {
  externalId: string;
  from: string;
  body: string | null;
  media: Array<{ media_id: string; mime_type?: string; provider: Provider }>;
}

// Constant-time compare. A fast string !== leaks timing, and a webhook is
// exactly the endpoint someone gets unlimited attempts against.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(algorithm: 'SHA-256' | 'SHA-1', secret: string, message: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
}

// Meta sends sha256=<hex> over the RAW request body. It has to be the raw bytes
// as received — re-serialising parsed JSON changes whitespace and key order and
// the signature stops matching, which reads as an attack rather than a bug.
export async function verifyMetaSignature(header: string | null, rawBody: string, appSecret: string): Promise<boolean> {
  if (!header || !appSecret) return false;
  const [algorithm, provided] = header.split('=');
  if (algorithm !== 'sha256' || !provided) return false;
  return timingSafeEqual(toHex(await hmac('SHA-256', appSecret, rawBody)), provided.toLowerCase());
}

// Twilio signs base64(HMAC-SHA1(url + sorted form params)) with the auth token.
export async function verifyTwilioSignature(
  header: string | null,
  url: string,
  params: Record<string, string>,
  authToken: string,
): Promise<boolean> {
  if (!header || !authToken) return false;
  const payload = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const expected = btoa(String.fromCharCode(...new Uint8Array(await hmac('SHA-1', authToken, payload))));
  return timingSafeEqual(expected, header);
}

// E.164. Providers are inconsistent — Meta sends bare digits, Twilio prefixes
// "whatsapp:+1...". The allowlist is keyed on the normalised form, so a
// mismatch here silently means every message from a known sender is treated as
// coming from a stranger.
export function normalizePhone(raw: string): string {
  const stripped = raw.replace(/^whatsapp:/i, '').replace(/[^\d+]/g, '');
  return stripped.startsWith('+') ? stripped : `+${stripped}`;
}

// Meta batches: entry[] -> changes[] -> value.messages[]. The same payload also
// carries delivery receipts under value.statuses, which are not messages and
// must not become seeds.
export function parseMetaPayload(payload: unknown): NormalizedMessage[] {
  const out: NormalizedMessage[] = [];
  const body = payload as Record<string, any>;
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      for (const message of change?.value?.messages ?? []) {
        if (!message?.id || !message?.from) continue;
        const media: NormalizedMessage['media'] = [];
        for (const kind of ['image', 'video', 'audio', 'document'] as const) {
          const item = message[kind];
          if (item?.id) media.push({ media_id: String(item.id), mime_type: item.mime_type, provider: 'meta' });
        }
        const caption = message.image?.caption ?? message.video?.caption ?? message.document?.caption ?? null;
        out.push({
          externalId: String(message.id),
          from: normalizePhone(String(message.from)),
          body: message.text?.body ?? caption ?? null,
          media,
        });
      }
    }
  }
  return out;
}

export function parseTwilioPayload(params: Record<string, string>): NormalizedMessage[] {
  const externalId = params.MessageSid ?? params.SmsSid;
  const from = params.From;
  if (!externalId || !from) return [];
  const media: NormalizedMessage['media'] = [];
  const count = Number(params.NumMedia ?? '0');
  for (let i = 0; i < (Number.isFinite(count) ? count : 0); i++) {
    const url = params[`MediaUrl${i}`];
    if (url) media.push({ media_id: url, mime_type: params[`MediaContentType${i}`], provider: 'twilio' });
  }
  return [{
    externalId: String(externalId),
    from: normalizePhone(String(from)),
    body: params.Body?.trim() ? params.Body : null,
    media,
  }];
}
