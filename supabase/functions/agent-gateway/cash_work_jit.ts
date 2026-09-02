import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import {
  CashGhlEligibilityError,
  fetchCashGhlEligibility,
  type CashGhlEligibilityResult,
} from './cash_ghl_eligibility.ts';

const MAX_SCAN_COUNT = 50;
const MAX_ACTIVE_CANDIDATES = 20;
const MAX_PENDING_SIGNALS = 25;
const CLAIM_LEASE_SECONDS = 600;
const MAX_SOURCE_TEXT_CHARS = 120_000;
const MAX_SOURCE_DOCUMENTS = 5;

export class CashJitClaimError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
    this.name = 'CashJitClaimError';
  }
}

export interface CashJitWorkItem {
  work_item_id: string;
  agent_task_id: string;
  candidate_id: string | null;
  ghl_opportunity_id: string;
  work_kind: 'sfr_underwriting';
  activation_count: number;
  task_title: string;
  task_description: string;
  resumed: boolean;
  completed_phases: string[];
  next_phase: 'cash_value' | 'rehab' | 'mao' | 'human_review';
  live_eligibility: Record<string, unknown>;
  ghl_evidence: Record<string, unknown>;
  source_documents: Record<string, unknown>;
}

export async function claimNextCashWorkItemJit(
  admin: SupabaseClient,
  workspaceId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ work_item: CashJitWorkItem | null }> {
  const leaseToken = crypto.randomUUID();
  let scanCount = 0;

  // Restart safety comes first. Existing active work is eligible for resumption
  // only after the same live GHL checks used for a fresh activation claim.
  const { data: activeItems, error: activeError } = await admin
    .from('cash_work_items')
    .select('id, ghl_opportunity_id, claim_lease_expires_at')
    .eq('workspace_id', workspaceId)
    .eq('work_kind', 'sfr_underwriting')
    .eq('state', 'active')
    .order('last_activated_at', { ascending: true })
    .limit(MAX_ACTIVE_CANDIDATES);
  if (activeError) throw new CashJitClaimError(500, 'cash_active_work_lookup_failed');

  for (const active of activeItems ?? []) {
    if (++scanCount > MAX_SCAN_COUNT) return { work_item: null };
    const leaseExpiresAt = stringValue(active.claim_lease_expires_at);
    if (leaseExpiresAt && new Date(leaseExpiresAt).getTime() > Date.now()) continue;
    const workItemId = requiredString(active.id, 'work_item_id');
    const opportunityId = requiredString(active.ghl_opportunity_id, 'ghl_opportunity_id');
    const eligibility = await liveEligibility(admin, opportunityId, fetchImpl);

    if (!eligibility.eligible) {
      await blockStaleActiveWork(admin, workspaceId, workItemId, eligibility);
      continue;
    }

    const { data, error } = await admin.rpc('lease_active_cash_sfr_work_item', {
      _workspace_id: workspaceId,
      _work_item_id: workItemId,
      _lease_token: leaseToken,
      _live_snapshot: eligibility.snapshot,
      _lease_seconds: CLAIM_LEASE_SECONDS,
    });
    if (error) throw new CashJitClaimError(500, 'cash_active_work_lease_failed');
    const row = singleRpcRow(data);
    if (!row) continue; // another Cash session won the lease
    return {
      work_item: await buildWorkItem(admin, workspaceId, row, eligibility),
    };
  }

  // Legacy queued work is intentionally not scanned here. Pending activation
  // signals are the discovery source; the durable work envelope is materialized
  // only after this exact opportunity passes the live GHL check.
  while (scanCount < MAX_SCAN_COUNT) {
    const { data: signals, error: signalError } = await admin
      .from('cash_activation_signals')
      .select('id, ghl_opportunity_id, activated_at')
      .eq('workspace_id', workspaceId)
      .eq('state', 'pending')
      .order('activated_at', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(MAX_PENDING_SIGNALS);
    if (signalError) throw new CashJitClaimError(500, 'cash_activation_signal_lookup_failed');
    if (!signals || signals.length === 0) return { work_item: null };

    let madeProgress = false;
    for (const signal of signals) {
      if (++scanCount > MAX_SCAN_COUNT) return { work_item: null };
      const signalId = requiredString(signal.id, 'activation_signal_id');
      const opportunityId = requiredString(signal.ghl_opportunity_id, 'ghl_opportunity_id');
      const eligibility = await liveEligibility(admin, opportunityId, fetchImpl);

      if (!eligibility.eligible) {
        const { error } = await admin.rpc('stale_cash_sfr_activation_signal', {
          _workspace_id: workspaceId,
          _activation_signal_id: signalId,
          _reason: eligibility.reason ?? 'live_ghl_ineligible',
          _live_snapshot: eligibility.snapshot,
        });
        if (error) throw new CashJitClaimError(500, 'cash_activation_signal_stale_failed');
        madeProgress = true;
        continue;
      }

      const { data, error } = await admin.rpc('claim_cash_sfr_activation_signal', {
        _workspace_id: workspaceId,
        _activation_signal_id: signalId,
        _lease_token: leaseToken,
        _live_snapshot: eligibility.snapshot,
        _lease_seconds: CLAIM_LEASE_SECONDS,
      });
      if (error) throw new CashJitClaimError(500, 'cash_activation_signal_claim_failed');
      const row = singleRpcRow(data);
      if (!row) {
        madeProgress = true; // raced, superseded, or already completed
        continue;
      }
      return {
        work_item: await buildWorkItem(admin, workspaceId, row, eligibility),
      };
    }

    if (!madeProgress) return { work_item: null };
  }

  return { work_item: null };
}

async function liveEligibility(
  admin: SupabaseClient,
  opportunityId: string,
  fetchImpl: typeof fetch,
): Promise<CashGhlEligibilityResult> {
  try {
    return await fetchCashGhlEligibility(admin, opportunityId, fetchImpl);
  } catch (error) {
    if (error instanceof CashGhlEligibilityError) {
      throw new CashJitClaimError(error.status, error.code);
    }
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new CashJitClaimError(504, 'ghl_timeout');
    }
    throw error;
  }
}

