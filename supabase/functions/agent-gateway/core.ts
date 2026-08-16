export const ALLOWED_ACTIONS = [
  'system.whoami',
  'email.list',
  'email.search',
  'email.read',
  'email.get_attachment',
] as const;

export type GatewayAction = typeof ALLOWED_ACTIONS[number];

export interface GatewayRequest {
  action: GatewayAction;
  input: Record<string, unknown>;
}

export class RequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequestValidationError';
  }
}

export function parseBearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) return null;
  const token = match[1];
  return token.length >= 32 && token.length <= 512 ? token : null;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function parseGatewayRequest(value: unknown): GatewayRequest {
  if (!isRecord(value)) throw new RequestValidationError('Body must be a JSON object');
  if (typeof value.action !== 'string' || !ALLOWED_ACTIONS.includes(value.action as GatewayAction)) {
    throw new RequestValidationError('Unsupported action');
  }

  const input = value.input === undefined ? {} : value.input;
  if (!isRecord(input)) throw new RequestValidationError('input must be a JSON object');

  switch (value.action as GatewayAction) {
    case 'system.whoami':
      return { action: 'system.whoami', input: {} };

    case 'email.list':
      return {
        action: 'email.list',
        input: {
          max_results: optionalInteger(input.max_results, 'max_results', 1, 50) ?? 50,
          page_token: optionalPageToken(input.page_token),
          after_epoch_seconds:
            optionalInteger(input.after_epoch_seconds, 'after_epoch_seconds', 0, Number.MAX_SAFE_INTEGER) ?? null,
        },
      };

    case 'email.search': {
      const query = requiredString(input.query, 'query', 1, 500);
      return {
        action: 'email.search',
        input: {
          query,
          max_results: optionalInteger(input.max_results, 'max_results', 1, 50) ?? 50,
          page_token: optionalPageToken(input.page_token),
        },
      };
    }

    case 'email.read':
      return {
        action: 'email.read',
        input: { thread_id: gmailId(input.thread_id, 'thread_id') },
      };

    case 'email.get_attachment':
      return {
        action: 'email.get_attachment',
        input: {
          message_id: gmailId(input.message_id, 'message_id'),
          attachment_id: gmailId(input.attachment_id, 'attachment_id'),
        },
      };
  }
}

export function summarizeGatewayInput(request: GatewayRequest): {
  inputSummary: Record<string, unknown>;
  resourceType: string | null;
  resourceId: string | null;
} {
  switch (request.action) {
    case 'system.whoami':
      return { inputSummary: {}, resourceType: 'agent', resourceId: null };
    case 'email.list':
      return {
        inputSummary: {
          max_results: request.input.max_results,
          has_page_token: Boolean(request.input.page_token),
          after_epoch_seconds: request.input.after_epoch_seconds,
        },
        resourceType: 'gmail_message_list',
        resourceId: null,
      };
    case 'email.search':
      return {
        inputSummary: {
          query_length: String(request.input.query).length,
          max_results: request.input.max_results,
          has_page_token: Boolean(request.input.page_token),
        },
        resourceType: 'gmail_search',
        resourceId: null,
      };
    case 'email.read':
      return {
        inputSummary: {},
        resourceType: 'gmail_thread',
        resourceId: String(request.input.thread_id),
      };
    case 'email.get_attachment':
      return {
        inputSummary: { message_id: request.input.message_id },
        resourceType: 'gmail_attachment',
        resourceId: String(request.input.attachment_id),
      };
  }
}

export function selectedHeaders(headers: unknown): Record<string, string> {
  const allowed = new Set([
    'from', 'to', 'cc', 'delivered-to', 'subject', 'date', 'message-id',
  ]);
  const result: Record<string, string> = {};
  if (!Array.isArray(headers)) return result;

  for (const header of headers) {
    if (!isRecord(header)) continue;
    const name = String(header.name ?? '').toLowerCase();
    if (allowed.has(name)) result[name] = String(header.value ?? '');
  }
  return result;
}

export function extractBody(payload: unknown, mimeType: string): string {
  if (!isRecord(payload)) return '';
  if (
    payload.mimeType === mimeType &&
    isRecord(payload.body) &&
    typeof payload.body.data === 'string'
  ) {
    return decodeBase64Url(payload.body.data);
  }

  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const value = extractBody(part, mimeType);
      if (value) return value;
    }
  }
  return '';
}

export function extractAttachments(
  payload: unknown,
  output: Array<Record<string, unknown>> = [],
): Array<Record<string, unknown>> {
  if (!isRecord(payload)) return output;
  if (
    typeof payload.filename === 'string' &&
    payload.filename &&
    isRecord(payload.body) &&
    typeof payload.body.attachmentId === 'string'
  ) {
    output.push({
      filename: payload.filename,
      mime_type: typeof payload.mimeType === 'string'
        ? payload.mimeType
        : 'application/octet-stream',
      size: typeof payload.body.size === 'number' ? payload.body.size : null,
      attachment_id: payload.body.attachmentId,
    });
  }

  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) extractAttachments(part, output);
  }
  return output;
}

export function safeSourceIp(value: string | null): string | null {
  if (!value) return null;
  const candidate = value.split(',')[0].trim();
  return /^[0-9a-fA-F:.]{3,45}$/.test(candidate) ? candidate : null;
}

function decodeBase64Url(value: string): string {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normalized);
    return new TextDecoder().decode(
      Uint8Array.from(binary, (character) => character.charCodeAt(0)),
    );
  } catch {
    return '';
  }
}

function gmailId(value: unknown, field: string): string {
  const result = requiredString(value, field, 1, 512);
  if (!/^[A-Za-z0-9_-]+$/.test(result)) {
    throw new RequestValidationError(`${field} is invalid`);
  }
  return result;
}

function optionalPageToken(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const result = requiredString(value, 'page_token', 1, 2048);
  if (!/^[A-Za-z0-9_-]+$/.test(result)) {
    throw new RequestValidationError('page_token is invalid');
  }
  return result;
}

function requiredString(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): string {
  if (typeof value !== 'string') {
    throw new RequestValidationError(`${field} must be a string`);
  }
  const result = value.trim();
  if (result.length < minimum || result.length > maximum) {
    throw new RequestValidationError(
      `${field} must be between ${minimum} and ${maximum} characters`,
    );
  }
  return result;
}

function optionalInteger(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new RequestValidationError(
      `${field} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return Number(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
