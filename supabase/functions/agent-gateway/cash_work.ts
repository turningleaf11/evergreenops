import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import type { SfrValuationResult } from './sfr_valuation.ts';
import { enrichCandidateProperty } from './property_enrichment.ts';

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
  next_phase: 'cash_value' | 'rehab' | 'mao' | 'flip_analysis' | 'dealcheck' | 'final';
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

  return {
    work_item: {
      work_item_id: requiredString(row.work_item_id, 'work_item_id'),
      agent_task_id: requiredString(row.agent_task_id, 'agent_task_id'),
      candidate_id: typeof row.candidate_id === 'string' ? row.candidate_id : null,
      ghl_opportunity_id: requiredString(row.ghl_opportunity_id, 'ghl_opportunity_id'),
      work_kind: 'sfr_underwriting',
      activation_count: requiredPositiveInteger(row.activation_count, 'activation_count'),
      task_title: requiredString(row.task_title, 'task_title'),
      task_description: requiredString(row.task_description, 'task_description'),
      resumed: Boolean(row.resumed),
      completed_phases: phases,
      next_phase: phases.includes('dealcheck')
        ? 'final'
        : phases.includes('flip_analysis')
        ? 'dealcheck'
        : phases.includes('mao')
        ? 'flip_analysis'
        : phases.includes('rehab')
        ? 'mao'
        : phases.includes('cash_value')
        ? 'rehab'
        : 'cash_value',
    },
  };
}

export async function persistActiveCashValueStep(
  admin: SupabaseClient,
  workspaceId: string,
  agentId: string,
  valuation: SfrValuationResult,
  fetchImpl: typeof fetch = fetch,
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

  let propertyEnrichment: Record<string, unknown> = {
    status: 'skipped',
    provider: 'dealmachine',
    reason: candidateId ? 'dealmachine_not_used' : 'candidate_id_unavailable',
  };
  const subjectAddress = typeof valuation.subject.address === 'string' ? valuation.subject.address.trim() : '';
  if (candidateId && subjectAddress && valuation.providers.dealmachine.status === 'used') {
    const enriched = await enrichCandidateProperty(
      admin,
      workspaceId,
      candidateId,
      subjectAddress,
      fetchImpl,
    );
    propertyEnrichment = {
      status: enriched.status,
      provider: enriched.provider,
      snapshot_id: enriched.snapshot_id,
      provider_property_id: enriched.provider_property_id,
      fetched_at: enriched.fetched_at,
      credits_used: enriched.credits_used,
      error_code: enriched.error_code,
    };
  }

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
