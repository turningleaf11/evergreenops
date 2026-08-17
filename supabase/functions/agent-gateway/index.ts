import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { refreshAccessToken } from '../_shared/gmail.ts';
import {
  extractAttachments,
  extractBody,
  GatewayRequest,
  parseBearerToken,
  parseGatewayRequest,
  RequestValidationError,
  safeSourceIp,
  selectedHeaders,
  sha256Hex,
  summarizeGatewayInput,
} from './core.ts';

const DEFAULT_GMAIL_ACCOUNT = 'office@evergreenhomegroup.com';
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_REQUEST_BYTES = 64 * 1024;

interface AgentContext {
  credentialId: string;
  agentId: string;
  agentName: string;
  agentSlug: string;
  agentEnabled: boolean;
  workspaceId: string;
}

class GatewayError extends Error {
  constructor(
    public status: number,
    public code: string,
    message = code,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let context: AgentContext | null = null;
  let request: GatewayRequest | null = null;
  let operationId: string | null = null;

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed', request_id: requestId }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'gateway_not_configured', request_id: requestId }, 500);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const auth = await authenticate(admin, req);
    context = auth.context;

    if (auth.error) {
      if (context) {
        await writeAudit(admin, req, {
          requestId,
          context,
          action: 'system.authenticate',
          status: 'denied',
          httpStatus: auth.error.status,
          durationMs: Date.now() - startedAt,
          errorCode: auth.error.code,
        });
      } else {
        console.warn(JSON.stringify({
          event: 'agent_gateway_auth_denied',
          request_id: requestId,
          status: auth.error.status,
          error_code: auth.error.code,
        }));
      }
      return json({ error: auth.error.code, request_id: requestId }, auth.error.status);
    }

    if (!context) throw new GatewayError(401, 'invalid_credentials');

    request = await readAndValidateRequest(req);

    if (!context.agentEnabled) {
      throw new GatewayError(403, 'agent_disabled');
    }

    const permission = await getPermission(admin, context.agentId, request.action);
    if (!permission) {
      throw new GatewayError(403, 'action_not_permitted');
    }

    const rateLimit = await consumeRateLimit(
      admin,
      context.credentialId,
      request.action,
      permission.rate_limit_per_minute,
    );
    if (!rateLimit.allowed) {
      await writeAudit(admin, req, {
        requestId,
        context,
        action: request.action,
        status: 'rate_limited',
        httpStatus: 429,
        durationMs: Date.now() - startedAt,
        errorCode: 'rate_limit_exceeded',
        request,
      });
      return json({
        error: 'rate_limit_exceeded',
        request_id: requestId,
        retry_after_seconds: rateLimit.retryAfterSeconds,
      }, 429, { 'Retry-After': String(rateLimit.retryAfterSeconds) });
    }

    const payloadHash = await sha256Hex(JSON.stringify(request));
    const { data: operation, error: operationError } = await admin
      .from('agent_gateway_operations')
      .insert({
        request_id: requestId,
        workspace_id: context.workspaceId,
        agent_id: context.agentId,
        credential_id: context.credentialId,
        action: request.action,
        payload_hash: payloadHash,
        status: 'authorized',
      })
      .select('id')
      .single();
    if (operationError || !operation) {
      throw new GatewayError(500, 'operation_record_failed');
    }
    operationId = operation.id;

    const result = await dispatch(admin, context, request);

    const { error: operationUpdateError } = await admin
      .from('agent_gateway_operations')
      .update({ status: 'succeeded' })
      .eq('id', operationId);
    if (operationUpdateError) throw new GatewayError(500, 'operation_update_failed');

    const auditWritten = await writeAudit(admin, req, {
      requestId,
      operationId,
      context,
      action: request.action,
      status: 'succeeded',
      httpStatus: 200,
      durationMs: Date.now() - startedAt,
      request,
    });
    if (!auditWritten) throw new GatewayError(500, 'audit_write_failed');

    return json({
      ok: true,
      request_id: requestId,
      action: request.action,
      untrusted_external_content: request.action.startsWith('email.'),
      data: result,
    });
  } catch (error) {
    const gatewayError = normalizeError(error);

    if (operationId) {
      await admin
        .from('agent_gateway_operations')
        .update({
          status: 'failed',
          error_code: gatewayError.code,
          error_summary: gatewayError.message,
        })
        .eq('id', operationId);
    }

    if (context) {
      await writeAudit(admin, req, {
        requestId,
        operationId,
        context,
        action: request?.action ?? 'system.invalid_request',
        status: gatewayError.status === 429 ? 'rate_limited' : gatewayError.status === 403 ? 'denied' : 'failed',
        httpStatus: gatewayError.status,
        durationMs: Date.now() - startedAt,
        errorCode: gatewayError.code,
        errorSummary: gatewayError.message,
        request,
      });
    }

    return json({
      error: gatewayError.code,
      request_id: requestId,
    }, gatewayError.status);
  }
});

