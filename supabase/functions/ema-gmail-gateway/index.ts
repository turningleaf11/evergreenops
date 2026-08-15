import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { refreshAccessToken } from '../_shared/gmail.ts';

const ALLOWED_ACCOUNT = 'office@evergreenhomegroup.com';
const MAX_RESULTS = 50;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

type GatewayRequest =
  | { action: 'list_messages'; page_token?: string; after_epoch_seconds?: number }
  | { action: 'get_thread'; thread_id: string }
  | { action: 'get_attachment'; message_id: string; attachment_id: string };

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  if (req.method !== 'POST') return json({ error: 'Method not allowed', request_id: requestId }, 405);

  const expectedSecret = Deno.env.get('EMA_GMAIL_GATEWAY_SECRET');
  const suppliedSecret = bearerToken(req.headers.get('Authorization'));
  if (!expectedSecret || !suppliedSecret || !safeEqual(suppliedSecret, expectedSecret)) {
    audit(requestId, 'unauthorized', undefined, 401, startedAt);
    return json({ error: 'Unauthorized', request_id: requestId }, 401);
  }

  let body: GatewayRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON', request_id: requestId }, 400);
  }

  try {
    const ctx = await getEmaGmailContext();
    let result: Record<string, unknown>;

    switch (body.action) {
      case 'list_messages':
        result = await listMessages(ctx.accessToken, body);
        break;
      case 'get_thread':
        if (!isGmailId(body.thread_id)) throw new GatewayError(400, 'Invalid thread_id');
        result = await getThread(ctx.accessToken, body.thread_id);
        break;
      case 'get_attachment':
        if (!isGmailId(body.message_id) || !isGmailId(body.attachment_id)) {
          throw new GatewayError(400, 'Invalid attachment identifiers');
        }
        result = await getAttachment(ctx.accessToken, body.message_id, body.attachment_id);
        break;
      default:
        throw new GatewayError(400, 'Unsupported action');
    }

    audit(requestId, 'success', body.action, 200, startedAt);
    return json({ request_id: requestId, account: ctx.email, ...result });
  } catch (error) {
    const status = error instanceof GatewayError ? error.status : 500;
    const message = error instanceof GatewayError ? error.message : 'Internal gateway error';
    audit(requestId, 'error', body?.action, status, startedAt, error);
    return json({ error: message, request_id: requestId }, status);
  }
});

async function getEmaGmailContext(): Promise<{ accessToken: string; email: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const accountName = (Deno.env.get('EMA_GMAIL_ACCOUNT') ?? ALLOWED_ACCOUNT).trim().toLowerCase();
  if (!supabaseUrl || !serviceRoleKey) throw new GatewayError(500, 'Gateway is not configured');
  if (accountName !== ALLOWED_ACCOUNT) throw new GatewayError(500, 'Gateway mailbox is not allowed');

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: account, error: accountError } = await admin
    .from('gmail_workspace_account')
    .select('email, refresh_token_secret_id')
    .ilike('email', ALLOWED_ACCOUNT)
    .is('revoked_at', null)
    .maybeSingle();

  if (accountError) throw new GatewayError(500, 'Could not resolve Gmail account');
  if (!account) throw new GatewayError(503, 'Office Gmail account is not connected');

  const { data: token, error: tokenError } = await admin
    .from('gmail_tokens')
    .select('refresh_token')
    .eq('id', account.refresh_token_secret_id)
    .single();

  if (tokenError || !token?.refresh_token) throw new GatewayError(503, 'Office Gmail token is unavailable');
  const accessToken = await refreshAccessToken(token.refresh_token);
  if (!accessToken) throw new GatewayError(401, 'Office Gmail authorization must be renewed');
  return { accessToken, email: account.email };
}

