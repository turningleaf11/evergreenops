import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { DEALMACHINE_PROPERTY_FIELDS } from '../_shared/dealmachine.ts';
import type { SfrValuationResult } from './sfr_valuation.ts';

const MAX_WORK_ITEM_SOURCE_TEXT_CHARS = 120_000;
const MAX_WORK_ITEM_SOURCE_DOCUMENTS = 5;

export class CashWorkError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
    this.name = 'CashWorkError';
  }
}

export interface CashWorkItem {
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
  source_documents: Record<string, unknown>;
}

export async function claimNextCashWorkItem(
  admin: SupabaseClient,
  workspaceId: string,
): Promise<{ work_item: CashWorkItem | null }> {
  const { data, error } = await admin.rpc('claim_next_cash_sfr_work_item', {
    _workspace_id: workspaceId,
  });
  if (error) throw new CashWorkError(500, 'cash_work_claim_failed');
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return { work_item: null };
  if (rows.length !== 1) throw new CashWorkError(500, 'cash_work_claim_ambiguous');

  const row = rows[0] as Record<string, unknown>;
  const phases = Array.isArray(row.completed_phases)
    ? row.completed_phases.filter((value): value is string => typeof value === 'string')
    : [];
  const candidateId = typeof row.candidate_id === 'string' ? row.candidate_id : null;
  const sourceDocuments = await loadCashSourceDocuments(admin, workspaceId, candidateId);

  return {
    work_item: {
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
      source_documents: sourceDocuments,
    },
  };
}