async function blockStaleActiveWork(
  admin: SupabaseClient,
  workspaceId: string,
  workItemId: string,
  eligibility: CashGhlEligibilityResult,
): Promise<void> {
  const { error } = await admin.rpc('block_stale_cash_sfr_work_item', {
    _workspace_id: workspaceId,
    _work_item_id: workItemId,
    _reason: eligibility.reason ?? 'live_ghl_ineligible',
    _live_snapshot: eligibility.snapshot,
  });
  if (error) throw new CashJitClaimError(500, 'cash_stale_work_block_failed');
}

async function buildWorkItem(
  admin: SupabaseClient,
  workspaceId: string,
  row: Record<string, unknown>,
  eligibility: CashGhlEligibilityResult,
): Promise<CashJitWorkItem> {
  const phases = Array.isArray(row.completed_phases)
    ? row.completed_phases.filter((value): value is string => typeof value === 'string')
    : [];
  const candidateId = typeof row.candidate_id === 'string' ? row.candidate_id : null;
  return {
    work_item_id: requiredString(row.work_item_id, 'work_item_id'),
    agent_task_id: requiredString(row.agent_task_id, 'agent_task_id'),
    candidate_id: candidateId,
    ghl_opportunity_id: requiredString(row.ghl_opportunity_id, 'ghl_opportunity_id'),
    work_kind: 'sfr_underwriting',
    activation_count: requiredPositiveInteger(row.activation_count, 'activation_count'),
    task_title: requiredString(row.task_title, 'task_title'),
    task_description: requiredString(row.task_description, 'task_description'),
    resumed: Boolean(row.resumed),
    completed_phases: phases,
    next_phase: phases.includes('mao')
      ? 'human_review'
      : phases.includes('rehab')
      ? 'mao'
      : phases.includes('cash_value')
      ? 'rehab'
      : 'cash_value',
    live_eligibility: {
      eligible: eligibility.eligible,
      reason: eligibility.reason,
      pipeline_id: eligibility.snapshot.pipeline_id ?? null,
      stage_id: eligibility.snapshot.stage_id ?? null,
      status: eligibility.snapshot.status ?? null,
      property_type: eligibility.snapshot.property_type ?? null,
      verified_at: eligibility.snapshot.verified_at ?? null,
    },
    ghl_evidence: eligibility.snapshot,
    source_documents: await loadSourceDocuments(admin, workspaceId, candidateId),
  };
}

