import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import {
  calculateFlipAnalysis,
  FlipAnalysisError,
  type FlipAnalysisInputs,
  type FlipAnalysisPolicy,
} from './flip_analysis.ts';
import { runAndPersistCashDealCheckPrep } from './cash_dealcheck.ts';

export class CashFlipAnalysisError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
    this.name = 'CashFlipAnalysisError';
  }
}

interface WorkItem {
  id: string;
  agent_task_id: string;
  candidate_id: string | null;
  activation_count: number;
}

export async function runAndPersistCashFlipAnalysis(
  admin: SupabaseClient,
  workspaceId: string,
  agentId: string,
  opportunityId: string,
): Promise<Record<string, unknown>> {
  const work = await loadActiveWorkItem(admin, workspaceId, opportunityId);
  const inputs = await loadSuccessfulInputs(admin, work.id, work.activation_count);
  const policy = await loadActivePolicy(admin, workspaceId);

  let analysis;
  try {
    analysis = calculateFlipAnalysis(inputs, policy);
  } catch (error) {
    if (error instanceof FlipAnalysisError) throw new CashFlipAnalysisError(409, error.code);
    throw error;
  }

  const stepStatus = analysis.status === 'calculated' ? 'succeeded' : 'needs_info';
  const { data: step, error: stepError } = await admin
    .from('cash_underwriting_steps')
    .upsert({
      workspace_id: workspaceId,
      cash_work_item_id: work.id,
      agent_task_id: work.agent_task_id,
      candidate_id: work.candidate_id,
      ghl_opportunity_id: opportunityId,
      activation_count: work.activation_count,
      phase: 'flip_analysis',
      status: stepStatus,
      output: analysis,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'cash_work_item_id,activation_count,phase',
    })
    .select('id, status, updated_at')
    .single();
  if (stepError || !step) throw new CashFlipAnalysisError(500, 'flip_analysis_step_persist_failed');

  const progress = analysis.status === 'calculated'
    ? {
        phase: 'flip_analysis',
        status: stepStatus,
        step_id: step.id,
        standard_net_profit: analysis.standard?.net_profit ?? null,
        standard_return_on_cost_pct: analysis.standard?.return_on_cost_pct ?? null,
        standard_profit_margin_on_sale_pct: analysis.standard?.profit_margin_on_sale_pct ?? null,
        stretch_net_profit: analysis.stretch?.net_profit ?? null,
        stretch_return_on_cost_pct: analysis.stretch?.return_on_cost_pct ?? null,
        stretch_profit_compression: analysis.stretch_profit_compression,
        policy_id: analysis.policy.id,
        policy_version: analysis.policy.version,
        next_phase: 'dealcheck',
        updated_at: step.updated_at,
        run_by_agent_id: agentId,
      }
    : {
        phase: 'flip_analysis',
        status: stepStatus,
        step_id: step.id,
        missing_policy_fields: analysis.missing_policy_fields,
        policy_id: analysis.policy.id,
        policy_version: analysis.policy.version,
        next_phase: 'flip_analysis',
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
  if (taskError) throw new CashFlipAnalysisError(500, 'cash_task_flip_analysis_progress_update_failed');

  if (stepStatus !== 'succeeded') {
    return {
      ...analysis,
      work_step: {
        persisted: true,
        work_item_id: work.id,
        agent_task_id: work.agent_task_id,
        step_id: step.id,
        phase: 'flip_analysis',
        status: stepStatus,
        next_phase: 'flip_analysis',
      },
    };
  }

  const dealcheck = await runAndPersistCashDealCheckPrep(
    admin,
    workspaceId,
    agentId,
    opportunityId,
  );
  const dealcheckWorkStep = isRecord(dealcheck.work_step) ? dealcheck.work_step : {};
  const nextPhase = typeof dealcheckWorkStep.next_phase === 'string'
    ? dealcheckWorkStep.next_phase
    : 'dealcheck';

  return {
    ...analysis,
    dealcheck,
    work_step: {
      persisted: true,
      work_item_id: work.id,
      agent_task_id: work.agent_task_id,
      step_id: step.id,
      phase: 'flip_analysis',
      status: stepStatus,
      next_phase: nextPhase,
      dealcheck_auto_prepared: true,
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
  if (error) throw new CashFlipAnalysisError(500, 'cash_work_lookup_failed');
  if (!data || data.length === 0) throw new CashFlipAnalysisError(409, 'active_cash_work_item_required');
  if (data.length !== 1) throw new CashFlipAnalysisError(409, 'cash_work_lookup_ambiguous');
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
): Promise<FlipAnalysisInputs> {
  const { data, error } = await admin
    .from('cash_underwriting_steps')
    .select('phase, status, output')
    .eq('cash_work_item_id', workItemId)
    .eq('activation_count', activationCount)
    .eq('status', 'succeeded')
    .in('phase', ['cash_value', 'rehab', 'mao']);
  if (error) throw new CashFlipAnalysisError(500, 'flip_analysis_input_steps_lookup_failed');

  const steps = new Map<string, Record<string, unknown>>();
  for (const row of data ?? []) {
    if (typeof row.phase === 'string' && isRecord(row.output)) steps.set(row.phase, row.output);
  }
  const cashValueOutput = steps.get('cash_value');
  const rehabOutput = steps.get('rehab');
  const maoOutput = steps.get('mao');
  if (!cashValueOutput) throw new CashFlipAnalysisError(409, 'cash_value_required_before_flip_analysis');
  if (!rehabOutput) throw new CashFlipAnalysisError(409, 'rehab_required_before_flip_analysis');
  if (!maoOutput) throw new CashFlipAnalysisError(409, 'mao_required_before_flip_analysis');

  const cashValueResult = record(cashValueOutput.cash_value);
  const rehabTotal = record(rehabOutput.total);
  return {
    cash_value: requiredNonNegativeNumber(cashValueResult.cash_value, 'cash_value'),
    rehab_total: requiredNonNegativeNumber(rehabTotal.base, 'rehab_total'),
    standard_mao: requiredNonNegativeNumber(maoOutput.standard_mao, 'standard_mao'),
    stretch_ceiling: requiredNonNegativeNumber(maoOutput.stretch_ceiling, 'stretch_ceiling'),
  };
}

async function loadActivePolicy(
  admin: SupabaseClient,
  workspaceId: string,
): Promise<FlipAnalysisPolicy | null> {
  const { data, error } = await admin
    .from('flip_analysis_policies')
    .select(
      'id, name, market, version, acquisition_closing_cost_pct, sale_cost_pct, hold_months, monthly_property_taxes, monthly_insurance, monthly_utilities, monthly_maintenance, monthly_hoa, monthly_other_carry, source_reference, notes',
    )
    .eq('workspace_id', workspaceId)
    .eq('asset_class', 'fix_flip')
    .eq('status', 'active')
    .limit(2);
  if (error) throw new CashFlipAnalysisError(500, 'flip_analysis_policy_lookup_failed');
  if (!data || data.length === 0) return null;
  if (data.length !== 1) throw new CashFlipAnalysisError(500, 'multiple_active_flip_analysis_policies');

  const row = data[0] as Record<string, unknown>;
  return {
    id: requiredString(row.id, 'flip_policy_id'),
    name: requiredString(row.name, 'flip_policy_name'),
    market: requiredString(row.market, 'flip_policy_market'),
    version: requiredPositiveInteger(row.version, 'flip_policy_version'),
    acquisition_closing_cost_pct: nullableNonNegativeNumber(row.acquisition_closing_cost_pct),
    sale_cost_pct: nullableNonNegativeNumber(row.sale_cost_pct),
    hold_months: nullablePositiveInteger(row.hold_months),
    monthly_property_taxes: nullableNonNegativeNumber(row.monthly_property_taxes),
    monthly_insurance: nullableNonNegativeNumber(row.monthly_insurance),
    monthly_utilities: nullableNonNegativeNumber(row.monthly_utilities),
    monthly_maintenance: nullableNonNegativeNumber(row.monthly_maintenance),
    monthly_hoa: nullableNonNegativeNumber(row.monthly_hoa),
    monthly_other_carry: nullableNonNegativeNumber(row.monthly_other_carry),
    source_reference: typeof row.source_reference === 'string' ? row.source_reference.trim() : '',
    notes: typeof row.notes === 'string' ? row.notes : null,
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
  if (error || !data) throw new CashFlipAnalysisError(500, 'cash_task_context_lookup_failed');
  const current = isRecord(data.context) ? data.context : {};
  return {
    ...current,
    cash_runtime_status: 'active',
    cash_progress: progress,
  };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new CashFlipAnalysisError(500, `invalid_${field}`);
  return value.trim();
}

function requiredPositiveInteger(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new CashFlipAnalysisError(500, `invalid_${field}`);
  return number;
}

function nullablePositiveInteger(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? number : null;
}

function requiredNonNegativeNumber(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new CashFlipAnalysisError(409, `invalid_${field}`);
  return number;
}

function nullableNonNegativeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
