import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import {
  calculateRehabEstimate,
  type RehabCategory,
  type RehabCostBook,
  type RehabCostBookRate,
  type RehabEvidenceClass,
  type RehabScopeItem,
  type RehabScopeLevel,
  type RehabSourceType,
  type RehabUnit,
} from './rehab.ts';
import { runAndPersistCashMao } from './cash_mao.ts';

export class CashRehabError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
    this.name = 'CashRehabError';
  }
}

export async function runAndPersistCashRehab(
  admin: SupabaseClient,
  workspaceId: string,
  agentId: string,
  opportunityId: string,
  scopeItems: RehabScopeItem[],
): Promise<Record<string, unknown>> {
  const work = await loadActiveWorkItem(admin, workspaceId, opportunityId);
  await requireSuccessfulCashValue(admin, work.id, work.activation_count);
  const costBook = await loadActiveCostBook(admin, workspaceId);
  const estimate = calculateRehabEstimate(scopeItems, costBook);
  const stepStatus = estimate.status === 'estimated' ? 'succeeded' : 'needs_info';

  const { data: step, error: stepError } = await admin
    .from('cash_underwriting_steps')
    .upsert({
      workspace_id: workspaceId,
      cash_work_item_id: work.id,
      agent_task_id: work.agent_task_id,
      candidate_id: work.candidate_id,
      ghl_opportunity_id: opportunityId,
      activation_count: work.activation_count,
      phase: 'rehab',
      status: stepStatus,
      output: estimate,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'cash_work_item_id,activation_count,phase',
    })
    .select('id, status, updated_at')
    .single();
  if (stepError || !step) throw new CashRehabError(500, 'rehab_step_persist_failed');

  const progress = {
    phase: 'rehab',
    status: stepStatus,
    step_id: step.id,
    rehab_total: estimate.total,
    rehab_subtotal: estimate.subtotal,
    contingency_pct: estimate.contingency_pct,
    confidence: estimate.confidence,
    unresolved_item_count: estimate.unresolved_items.length,
    next_phase: stepStatus === 'succeeded' ? 'mao' : 'rehab',
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
  if (taskError) throw new CashRehabError(500, 'cash_task_rehab_progress_update_failed');

  if (stepStatus !== 'succeeded') {
    return {
      ...estimate,
      work_step: {
        persisted: true,
        work_item_id: work.id,
        agent_task_id: work.agent_task_id,
        step_id: step.id,
        phase: 'rehab',
        status: stepStatus,
        next_phase: 'rehab',
      },
    };
  }

  // MAO is deterministic once CashValue and Rehab have succeeded. It is run
  // server-side here so the agent never receives a model-facing input surface
  // for ARV, repair dollars, pricing multipliers, formulas, or stretch limits.
  const mao = await runAndPersistCashMao(admin, workspaceId, agentId, opportunityId);

  return {
    ...estimate,
    mao,
    work_step: {
      persisted: true,
      work_item_id: work.id,
      agent_task_id: work.agent_task_id,
      step_id: step.id,
      phase: 'rehab',
      status: stepStatus,
      next_phase: 'flip_analysis',
      mao_auto_calculated: true,
    },
  };
}

async function loadActiveWorkItem(
  admin: SupabaseClient,
  workspaceId: string,
  opportunityId: string,
): Promise<{
  id: string;
  agent_task_id: string;
  candidate_id: string | null;
  activation_count: number;
}> {
  const { data, error } = await admin
    .from('cash_work_items')
    .select('id, agent_task_id, candidate_id, activation_count, state')
    .eq('workspace_id', workspaceId)
    .eq('ghl_opportunity_id', opportunityId)
    .eq('work_kind', 'sfr_underwriting')
    .eq('state', 'active')
    .limit(2);
  if (error) throw new CashRehabError(500, 'cash_work_lookup_failed');
  if (!data || data.length === 0) throw new CashRehabError(409, 'active_cash_work_item_required');
  if (data.length !== 1) throw new CashRehabError(409, 'cash_work_lookup_ambiguous');
  const row = data[0] as Record<string, unknown>;
  return {
    id: requiredString(row.id, 'work_item_id'),
    agent_task_id: requiredString(row.agent_task_id, 'agent_task_id'),
    candidate_id: typeof row.candidate_id === 'string' ? row.candidate_id : null,
    activation_count: requiredPositiveInteger(row.activation_count, 'activation_count'),
  };
}

async function requireSuccessfulCashValue(
  admin: SupabaseClient,
  workItemId: string,
  activationCount: number,
): Promise<void> {
  const { data, error } = await admin
    .from('cash_underwriting_steps')
    .select('id')
    .eq('cash_work_item_id', workItemId)
    .eq('activation_count', activationCount)
    .eq('phase', 'cash_value')
    .eq('status', 'succeeded')
    .maybeSingle();
  if (error) throw new CashRehabError(500, 'cash_value_step_lookup_failed');
  if (!data) throw new CashRehabError(409, 'cash_value_required_before_rehab');
}

async function loadActiveCostBook(
  admin: SupabaseClient,
  workspaceId: string,
): Promise<RehabCostBook | null> {
  const { data: books, error: bookError } = await admin
    .from('rehab_cost_books')
    .select('id, name, market, version, default_contingency_pct')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .limit(2);
  if (bookError) throw new CashRehabError(500, 'rehab_cost_book_lookup_failed');
  if (!books || books.length === 0) return null;
  if (books.length !== 1) throw new CashRehabError(500, 'multiple_active_rehab_cost_books');

  const book = books[0] as Record<string, unknown>;
  const bookId = requiredString(book.id, 'rehab_cost_book_id');
  const { data: rateRows, error: rateError } = await admin
    .from('rehab_cost_book_items')
    .select('category, scope_level, unit, unit_cost_low, unit_cost_base, unit_cost_high, notes, source_reference')
    .eq('cost_book_id', bookId)
    .eq('active', true);
  if (rateError) throw new CashRehabError(500, 'rehab_cost_book_items_lookup_failed');

  return {
    id: bookId,
    name: requiredString(book.name, 'rehab_cost_book_name'),
    market: requiredString(book.market, 'rehab_cost_book_market'),
    version: requiredPositiveInteger(book.version, 'rehab_cost_book_version'),
    default_contingency_pct: requiredNumber(book.default_contingency_pct, 'default_contingency_pct'),
    rates: (rateRows ?? []).map((row) => normalizeRate(row as Record<string, unknown>)),
  };
}

function normalizeRate(row: Record<string, unknown>): RehabCostBookRate {
  return {
    category: requiredString(row.category, 'category') as RehabCategory,
    scope_level: requiredString(row.scope_level, 'scope_level') as RehabScopeLevel,
    unit: requiredString(row.unit, 'unit') as RehabUnit,
    unit_cost_low: requiredNumber(row.unit_cost_low, 'unit_cost_low'),
    unit_cost_base: requiredNumber(row.unit_cost_base, 'unit_cost_base'),
    unit_cost_high: requiredNumber(row.unit_cost_high, 'unit_cost_high'),
    notes: typeof row.notes === 'string' ? row.notes : null,
    source_reference: typeof row.source_reference === 'string' ? row.source_reference : null,
  };
}

export function normalizeRehabScopeItems(input: Array<Record<string, unknown>>): RehabScopeItem[] {
  return input.map((item) => ({
    category: requiredString(item.category, 'category') as RehabCategory,
    scope_level: requiredString(item.scope_level, 'scope_level') as RehabScopeLevel,
    description: requiredString(item.description, 'description'),
    evidence_class: requiredString(item.evidence_class, 'evidence_class') as RehabEvidenceClass,
    source_type: requiredString(item.source_type, 'source_type') as RehabSourceType,
    source_ref: requiredString(item.source_ref, 'source_ref'),
    quantity: item.quantity === null || item.quantity === undefined ? null : requiredNumber(item.quantity, 'quantity'),
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
  if (error || !data) throw new CashRehabError(500, 'cash_task_context_lookup_failed');
  const current = isRecord(data.context) ? data.context : {};
  return {
    ...current,
    cash_runtime_status: 'active',
    cash_progress: progress,
  };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new CashRehabError(500, `invalid_${field}`);
  return value.trim();
}

function requiredPositiveInteger(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new CashRehabError(500, `invalid_${field}`);
  return number;
}

function requiredNumber(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new CashRehabError(500, `invalid_${field}`);
  return number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