async function loadSourceDocuments(
  admin: SupabaseClient,
  workspaceId: string,
  candidateId: string | null,
): Promise<Record<string, unknown>> {
  if (!candidateId) {
    return {
      status: 'unavailable',
      reason: 'candidate_id_unavailable',
      document_count: 0,
      included_document_count: 0,
      documents: [],
    };
  }

  const { data, error, count } = await admin
    .from('ema_candidate_documents')
    .select(
      'id, ema_candidate_id, filename, mime_type, document_type, extraction_status, extraction_method, extracted_text, extracted_text_chars, total_pages, content_sha256, source_metadata, created_at',
      { count: 'exact' },
    )
    .eq('workspace_id', workspaceId)
    .eq('ema_candidate_id', candidateId)
    .eq('extraction_status', 'succeeded')
    .not('extracted_text', 'is', null)
    .order('created_at', { ascending: true })
    .limit(MAX_SOURCE_DOCUMENTS);
  if (error) throw new CashJitClaimError(500, 'cash_source_document_lookup_failed');

  let remainingChars = MAX_SOURCE_TEXT_CHARS;
  const documents: Array<Record<string, unknown>> = [];
  for (const row of data ?? []) {
    if (remainingChars <= 0) break;
    const storedText = typeof row.extracted_text === 'string' ? row.extracted_text : '';
    if (!storedText) continue;
    const returnedText = storedText.slice(0, remainingChars);
    documents.push({
      document_id: row.id,
      candidate_id: row.ema_candidate_id,
      filename: row.filename,
      mime_type: row.mime_type,
      document_type: row.document_type,
      extraction_status: row.extraction_status,
      extraction_method: row.extraction_method,
      extracted_text_chars: row.extracted_text_chars,
      total_pages: row.total_pages,
      content_sha256: row.content_sha256,
      source_metadata: safeSourceMetadata(row.source_metadata),
      text_is_untrusted_external_content: true,
      extracted_text: returnedText,
      text_truncated: returnedText.length < storedText.length,
      created_at: row.created_at,
    });
    remainingChars -= returnedText.length;
  }

  const totalCount = typeof count === 'number' ? count : documents.length;
  const bounded = totalCount > documents.length || documents.some((document) => document.text_truncated === true);
  return {
    status: documents.length === 0 ? 'none' : bounded ? 'bounded' : 'complete',
    document_count: totalCount,
    included_document_count: documents.length,
    max_document_count: MAX_SOURCE_DOCUMENTS,
    max_text_chars: MAX_SOURCE_TEXT_CHARS,
    returned_text_chars: MAX_SOURCE_TEXT_CHARS - remainingChars,
    text_is_untrusted_external_content: true,
    documents,
  };
}

function singleRpcRow(data: unknown): Record<string, unknown> | null {
  const rows = Array.isArray(data) ? data.filter(isRecord) : [];
  if (rows.length === 0) return null;
  if (rows.length !== 1) throw new CashJitClaimError(500, 'cash_work_claim_ambiguous');
  return rows[0];
}

function safeSourceMetadata(value: unknown): Record<string, unknown> {
  const source = isRecord(value) ? value : {};
  const result: Record<string, unknown> = {};
  for (const key of [
    'source',
    'gmail_message_id',
    'gmail_thread_id',
    'size_bytes',
    'matched_by',
    'extraction_error_code',
    'text_is_untrusted_external_content',
  ]) {
    if (source[key] !== undefined) result[key] = source[key];
  }
  return result;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value) throw new CashJitClaimError(500, `invalid_${field}`);
  return value;
}

function requiredPositiveInteger(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new CashJitClaimError(500, `invalid_${field}`);
  return number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