export async function persistActiveCashValueStep(
  admin: SupabaseClient,
  workspaceId: string,
  agentId: string,
  valuation: SfrValuationResult,
  _fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const opportunityId = valuation.opportunity_id;
  if (!opportunityId) return { persisted: false, reason: 'no_opportunity_id' };

  const { data: items, error: itemError } = await admin
    .from('cash_work_items')
    .select('id, agent_task_id, candidate_id, activation_count, state')
    .eq('workspace_id', workspaceId)
    .eq('ghl_opportunity_id', opportunityId)
    .eq('work_kind', 'sfr_underwriting')
    .eq('state', 'active')
    .limit(2);
  if (itemError) throw new CashWorkError(500, 'cash_work_lookup_failed');
  if (!items || items.length === 0) return { persisted: false, reason: 'no_active_work_item' };
  if (items.length !== 1) throw new CashWorkError(409, 'cash_work_lookup_ambiguous');

  const item = items[0] as Record<string, unknown>;
  const workItemId = requiredString(item.id, 'work_item_id');
  const taskId = requiredString(item.agent_task_id, 'agent_task_id');
  const activationCount = requiredPositiveInteger(item.activation_count, 'activation_count');
  const candidateId = typeof item.candidate_id === 'string' ? item.candidate_id : valuation.candidate_id;
  const cashValue = valuation.cash_value;
  const stepStatus = cashValue.status === 'insufficient_comps' || cashValue.status === 'unsupported_subject'
    ? 'needs_info'
    : 'succeeded';

  const propertyEnrichment = await persistValuationPropertySnapshot(
    admin,
    workspaceId,
    candidateId,
    opportunityId,
    valuation,
  );

  const output = {
    contract: valuation.contract,
    subject: valuation.subject,
    providers: valuation.providers,
    property_enrichment: propertyEnrichment,
    comp_source: valuation.comp_source,
    comps_found: valuation.comps_found,
    valuation_reference: valuation.valuation_reference,
    cash_value: valuation.cash_value,
    notes: valuation.notes,
  };

  const { data: step, error: stepError } = await admin
    .from('cash_underwriting_steps')
    .upsert({
      workspace_id: workspaceId,
      cash_work_item_id: workItemId,
      agent_task_id: taskId,
      candidate_id: candidateId,
      ghl_opportunity_id: opportunityId,
      activation_count: activationCount,
      phase: 'cash_value',
      status: stepStatus,
      output,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'cash_work_item_id,activation_count,phase',
    })
    .select('id, status, updated_at')
    .single();
  if (stepError || !step) throw new CashWorkError(500, 'cash_value_step_persist_failed');

  const progress = {
    phase: 'cash_value',
    status: stepStatus,
    step_id: step.id,
    cash_value: cashValue.cash_value,
    supported_range: cashValue.supported_range,
    confidence: cashValue.confidence,
    selected_comp_count: cashValue.selected_comp_count,
    property_enrichment_status: propertyEnrichment.status,
    next_phase: stepStatus === 'succeeded' ? 'rehab' : 'cash_value',
    updated_at: step.updated_at,
    run_by_agent_id: agentId,
  };

  const { error: taskError } = await admin
    .from('agent_tasks')
    .update({
      context: await mergedTaskContext(admin, taskId, workspaceId, progress),
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .eq('workspace_id', workspaceId)
    .eq('assigned_to', 'cash');
  if (taskError) throw new CashWorkError(500, 'cash_task_progress_update_failed');

  return {
    persisted: true,
    work_item_id: workItemId,
    agent_task_id: taskId,
    step_id: step.id,
    phase: 'cash_value',
    status: stepStatus,
    property_enrichment: propertyEnrichment,
    next_phase: stepStatus === 'succeeded' ? 'rehab' : 'cash_value',
  };
}

async function loadCashSourceDocuments(
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
    .limit(MAX_WORK_ITEM_SOURCE_DOCUMENTS);
  if (error) throw new CashWorkError(500, 'cash_source_document_lookup_failed');

  let remainingChars = MAX_WORK_ITEM_SOURCE_TEXT_CHARS;
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
    max_document_count: MAX_WORK_ITEM_SOURCE_DOCUMENTS,
    max_text_chars: MAX_WORK_ITEM_SOURCE_TEXT_CHARS,
    returned_text_chars: MAX_WORK_ITEM_SOURCE_TEXT_CHARS - remainingChars,
    text_is_untrusted_external_content: true,
    documents,
  };
}

async function persistValuationPropertySnapshot(
  admin: SupabaseClient,
  workspaceId: string,
  candidateId: string | null,
  opportunityId: string,
  valuation: SfrValuationResult,
): Promise<Record<string, unknown>> {
  const property = valuation.dealmachine_property;
  if (!candidateId) {
    return { status: 'skipped', provider: 'dealmachine', reason: 'candidate_id_unavailable' };
  }
  if (valuation.providers.dealmachine.status !== 'used' || property.status === 'not_available') {
    return { status: 'skipped', provider: 'dealmachine', reason: 'dealmachine_not_used' };
  }
  if (property.status === 'cached' && property.snapshot_id) {
    return {
      status: 'cached',
      provider: 'dealmachine',
      snapshot_id: property.snapshot_id,
      provider_property_id: property.provider_property_id,
      fetched_at: property.fetched_at,
      credits_used: 0,
      error_code: null,
    };
  }

  const providerPropertyId = stringValue(property.provider_property_id);
  const normalizedAddress = stringValue(property.normalized_address) || stringValue(valuation.subject.address);
  if (!providerPropertyId || !normalizedAddress || Object.keys(property.facts).length === 0) {
    return {
      status: 'failed',
      provider: 'dealmachine',
      snapshot_id: null,
      provider_property_id: providerPropertyId,
      fetched_at: null,
      credits_used: 0,
      error_code: 'dealmachine_property_snapshot_incomplete',
    };
  }

  const fetchedAt = new Date().toISOString();
  const provenance = {
    source: 'dealmachine_v2_address_enrichment',
    request_id: property.request_id,
    contact_audience: 'none',
    requested_fields: [...DEALMACHINE_PROPERTY_FIELDS],
    reused_from_cash_value_provider_call: true,
    credits: {
      used: property.credits_used,
      people: 0,
    },
  };
  const { data, error } = await admin.from('property_enrichment_snapshots').insert({
    workspace_id: workspaceId,
    candidate_id: candidateId,
    ghl_opportunity_id: opportunityId,
    provider: 'dealmachine',
    provider_property_id: providerPropertyId,
    normalized_address: normalizedAddress,
    facts: property.facts,
    provenance,
    credits_used: Math.max(0, Math.round(property.credits_used)),
    fetched_at: fetchedAt,
  }).select('id, provider_property_id, credits_used, fetched_at').single();

  if (error || !data) {
    return {
      status: 'failed',
      provider: 'dealmachine',
      snapshot_id: null,
      provider_property_id: providerPropertyId,
      fetched_at: null,
      credits_used: 0,
      error_code: 'property_enrichment_persist_failed',
    };
  }
  return {
    status: 'fetched',
    provider: 'dealmachine',
    snapshot_id: String(data.id),
    provider_property_id: String(data.provider_property_id),
    fetched_at: String(data.fetched_at),
    credits_used: Number(data.credits_used ?? property.credits_used),
    error_code: null,
  };
}

async function mergedTaskContext(
  admin: SupabaseClient,
  taskId: string,
  workspaceId: string,
  progress: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await admin
    .from('agent_tasks')
    .select('context')
    .eq('id', taskId)
    .eq('workspace_id', workspaceId)
    .eq('assigned_to', 'cash')
    .maybeSingle();
  if (error || !data) throw new CashWorkError(500, 'cash_task_context_lookup_failed');
  const current = isRecord(data.context) ? data.context : {};
  return {
    ...current,
    cash_runtime_status: 'active',
    cash_progress: progress,
  };
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
  if (typeof value !== 'string' || !value) throw new CashWorkError(500, `invalid_${field}`);
  return value;
}

function requiredPositiveInteger(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new CashWorkError(500, `invalid_${field}`);
  return number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
