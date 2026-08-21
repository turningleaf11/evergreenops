import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { calculateMao, MaoPolicyError, type MaoInputs, type MaoPricingCriterion } from './mao.ts';
import { runAndPersistCashFlipAnalysis } from './cash_flip_analysis.ts';

export class CashMaoError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
    this.name = 'CashMaoError';
  }
}

interface WorkItem {
  id: string;
  agent_task_id: string;
  candidate_id: string | null;
  activation_count: number;
}

interface CriterionRow extends MaoPricingCriterion {
  workspace_id: string | null;
}

export async function runAndPersistCashMao(
  admin: SupabaseClient,
  workspaceId: string,
  agentId: string,
  opportunityId: string,
): Promise<Record<string, unknown>> {
  const work = await loadActiveWorkItem(admin, workspaceId, opportunityId);
  const inputs = await loadSuccessfulInputs(admin, work.id, work.activation_count);
  const criteria = await loadPricingCriteria(admin, workspaceId);

  let mao;
  try {
    mao = calculateMao(inputs, criteria);
  } catch (error) {
    if (error instanceof MaoPolicyError) throw new CashMaoError(409, error.code);
    throw error;
  }

  const { data: step, error: stepError } = await admin
    .from('cash_underwriting_steps')
    .upsert({
      workspace_id: workspaceId,
      cash_work_item_id: work.id,
      agent_task_id: work.agent_task_id,
      candidate_id: work.candidate_id,
      ghl_opportunity_id: opportunityId,
      activation_count: work.activation_count,
      phase: 'mao',
      status: 'succeeded',
      output: mao,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'cash_work_item_id,activation_count,phase',
    })
    .select('id, status, updated_at')
    .single();
  if (stepError || !step) throw new CashMaoError(500, 'mao_step_persist_failed');

  const progress = {
    phase: 'mao',
    status: 'succeeded',
    step_id: step.id,
    standard_mao: mao.standard_mao,
    standard_supported_range: mao.standard_supported_range,
    stretch_ceiling: mao.stretch_ceiling,
    stretch_supported_range: mao.stretch_supported_range,
    stretch_requires_human_approval: true,
    standard_pricing_rule_id: mao.pricing_policy.standard.criterion_id,
    standard_pricing_formula: mao.pricing_policy.standard.formula,
    stretch_pricing_rule_id: mao.pricing_policy.stretch.criterion_id,
    stretch_pricing_formula: mao.pricing_policy.stretch.formula,
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
  if (taskError) throw new CashMaoError(500, 'cash_task_mao_progress_update_failed');

  // Flip Analysis has no legitimate model-supplied economic assumptions. It is
  // run server-side after MAO and either calculates from an approved active
  // policy or persists needs_info with the exact missing policy fields.
  const flipAnalysis = await runAndPersistCashFlipAnalysis(
    admin,
    workspaceId,
    agentId,
    opportunityId,
  );
  const flipWorkStep = isRecord(flipAnalysis.work_step) ? flipAnalysis.work_step : {};
  const nextPhase = typeof flipWorkStep.next_phase === 'string'
    ? flipWorkStep.next_phase
    : 'flip_analysis';

  return {
    ...mao,
    flip_analysis: flipAnalysis,
    work_step: {
      persisted: true,
      work_item_id: work.id,
      agent_task_id: work.agent_task_id,
      step_id: step.id,
      phase: 'mao',
      status: 'succeeded',
      next_phase: nextPhase,
      flip_analysis_auto_evaluated: true,
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
  if (error) throw new CashMaoError(500, 'cash_work_lookup_failed');
  if (!data || data.length === 0) throw new CashMaoError(409, 'active_cash_work_item_required');
  if (data.length !== 1) throw new CashMaoError(409, 'cash_work_lookup_ambiguous');
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
): Promise<MaoInputs> {
  const { data, error } = await admin
    .from('cash_underwriting_steps')
    .select('phase, status, output')
    .eq('cash_work_item_id', workItemId)
    .eq('activation_count', activationCount)
    .eq('status', 'succeeded')
    .in('phase', ['cash_value', 'rehab']);
  if (error) throw new CashMaoError(500, 'mao_input_steps_lookup_failed');

  const steps = new Map<string, Record<string, unknown>>();
  for (const row of data ?? []) {
    if (typeof row.phase === 'string' && isRecord(row.output)) steps.set(row.phase, row.output);
  }
  const cashValueOutput = steps.get('cash_value');
  const rehabOutput = steps.get('rehab');
  if (!cashValueOutput) throw new CashMaoError(409, 'cash_value_required_before_mao');
  if (!rehabOutput) throw new CashMaoError(409, 'rehab_required_before_mao');

  const cashValueResult = record(cashValueOutput.cash_value);
  const supportedRange = record(cashValueResult.supported_range);
  const rehabTotal = record(rehabOutput.total);
  const cashValue = requiredNonNegativeNumber(cashValueResult.cash_value, 'cash_value');
  const cashValueLow = requiredNonNegativeNumber(supportedRange.low, 'cash_value_range_low');
  const cashValueHigh = requiredNonNegativeNumber(supportedRange.high, 'cash_value_range_high');
  const rehabLow = requiredNonNegativeNumber(rehabTotal.low, 'rehab_total_low');
  const rehabBase = requiredNonNegativeNumber(rehabTotal.base, 'rehab_total_base');
  const rehabHigh = requiredNonNegativeNumber(rehabTotal.high, 'rehab_total_high');

  return {
    cash_value: cashValue,
    cash_value_range: { low: cashValueLow, high: cashValueHigh },
    rehab_total: { low: rehabLow, base: rehabBase, high: rehabHigh },
  };
}

async function loadPricingCriteria(
  admin: SupabaseClient,
  workspaceId: string,
): Promise<MaoPricingCriterion[]> {
  const { data, error } = await admin
    .from('buy_box_criteria')
    .select('id, workspace_id, field, operator, value, hardness, label, notes')
    .eq('active', true)
    .eq('asset_class', 'fix_flip')
    .eq('rule_type', 'pricing')
    .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`);
  if (error) throw new CashMaoError(500, 'mao_pricing_rules_lookup_failed');

  const selected = new Map<string, CriterionRow>();
  for (const raw of data ?? []) {
    const row = raw as unknown as CriterionRow;
    const key = `${row.field}:${row.operator}`;
    const existing = selected.get(key);
    if (!existing || row.workspace_id === workspaceId) selected.set(key, row);
  }

  return [...selected.values()].map((row) => ({
    id: row.id,
    field: row.field,
    operator: row.operator,
    value: row.value,
    hardness: row.hardness,
    label: row.label,
    notes: row.notes,
  }));
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
  if (error || !data) throw new CashMaoError(500, 'cash_task_context_lookup_failed');
  const current = isRecord(data.context) ? data.context : {};
  return {
    ...current,
    cash_runtime_status: 'active',
    cash_progress: progress,
  };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new CashMaoError(500, `invalid_${field}`);
  return value.trim();
}

function requiredPositiveInteger(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new CashMaoError(500, `invalid_${field}`);
  return number;
}

function requiredNonNegativeNumber(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new CashMaoError(409, `invalid_${field}`);
  return number;
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
