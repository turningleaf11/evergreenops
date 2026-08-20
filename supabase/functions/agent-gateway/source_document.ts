import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { refreshAccessToken } from '../_shared/gmail.ts';
import { updateGhlOpportunity, type GhlContext } from '../_shared/ghl.ts';

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = 'v3';
const SOURCE_DOCUMENT_FIELD_ID = 'smOq4IoCpUby2DBlb21G';
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const MAX_DOCUMENTS = 8;

export class SourceDocumentError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
    this.name = 'SourceDocumentError';
  }
}

interface GmailMessageRow {
  gmailAccount: string;
  gmailMessageId: string;
}

interface GmailPart {
  filename?: string;
  mimeType?: string;
  body?: { attachmentId?: string; data?: string; size?: number };
  parts?: GmailPart[];
}

export interface DocumentDescriptor {
  filename: string;
  mimeType: string;
  attachmentId: string | null;
  inlineData: string | null;
  size: number | null;
}

interface UploadedDocument {
  url: string;
  name: string;
  mimetype: string;
  size: number;
  file_id: string | null;
}

interface OperationRow {
  id: string;
  operation_status: string;
  external_id: string | null;
  result_metadata: Record<string, unknown> | null;
}

export async function attachOriginalPdfDocuments(
  admin: SupabaseClient,
  ghl: GhlContext,
  workspaceId: string,
  candidateId: string,
  source: GmailMessageRow,
  opportunityId: string,
): Promise<Record<string, unknown>> {
  const operationKey = `ema:${candidateId}:source-documents:${source.gmailMessageId}:v2`;
  const prior = await getOperation(admin, workspaceId, operationKey);
  if (prior?.operation_status === 'succeeded') {
    return {
      status: 'persisted',
      field_id: SOURCE_DOCUMENT_FIELD_ID,
      ...(isRecord(prior.result_metadata) ? prior.result_metadata : {}),
    };
  }
  if (prior && ['executing', 'needs_reconciliation'].includes(prior.operation_status)) {
    throw new SourceDocumentError(409, 'source_document_requires_reconciliation');
  }

  const normalizedAddress = await loadCandidateAddress(admin, workspaceId, candidateId);
  const accessToken = await resolveGmailAccessToken(admin, workspaceId, source.gmailAccount);
  const gmailMessage = await gmailJson(
    accessToken,
    `/messages/${encodeURIComponent(source.gmailMessageId)}?format=full`,
  );
  const payload = isRecord(gmailMessage.payload) ? gmailMessage.payload as GmailPart : {};
  const discovered = collectPdfAttachments(payload).slice(0, MAX_DOCUMENTS);
  if (!discovered.length) {
    return { status: 'not_present', field_id: SOURCE_DOCUMENT_FIELD_ID, files: [] };
  }

  const descriptors = selectPdfAttachmentsForCandidate(discovered, normalizedAddress);
  const previousKey = `ema:${candidateId}:source-documents:${source.gmailMessageId}:v1`;
  const previous = await getOperation(admin, workspaceId, previousKey);
  const reusable = reusableUploads(previous, descriptors);

  const op = await beginOperation(admin, workspaceId, candidateId, operationKey);
  try {
    const uploaded = reusable ?? await uploadDescriptors(ghl, accessToken, source.gmailMessageId, descriptors);
    const fieldValue = uploaded.map((file) => ({
      url: file.url,
      deleted: false,
      meta: {
        size: file.size,
        name: file.name,
        mimetype: file.mimetype,
      },
    }));

    await updateGhlOpportunity(ghl, opportunityId, {
      customFields: [{ id: SOURCE_DOCUMENT_FIELD_ID, fieldValue }],
    });

    const resultMetadata = {
      field_id: SOURCE_DOCUMENT_FIELD_ID,
      discovered_file_count: discovered.length,
      file_count: uploaded.length,
      selection: discovered.length === 1 ? 'single_pdf' : 'candidate_matched',
      reused_existing_uploads: reusable !== null,
      files: uploaded.map((file) => ({
        name: file.name,
        mimetype: file.mimetype,
        size: file.size,
        url: file.url,
        file_id: file.file_id,
      })),
    };
    await finishOperation(admin, op.id, opportunityId, resultMetadata);
    return { status: 'attached', ...resultMetadata };
  } catch (error) {
    await markOperationUncertain(admin, op.id, error);
    throw error;
  }
}

export function collectPdfAttachments(payload: GmailPart): DocumentDescriptor[] {
  const out: DocumentDescriptor[] = [];
  walk(payload, out);
  return out;
}

/**
 * If an email has multiple PDFs, never assume they all belong to one property.
 * Address-named PDFs are matched to the candidate street address. Explicit
 * portfolio package documents (OM/Rent Roll/T12/P&L) may travel with that
 * matched property. If nothing can be associated safely, fail closed.
 */
