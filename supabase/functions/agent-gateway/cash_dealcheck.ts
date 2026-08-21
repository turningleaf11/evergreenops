import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import {
  mergeDealCheckLocation,
  parseNormalizedUsAddress,
  prepareDealCheckHandoff,
  type DealCheckFlipScenario,
} from './dealcheck.ts';

export class CashDealCheckError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
    this.name = 'CashDealCheckError';
  }
}

interface WorkItem {
  id: string;
  agent_task_id: string;
  candidate_id: string | null;
  activation_count: number;
}

export async function runAndPersistCashDealCheckPrep(
  admin: SupabaseClient,
  workspaceId: string,
  agentId: string,
  opportunityId: string,
): Promise<Record<string, unknown>> {
  const work = await loadActiveWorkItem(admin, workspaceId, opportunityId);
  const { flipAnalysis, cashValue } = await loadSuccessfulInputs(
    admin,
    work.id,
    work.activation_count,
  );
  const location = await resolveLocation(admin, workspaceId, work.candidate_id, cashValue);

  const standard = normalizeScenario(record(flipAnalysis.standard), false);
  const stretch = normalizeScenario(record(flipAnalysis.stretch), true);
  const prep = prepareDealCheckHandoff({ location, standard, stretch });

  // DealCheck has no public create/read API. A prepared packet is intentionally
  // still needs_info until a real external DealCheck property exists and its
  // analysis has been read back and reconciled.
  const stepStatus = 'needs_info';
  const { data: step, error: stepError } = await admin
    .from('cash_underwriting_steps')
    .upsert({
      workspace_id: workspaceId,
      cash_work_item_id: work.id,
      agent_task_id: work.agent_task_id,
      candidate_id: work.candidate_id,
      ghl_opportunity_id: opportunityId,
      activation_count: work.activation_count,
      phase: 'dealcheck',
      status: stepStatus,
      output: prep,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'cash_work_item_id,activation_count,phase',
    })
    .select('id, status, updated_at')
    .single();
  if (stepError || !step) throw new CashDealCheckError(500, 'dealcheck_step_persist_failed');

  const blocker = prep.status === 'prepared_not_synced'
    ? 'dealcheck_record_creation_and_readback_required'
    : 'dealcheck_location_required';
  const progress = {
    phase: 'dealcheck',
    status: stepStatus,
    step_id: step.id,
    handoff_status: prep.status,
    launch_url: prep.launch_url,
    missing_fields: prep.missing_fields,
    external_sync_status: prep.external_record.sync_status,
    external_readback_status: prep.external_record.readback_status,
    blocker,
    next_phase: 'dealcheck',
    updated_at: step.updated_at,
    run_by_agent_id: agentId,
  };

  const { error: taskError } = await admin
    .from('agent_tasks')
    .update({
      context: await mergedTaskContext(admin, work.agent_task_id, workspaceId, progress),
      updated_at: new Date().toISOString(),
    })
    .eq('id', work.agent_task_id)
    .eq('workspace_id', workspaceId)
    .eq('assigned_to', 'cash');
  if (taskError) throw new CashDealCheckError(500, 'cash_task_dealcheck_progress_update_failed');

  return {
    ...prep,
    work_step: {
      persisted: true,
      work_item_id: work.id,
      agent_task_id: work.agent_task_id,
      step_id: step.id,
      phase: 'dealcheck',
      status: stepStatus,
      next_phase: 'dealcheck',
      blocker,
    },
  };
}

async function loadActiveWorkItem(
  admin: SupabaseClient,
  workspaceId: string,
  opportunityId: string,
): Promise<WorkItem> {
  const { data, error } = await admin
    .from('cash_work_items')
    .select('id, agent_task_id, candidate_id, activation_count, state')
    .eq('workspace_id', workspaceId)
    .eq('ghl_opportunity_id', opportunityId)
    .eq('work_kind', 'sfr_underwriting')
    .eq('state', 'active')
    .limit(2);
  if (error) throw new CashDealCheckError(500, 'cash_work_lookup_failed');
  if (!data || data.length === 0) throw new CashDealCheckError(409, 'active_cash_work_item_required');
  if (data.length !== 1) throw new CashDealCheckError(409, 'cash_work_lookup_ambiguous');
  const row = data[0] as Record<string, unknown>;
  return {
    id: requiredString(row.id, 'work_item_id'),
    agent_task_id: requiredString(row.agent_task_id, 'agent_task_id'),
    candidate_id: typeof row.candidate_id === 'string' ? row.candidate_id : null,
    activation_count: requiredPositiveInteger(row.activation_count, 'activation_count'),
  };
}