async function authenticate(
  admin: SupabaseClient,
  req: Request,
): Promise<{
  context: AgentContext | null;
  error?: { status: number; code: string };
}> {
  const rawToken = parseBearerToken(req.headers.get('Authorization'));
  if (!rawToken) {
    return { context: null, error: { status: 401, code: 'invalid_credentials' } };
  }

  const tokenHash = await sha256Hex(rawToken);
  const { data: credential, error } = await admin
    .from('agent_api_credentials')
    .select('id, agent_id, workspace_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !credential) {
    return { context: null, error: { status: 401, code: 'invalid_credentials' } };
  }

  const { data: agent, error: agentError } = await admin
    .from('agents')
    .select('id, name, slug, enabled')
    .eq('id', credential.agent_id)
    .maybeSingle();

  if (agentError || !agent) {
    return { context: null, error: { status: 401, code: 'invalid_credentials' } };
  }

  const context: AgentContext = {
    credentialId: credential.id,
    agentId: agent.id,
    agentName: agent.name,
    agentSlug: agent.slug,
    agentEnabled: agent.enabled,
    workspaceId: credential.workspace_id,
  };

  if (credential.revoked_at) {
    return { context, error: { status: 401, code: 'credential_revoked' } };
  }
  if (credential.expires_at && new Date(credential.expires_at).getTime() <= Date.now()) {
    return { context, error: { status: 401, code: 'credential_expired' } };
  }

  await admin
    .from('agent_api_credentials')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', credential.id);

  return { context };
}

async function readAndValidateRequest(req: Request): Promise<GatewayRequest> {
  const contentType = req.headers.get('Content-Type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new GatewayError(415, 'content_type_must_be_json');
  }

  const declaredLength = Number(req.headers.get('Content-Length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    throw new GatewayError(413, 'request_too_large');
  }

  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > MAX_REQUEST_BYTES) {
    throw new GatewayError(413, 'request_too_large');
  }

  try {
    return parseGatewayRequest(JSON.parse(raw));
  } catch (error) {
    if (error instanceof RequestValidationError) {
      throw new GatewayError(400, 'invalid_request', error.message);
    }
    throw new GatewayError(400, 'invalid_json');
  }
}

async function getPermission(
  admin: SupabaseClient,
  agentId: string,
  action: string,
): Promise<{ rate_limit_per_minute: number } | null> {
  const { data, error } = await admin
    .from('agent_permissions')
    .select('rate_limit_per_minute')
    .eq('agent_id', agentId)
    .eq('action', action)
    .eq('enabled', true)
    .maybeSingle();

  if (error) throw new GatewayError(500, 'permission_check_failed');
  return data;
}

async function consumeRateLimit(
  admin: SupabaseClient,
  credentialId: string,
  action: string,
  maximum: number,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const { data, error } = await admin
    .rpc('agent_gateway_consume_rate_limit', {
      _credential_id: credentialId,
      _action: action,
      _max_requests: maximum,
      _window_seconds: 60,
    })
    .single();

  if (error || !data) throw new GatewayError(500, 'rate_limit_check_failed');
  const result = data as { allowed: boolean; reset_at: string };
  const resetAt = new Date(result.reset_at).getTime();
  return {
    allowed: Boolean(result.allowed),
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
  };
}

async function dispatch(
  admin: SupabaseClient,
  context: AgentContext,
  request: GatewayRequest,
): Promise<Record<string, unknown>> {
  if (request.action === 'system.whoami') {
    return {
      agent: {
        id: context.agentId,
        slug: context.agentSlug,
        name: context.agentName,
      },
      workspace_id: context.workspaceId,
    };
  }

  const gmailContext = await resolveGmailContext(admin, context.workspaceId);

  switch (request.action) {
    case 'email.list':
      return listMessages(gmailContext.accessToken, gmailContext.email, request.input, true);
    case 'email.search':
      return listMessages(gmailContext.accessToken, gmailContext.email, request.input, false);
    case 'email.read':
      return getThread(gmailContext.accessToken, String(request.input.thread_id));
    case 'email.get_attachment':
      return getAttachment(
        gmailContext.accessToken,
        String(request.input.message_id),
        String(request.input.attachment_id),
      );
    default:
      throw new GatewayError(400, 'unsupported_action');
  }
}

async function resolveGmailContext(
  admin: SupabaseClient,
  workspaceId: string,
): Promise<{ accessToken: string; email: string }> {
  const accountName = (
    Deno.env.get('AGENT_GATEWAY_GMAIL_ACCOUNT') ?? DEFAULT_GMAIL_ACCOUNT
  ).trim().toLowerCase();

  const { data: account, error: accountError } = await admin
    .from('gmail_workspace_account')
    .select('email, refresh_token_secret_id')
    .eq('workspace_id', workspaceId)
    .ilike('email', accountName)
    .is('revoked_at', null)
    .maybeSingle();

  if (accountError) throw new GatewayError(500, 'gmail_account_lookup_failed');
  if (!account) throw new GatewayError(503, 'gmail_account_not_connected');

  const { data: token, error: tokenError } = await admin
    .from('gmail_tokens')
    .select('refresh_token')
    .eq('workspace_id', workspaceId)
    .eq('id', account.refresh_token_secret_id)
    .maybeSingle();

  if (tokenError || !token?.refresh_token) {
    throw new GatewayError(503, 'gmail_token_unavailable');
  }

  const accessToken = await refreshAccessToken(token.refresh_token);
  if (!accessToken) throw new GatewayError(503, 'gmail_reauth_required');
  return { accessToken, email: account.email };
}