export function selectPdfAttachmentsForCandidate(
  descriptors: DocumentDescriptor[],
  normalizedAddress: string,
): DocumentDescriptor[] {
  if (descriptors.length <= 1) return descriptors;

  const streetKey = normalizeName(normalizedAddress.split(',')[0] ?? '');
  if (!streetKey) throw new SourceDocumentError(409, 'source_document_candidate_match_ambiguous');

  const addressMatches = descriptors.filter((doc) => normalizeName(doc.filename).includes(streetKey));
  const packageDocs = descriptors.filter((doc) => isPortfolioPackageFilename(doc.filename));

  if (addressMatches.length) {
    const selected = new Map<string, DocumentDescriptor>();
    for (const doc of [...addressMatches, ...packageDocs]) selected.set(documentIdentity(doc), doc);
    return [...selected.values()];
  }

  if (packageDocs.length === descriptors.length) return descriptors;
  throw new SourceDocumentError(409, 'source_document_candidate_match_ambiguous');
}

function walk(part: GmailPart, out: DocumentDescriptor[]): void {
  const filename = typeof part.filename === 'string' ? part.filename.trim() : '';
  const mimeType = typeof part.mimeType === 'string' ? part.mimeType : 'application/octet-stream';
  const isPdf = mimeType.toLowerCase() === 'application/pdf' || /\.pdf$/i.test(filename);
  if (filename && isPdf && part.body) {
    const size = typeof part.body.size === 'number' && Number.isFinite(part.body.size)
      ? part.body.size
      : null;
    out.push({
      filename: filename.slice(0, 500),
      mimeType: 'application/pdf',
      attachmentId: typeof part.body.attachmentId === 'string' ? part.body.attachmentId : null,
      inlineData: typeof part.body.data === 'string' ? part.body.data : null,
      size,
    });
  }
  for (const child of part.parts ?? []) walk(child, out);
}

async function loadCandidateAddress(
  admin: SupabaseClient,
  workspaceId: string,
  candidateId: string,
): Promise<string> {
  const { data, error } = await admin.from('ema_candidates')
    .select('normalized_address')
    .eq('workspace_id', workspaceId)
    .eq('id', candidateId)
    .maybeSingle();
  if (error) throw new SourceDocumentError(500, 'candidate_lookup_failed');
  const address = typeof data?.normalized_address === 'string' ? data.normalized_address.trim() : '';
  if (!address) throw new SourceDocumentError(409, 'normalized_address_required');
  return address;
}

async function uploadDescriptors(
  ghl: GhlContext,
  accessToken: string,
  gmailMessageId: string,
  descriptors: DocumentDescriptor[],
): Promise<UploadedDocument[]> {
  const uploaded: UploadedDocument[] = [];
  for (const descriptor of descriptors) {
    const bytes = descriptor.inlineData
      ? decodeBase64Url(descriptor.inlineData)
      : descriptor.attachmentId
      ? await fetchGmailAttachment(accessToken, gmailMessageId, descriptor.attachmentId)
      : null;
    if (!bytes) throw new SourceDocumentError(502, 'gmail_attachment_data_missing');
    if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw new SourceDocumentError(413, 'source_document_too_large');
    uploaded.push(await uploadGhlMediaFile(ghl, descriptor.filename, descriptor.mimeType, bytes));
  }
  return uploaded;
}

function reusableUploads(
  prior: OperationRow | null,
  descriptors: DocumentDescriptor[],
): UploadedDocument[] | null {
  if (prior?.operation_status !== 'succeeded' || !isRecord(prior.result_metadata)) return null;
  const files = recordArray(prior.result_metadata.files);
  const selected: UploadedDocument[] = [];
  for (const descriptor of descriptors) {
    const match = files.find((file) => file.name === descriptor.filename);
    if (!match || typeof match.url !== 'string' || !match.url.startsWith('https://')) return null;
    selected.push({
      url: match.url,
      name: descriptor.filename,
      mimetype: typeof match.mimetype === 'string' ? match.mimetype : 'application/pdf',
      size: typeof match.size === 'number' && Number.isFinite(match.size) ? match.size : descriptor.size ?? 0,
      file_id: typeof match.file_id === 'string' ? match.file_id : null,
    });
  }
  return selected;
}

async function resolveGmailAccessToken(
  admin: SupabaseClient,
  workspaceId: string,
  gmailAccount: string,
): Promise<string> {
  const { data: account, error: accountError } = await admin.from('gmail_workspace_account')
    .select('refresh_token_secret_id')
    .eq('workspace_id', workspaceId)
    .ilike('email', gmailAccount)
    .is('revoked_at', null)
    .maybeSingle();
  if (accountError || !account?.refresh_token_secret_id) {
    throw new SourceDocumentError(503, 'gmail_account_not_connected');
  }

  const { data: token, error: tokenError } = await admin.from('gmail_tokens')
    .select('refresh_token')
    .eq('id', account.refresh_token_secret_id)
    .maybeSingle();
  if (tokenError || !token?.refresh_token) throw new SourceDocumentError(503, 'gmail_token_unavailable');

  const accessToken = await refreshAccessToken(token.refresh_token);
  if (!accessToken) throw new SourceDocumentError(503, 'gmail_reauth_required');
  return accessToken;
}