async function loadSuccessfulInputs(
  admin: SupabaseClient,
  workItemId: string,
  activationCount: number,
): Promise<{ flipAnalysis: Record<string, unknown>; cashValue: Record<string, unknown> }> {
  const { data, error } = await admin
    .from('cash_underwriting_steps')
    .select('phase, output')
    .eq('cash_work_item_id', workItemId)
    .eq('activation_count', activationCount)
    .eq('status', 'succeeded')
    .in('phase', ['cash_value', 'flip_analysis']);
  if (error) throw new CashDealCheckError(500, 'dealcheck_input_steps_lookup_failed');

  const steps = new Map<string, Record<string, unknown>>();
  for (const row of data ?? []) {
    if (typeof row.phase === 'string' && isRecord(row.output)) steps.set(row.phase, row.output);
  }
  const cashValue = steps.get('cash_value');
  const flipAnalysis = steps.get('flip_analysis');
  if (!cashValue) throw new CashDealCheckError(409, 'cash_value_required_before_dealcheck');
  if (!flipAnalysis) throw new CashDealCheckError(409, 'flip_analysis_required_before_dealcheck');
  return { cashValue, flipAnalysis };
}

async function resolveLocation(
  admin: SupabaseClient,
  workspaceId: string,
  candidateId: string | null,
  cashValueOutput: Record<string, unknown>,
) {
  const subject = record(cashValueOutput.subject);
  let normalizedAddress = stringValue(subject.address);
  let facts: Record<string, unknown> = {};

  if (candidateId) {
    const { data, error } = await admin
      .from('ema_candidates')
      .select('normalized_address, extracted_facts')
      .eq('id', candidateId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (error) throw new CashDealCheckError(500, 'dealcheck_candidate_lookup_failed');
    if (data) {
      normalizedAddress = stringValue(data.normalized_address) ?? normalizedAddress;
      facts = isRecord(data.extracted_facts) ? data.extracted_facts : {};
    }
  }

  return mergeDealCheckLocation(parseNormalizedUsAddress(normalizedAddress), facts);
}

function normalizeScenario(
  value: Record<string, unknown>,
  requiresHumanApproval: boolean,
): DealCheckFlipScenario {
  const monthly = record(value.monthly_carrying_costs);
  return {
    purchase_price: requiredNonNegativeNumber(value.purchase_price, 'purchase_price'),
    rehab_total: requiredNonNegativeNumber(value.rehab_total, 'rehab_total'),
    hold_months: requiredPositiveInteger(value.hold_months, 'hold_months'),
    monthly_carrying_costs: {
      total: requiredNonNegativeNumber(monthly.total, 'monthly_carrying_total'),
    },
    acquisition_closing_costs: requiredNonNegativeNumber(
      value.acquisition_closing_costs,
      'acquisition_closing_costs',
    ),
    sale_price: requiredNonNegativeNumber(value.sale_price, 'sale_price'),
    sale_costs: requiredNonNegativeNumber(value.sale_costs, 'sale_costs'),
    total_project_cost: requiredNonNegativeNumber(value.total_project_cost, 'total_project_cost'),
    net_profit: requiredNumber(value.net_profit, 'net_profit'),
    return_on_cost_pct: requiredNumber(value.return_on_cost_pct, 'return_on_cost_pct'),
    profit_margin_on_sale_pct: requiredNumber(
      value.profit_margin_on_sale_pct,
      'profit_margin_on_sale_pct',
    ),
    break_even_sale_price: requiredNonNegativeNumber(
      value.break_even_sale_price,
      'break_even_sale_price',
    ),
    requires_human_approval: requiresHumanApproval,
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
  if (error || !data) throw new CashDealCheckError(500, 'cash_task_context_lookup_failed');
  const current = isRecord(data.context) ? data.context : {};
  return {
    ...current,
    cash_runtime_status: 'active',
    cash_progress: progress,
  };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new CashDealCheckError(500, `invalid_${field}`);
  return value.trim();
}

function requiredPositiveInteger(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new CashDealCheckError(409, `invalid_${field}`);
  return number;
}

function requiredNonNegativeNumber(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new CashDealCheckError(409, `invalid_${field}`);
  return number;
}

function requiredNumber(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new CashDealCheckError(409, `invalid_${field}`);
  return number;
}

function stringValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