async function listMessages(
  accessToken: string,
  accountEmail: string,
  input: Record<string, unknown>,
  inboxOnly: boolean,
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams({
    maxResults: String(input.max_results),
  });
  if (inboxOnly) params.set('labelIds', 'INBOX');
  if (input.page_token) params.set('pageToken', String(input.page_token));

  if (inboxOnly && input.after_epoch_seconds !== null) {
    params.set('q', `after:${input.after_epoch_seconds}`);
  } else if (!inboxOnly) {
    params.set('q', String(input.query));
  }

  const listed = await google(accessToken, `/messages?${params.toString()}`);
  const messages = await Promise.all(
    (listed.messages ?? []).map(async (item: { id: string }) => {
      const metadata = await google(
        accessToken,
        `/messages/${encodeURIComponent(item.id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Delivered-To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID`,
      );
      return summarizeMessage(metadata);
    }),
  );

  return {
    account: accountEmail,
    messages,
    next_page_token: listed.nextPageToken ?? null,
    result_size_estimate: listed.resultSizeEstimate ?? null,
  };
}

async function getThread(
  accessToken: string,
  threadId: string,
): Promise<Record<string, unknown>> {
  const thread = await google(
    accessToken,
    `/threads/${encodeURIComponent(threadId)}?format=full`,
  );
  return {
    thread: {
      id: thread.id,
      history_id: thread.historyId ?? null,
      messages: (thread.messages ?? []).map((message: unknown) => normalizeMessage(message)),
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
  if (!Number.isFinite(size) || size < 0) {
    throw new GatewayError(502, 'invalid_gmail_attachment');
  }
  if (size > MAX_ATTACHMENT_BYTES) {
    throw new GatewayError(413, 'attachment_too_large');
  }
  return {
    attachment: {
      data_base64url: typeof attachment.data === 'string' ? attachment.data : '',
      size,
    },
  };
}

async function google(accessToken: string, path: string): Promise<any> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me${path}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20_000),
    },
  );

  if (!response.ok) {
    console.error(JSON.stringify({
      event: 'agent_gateway_google_error',
      status: response.status,
    }));
    if (response.status === 404) throw new GatewayError(404, 'gmail_resource_not_found');
    if (response.status === 401 || response.status === 403) {
      throw new GatewayError(503, 'gmail_reauth_required');
    }
    if (response.status === 429) throw new GatewayError(503, 'gmail_rate_limited');
    throw new GatewayError(502, 'gmail_request_failed');
  }
  return response.json();
}

function summarizeMessage(message: any): Record<string, unknown> {
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

function normalizeMessage(message: any): Record<string, unknown> {
  return {
    ...summarizeMessage(message),
    body_text: extractBody(message.payload, 'text/plain'),
    body_html: extractBody(message.payload, 'text/html'),
    attachments: extractAttachments(message.payload),
  };
}

async function writeAudit(
  admin: SupabaseClient,
  req: Request,
  event: {
    requestId: string;
    operationId?: string | null;
    context: AgentContext;
    action: string;
    status: 'succeeded' | 'denied' | 'rate_limited' | 'failed';
    httpStatus: number;
    durationMs: number;
    request?: GatewayRequest | null;
    errorCode?: string;
    errorSummary?: string;
  },
): Promise<boolean> {
  const summary = event.request
    ? summarizeGatewayInput(event.request)
    : { inputSummary: {}, resourceType: null, resourceId: null };

  const { error } = await admin.from('agent_audit_log').insert({
    request_id: event.requestId,
    operation_id: event.operationId ?? null,
    workspace_id: event.context.workspaceId,
    agent_id: event.context.agentId,
    credential_id: event.context.credentialId,
    action: event.action,
    resource_type: summary.resourceType,
    resource_id: summary.resourceId,
    status: event.status,
    http_status: event.httpStatus,
    duration_ms: Math.max(0, event.durationMs),
    input_summary: summary.inputSummary,
    error_code: event.errorCode ?? null,
    error_summary: event.errorSummary?.slice(0, 500) ?? null,
    source_ip: safeSourceIp(
      req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for'),
    ),
    user_agent: req.headers.get('user-agent')?.slice(0, 512) ?? null,
  });

  if (error) {
    console.error(JSON.stringify({
      event: 'agent_gateway_audit_error',
      request_id: event.requestId,
      error_code: error.code ?? null,
    }));
    return false;
  }
  return true;
}

function normalizeError(error: unknown): GatewayError {
  if (error instanceof GatewayError) return error;
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return new GatewayError(504, 'upstream_timeout');
  }
  console.error(JSON.stringify({
    event: 'agent_gateway_unhandled_error',
    error_type: error instanceof Error ? error.name : typeof error,
  }));
  return new GatewayError(500, 'internal_gateway_error');
}

function json(
  body: unknown,
  status = 200,
  additionalHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...additionalHeaders,
    },
  });
}