async function fetchGmailAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<Uint8Array> {
  const data = await gmailJson(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
  );
  if (typeof data.data !== 'string') throw new SourceDocumentError(502, 'gmail_attachment_data_missing');
  return decodeBase64Url(data.data);
}

async function gmailJson(accessToken: string, path: string): Promise<Record<string, unknown>> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    if (response.status === 404) throw new SourceDocumentError(404, 'gmail_resource_not_found');
    if (response.status === 401 || response.status === 403) throw new SourceDocumentError(503, 'gmail_reauth_required');
    if (response.status === 429) throw new SourceDocumentError(503, 'gmail_rate_limited');
    throw new SourceDocumentError(502, 'gmail_request_failed');
  }
  const value: unknown = await response.json();
  if (!isRecord(value)) throw new SourceDocumentError(502, 'invalid_gmail_response');
  return value;
}

async function uploadGhlMediaFile(
  context: GhlContext,
  filename: string,
  mimeType: string,
  bytes: Uint8Array,
): Promise<UploadedDocument> {
  const form = new FormData();
  const fileBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  form.append('file', new Blob([fileBuffer], { type: mimeType }), filename);
  form.append('hosted', 'false');
  form.append('name', filename);

  const response = await fetch(`${GHL_BASE}/medias/upload-file`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${context.apiKey}`,
      Version: GHL_VERSION,
      Accept: 'application/json',
    },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    console.error(JSON.stringify({ event: 'agent_gateway_ghl_media_upload_error', status: response.status }));
    if (response.status === 401 || response.status === 403) throw new SourceDocumentError(503, 'ghl_media_not_authorized');
    if (response.status === 413) throw new SourceDocumentError(413, 'source_document_too_large');
    if (response.status === 429) throw new SourceDocumentError(503, 'ghl_rate_limited');
    if (response.status >= 400 && response.status < 500) throw new SourceDocumentError(400, 'ghl_media_upload_rejected');
    throw new SourceDocumentError(502, 'ghl_media_upload_failed');
  }

  const value: unknown = await response.json();
  if (!isRecord(value) || typeof value.url !== 'string' || !value.url.startsWith('https://')) {
    throw new SourceDocumentError(502, 'invalid_ghl_media_response');
  }
  return {
    url: value.url,
    name: filename,
    mimetype: mimeType,
    size: bytes.byteLength,
    file_id: typeof value.fileId === 'string' ? value.fileId.slice(0, 500) : null,
  };
}

export function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new SourceDocumentError(502, 'gmail_attachment_decode_failed');
  }
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function getOperation(
  admin: SupabaseClient,
  workspaceId: string,
  key: string,
): Promise<OperationRow | null> {
  const { data, error } = await admin.from('ema_operations')
    .select('id, operation_status, external_id, result_metadata')
    .eq('workspace_id', workspaceId)
    .eq('operating_mode', 'autonomous')
    .eq('idempotency_key', key)
    .maybeSingle();
  if (error) throw new SourceDocumentError(500, 'ema_operation_lookup_failed');
  return data as OperationRow | null;
}

async function beginOperation(
  admin: SupabaseClient,
  workspaceId: string,
  candidateId: string,
  key: string,
): Promise<{ id: string }> {
  const { data, error } = await admin.from('ema_operations').insert({
    workspace_id: workspaceId,
    ema_message_id: null,
    ema_candidate_id: candidateId,
    operating_mode: 'autonomous',
    operation_type: 'ghl_opportunity_source_document_attach',
    idempotency_key: key,
    operation_status: 'executing',
    request_metadata: { source: 'agent_gateway', contract: 'deal.intake_to_crm.source_documents.v2' },
    attempt_count: 1,
    is_test: false,
  }).select('id').single();
  if (error || !data) throw new SourceDocumentError(500, 'ema_operation_create_failed');
  return { id: String(data.id) };
}

async function finishOperation(
  admin: SupabaseClient,
  id: string,
  externalId: string,
  resultMetadata: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.from('ema_operations').update({
    operation_status: 'succeeded',
    external_id: externalId,
    result_metadata: resultMetadata,
    last_error: null,
  }).eq('id', id);
  if (error) throw new SourceDocumentError(500, 'ema_operation_update_failed');
}

async function markOperationUncertain(admin: SupabaseClient, id: string, error: unknown): Promise<void> {
  await admin.from('ema_operations').update({
    operation_status: 'needs_reconciliation',
    last_error: error instanceof Error ? error.name.slice(0, 120) : 'upstream_error',
  }).eq('id', id);
}

function isPortfolioPackageFilename(filename: string): boolean {
  const value = filename.toLowerCase().replace(/[_-]+/g, ' ');
  return /\b(offering memorandum|om|rent roll|rentroll|t\s*12|trailing\s*12|p\s*&\s*l|profit\s*(and|&)\s*loss)\b/.test(value);
}

function documentIdentity(doc: DocumentDescriptor): string {
  return `${doc.attachmentId ?? ''}|${doc.filename.toLowerCase()}`;
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => isRecord(item))
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