async function listMessages(
  accessToken: string,
  input: Extract<GatewayRequest, { action: 'list_messages' }>,
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams({ maxResults: String(MAX_RESULTS), labelIds: 'INBOX' });
  if (input.page_token) params.set('pageToken', input.page_token);
  if (input.after_epoch_seconds !== undefined) {
    if (!Number.isSafeInteger(input.after_epoch_seconds) || input.after_epoch_seconds < 0) {
      throw new GatewayError(400, 'Invalid after_epoch_seconds');
    }
    params.set('q', `after:${input.after_epoch_seconds}`);
  }

  const listed = await google(accessToken, `/messages?${params}`);
  const messages = await Promise.all((listed.messages ?? []).map(async (item: { id: string }) => {
    const metadata = await google(
      accessToken,
      `/messages/${encodeURIComponent(item.id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Delivered-To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID`,
    );
    return summarizeMessage(metadata);
  }));

  return {
    messages,
    next_page_token: listed.nextPageToken ?? null,
    result_size_estimate: listed.resultSizeEstimate ?? null,
  };
}

async function getThread(accessToken: string, threadId: string): Promise<Record<string, unknown>> {
  const thread = await google(accessToken, `/threads/${encodeURIComponent(threadId)}?format=full`);
  return {
    thread: {
      id: thread.id,
      history_id: thread.historyId ?? null,
      messages: (thread.messages ?? []).map(normalizeFullMessage),
    },
  };
}

async function getAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<Record<string, unknown>> {
  const attachment = await google(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
  );
  const size = Number(attachment.size ?? 0);
  if (size > MAX_ATTACHMENT_BYTES) throw new GatewayError(413, 'Attachment exceeds the 25 MB gateway limit');
  return { attachment: { data_base64url: attachment.data ?? '', size } };
}

async function google(accessToken: string, path: string): Promise<any> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    console.error(JSON.stringify({ event: 'ema_gmail_google_error', status: response.status }));
    throw new GatewayError(response.status === 404 ? 404 : 502, 'Gmail request failed');
  }
  return response.json();
}

function summarizeMessage(message: any) {
  return {
    id: message.id,
    thread_id: message.threadId,
    history_id: message.historyId ?? null,
    internal_date: message.internalDate ?? null,
    label_ids: message.labelIds ?? [],
    snippet: message.snippet ?? '',
    headers: selectedHeaders(message.payload?.headers),
  };
}

function normalizeFullMessage(message: any) {
  return {
    ...summarizeMessage(message),
    body_text: extractBody(message.payload, 'text/plain'),
    body_html: extractBody(message.payload, 'text/html'),
    attachments: extractAttachments(message.payload),
  };
}

function selectedHeaders(headers: any[] | undefined): Record<string, string> {
  const allowed = new Set(['from', 'to', 'cc', 'delivered-to', 'subject', 'date', 'message-id']);
  const out: Record<string, string> = {};
  for (const header of headers ?? []) {
    const name = String(header.name ?? '').toLowerCase();
    if (allowed.has(name)) out[name] = String(header.value ?? '');
  }
  return out;
}

function extractBody(payload: any, mimeType: string): string {
  if (!payload) return '';
  if (payload.mimeType === mimeType && payload.body?.data) return decodeBase64Url(payload.body.data);
  for (const part of payload.parts ?? []) {
    const value = extractBody(part, mimeType);
    if (value) return value;
  }
  return '';
}

function extractAttachments(payload: any, out: any[] = []): any[] {
  if (!payload) return out;
  if (payload.filename && payload.body?.attachmentId) {
    out.push({
      filename: payload.filename,
      mime_type: payload.mimeType ?? 'application/octet-stream',
      size: payload.body.size ?? null,
      attachment_id: payload.body.attachmentId,
    });
  }
  for (const part of payload.parts ?? []) extractAttachments(part, out);
  return out;
}

function decodeBase64Url(value: string): string {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normalized);
    return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  } catch {
    return '';
  }
}

function bearerToken(header: string | null): string | null {
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

function isGmailId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,512}$/.test(value);
}

function audit(
  requestId: string,
  outcome: string,
  action: string | undefined,
  status: number,
  startedAt: number,
  error?: unknown,
) {
  console.info(JSON.stringify({
    event: 'ema_gmail_gateway',
    request_id: requestId,
    agent_name: 'ema',
    action: action ?? null,
    outcome,
    status,
    duration_ms: Date.now() - startedAt,
    error_type: error instanceof Error ? error.name : null,
  }));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

class GatewayError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'GatewayError';
  }
}
