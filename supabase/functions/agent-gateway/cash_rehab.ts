import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import {
  calculateAcquisitionRehabEstimate,
  type AcquisitionRehabAdderRate,
  type AcquisitionRehabAdderType,
  type AcquisitionRehabClass,
  type AcquisitionRehabClassRate,
  type AcquisitionRehabPolicy,
} from './acquisition_rehab.ts';
import {
  type RehabCategory,
  type RehabEvidenceClass,
  type RehabScopeItem,
  type RehabScopeLevel,
  type RehabSourceType,
} from './rehab.ts';
import { runAndPersistCashMao } from './cash_mao.ts';
import { ensureCashUnderwritingNote } from './cash_underwriting_note.ts';

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
  const cashValueOutput = await loadSuccessfulCashValue(admin, work.id, work.activation_count);
  const subject = record(cashValueOutput.subject);
  const subjectSqft = numberValue(subject.sqft);
  const candidateFacts = await loadCandidateFacts(admin, workspaceId, work.candidate_id);
  const policy = await loadActivePolicy(admin, workspaceId);
  const estimate = calculateAcquisitionRehabEstimate({
    subjectSqft,
    candidateFacts,
    scopeItems,
    policy,
  });
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
    rehab_contract: estimate.contract,
    rehab_class: estimate.classification.rehab_class,
    rehab_class_label: estimate.classification.label,
    rehab_classification_mode: estimate.classification.mode,
    rehab_total: estimate.total,
    modeled_rehab: estimate.modeled_rehab,
    modeled_rehab_basis: estimate.modeled_rehab_basis,
    contingency_pct: estimate.contingency_pct,
    confidence: estimate.confidence,
    known_adder_count: estimate.known_adders.length,
    unresolved_adder_count: estimate.unresolved_adders.length,
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

  // MAO remains deterministic. Acquisition Rehab supplies the server-approved
  // whole-property range; for default-unknown condition total.base is
  // deliberately the high side so MAO stays conservative until better evidence
  // replaces the assumption.
  const mao = await runAndPersistCashMao(admin, workspaceId, agentId, opportunityId);

  // The underwriting note is best-effort CRM presentation, not an authorization
  // boundary. It includes the exact selected sold comps persisted by CashValue,
  // rehab classification/range and pricing outputs so the acquisition team can
  // audit Cash's reasoning directly in HighLevel.
  const crmNote = await ensureCashUnderwritingNote(
    admin,
    workspaceId,
    opportunityId,
    work.id,
    work.activation_count,
  );

  return {
    ...estimate,
    mao,
    crm_note: crmNote,
    work_step: {
      persisted: true,
      work_item_id: work.id,
      agent_task_id: work.agent_task_id,
      step_id: step.id,
      phase: 'rehab',
      status: stepStatus,
      next_phase: 'flip_analysis',
      mao_auto_calculated: true,
      cash_underwriting_note_status: crmNote.status,
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

async function loadSuccessfulCashValue(
  admin: SupabaseClient,
  workItemId: string,
  activationCount: number,
): Promise<Record<string, unknown>> {
  const { data, error } = await admin
    .from('cash_underwriting_steps')
    .select('output')
    .eq('cash_work_item_id', workItemId)
    .eq('activation_count', activationCount)
    .eq('phase', 'cash_value')
    .eq('status', 'succeeded')
    .maybeSingle();
  if (error) throw new CashRehabError(500, 'cash_value_step_lookup_failed');
  if (!data || !isRecord(data.output)) throw new CashRehabError(409, 'cash_value_required_before_rehab');
  return data.output;
}

async function loadCandidateFacts(
  admin: SupabaseClient,
  workspaceId: string,
  candidateId: string | null,
): Promise<Record<string, unknown>> {
  if (!candidateId) return {};
  const { data, error } = await admin
    .from('ema_candidates')
    .select('extracted_facts')
    .eq('id', candidateId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error) throw new CashRehabError(500, 'rehab_candidate_lookup_failed');
  return isRecord(data?.extracted_facts) ? data.extracted_facts : {};
}

async function loadActivePolicy(
  admin: SupabaseClient,
  workspaceId: string,
): Promise<AcquisitionRehabPolicy | null> {
  const { data: policies, error: policyError } = await admin
    .from('acquisition_rehab_policies')
    .select('id, name, market, version, default_contingency_pct')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .limit(2);
  if (policyError) throw new CashRehabError(500, 'acquisition_rehab_policy_lookup_failed');
  if (!policies || policies.length === 0) return null;
  if (policies.length !== 1) throw new CashRehabError(500, 'multiple_active_acquisition_rehab_policies');

  const policy = policies[0] as Record<string, unknown>;
  const policyId = requiredString(policy.id, 'acquisition_rehab_policy_id');
  const [{ data: classRows, error: classError }, { data: adderRows, error: adderError }] = await Promise.all([
    admin
      .from('acquisition_rehab_class_rates')
      .select('rehab_class, per_sqft_low, per_sqft_base, per_sqft_high, minimum_rehab, notes, source_reference')
      .eq('policy_id', policyId)
      .eq('active', true),
    admin
      .from('acquisition_rehab_adders')
      .select('adder_type, unit, unit_cost_low, unit_cost_base, unit_cost_high, included_in_heavy_full, notes, source_reference')
      .eq('policy_id', policyId)
      .eq('active', true),
  ]);
  if (classError) throw new CashRehabError(500, 'acquisition_rehab_class_rates_lookup_failed');
  if (adderError) throw new CashRehabError(500, 'acquisition_rehab_adders_lookup_failed');

  return {
    id: policyId,
    name: requiredString(policy.name, 'acquisition_rehab_policy_name'),
    market: requiredString(policy.market, 'acquisition_rehab_policy_market'),
    version: requiredPositiveInteger(policy.version, 'acquisition_rehab_policy_version'),
    default_contingency_pct: requiredNumber(policy.default_contingency_pct, 'default_contingency_pct'),
    class_rates: (classRows ?? []).map((row) => normalizeClassRate(row as Record<string, unknown>)),
    adders: (adderRows ?? []).map((row) => normalizeAdderRate(row as Record<string, unknown>)),
  };
}

function normalizeClassRate(row: Record<string, unknown>): AcquisitionRehabClassRate {
  return {
    rehab_class: requiredString(row.rehab_class, 'rehab_class') as AcquisitionRehabClass,
    per_sqft_low: requiredNumber(row.per_sqft_low, 'per_sqft_low'),
    per_sqft_base: requiredNumber(row.per_sqft_base, 'per_sqft_base'),
    per_sqft_high: requiredNumber(row.per_sqft_high, 'per_sqft_high'),
    minimum_rehab: requiredNumber(row.minimum_rehab, 'minimum_rehab'),
    notes: typeof row.notes === 'string' ? row.notes : null,
    source_reference: typeof row.source_reference === 'string' ? row.source_reference : null,
  };
}

function normalizeAdderRate(row: Record<string, unknown>): AcquisitionRehabAdderRate {
  const unit = requiredString(row.unit, 'adder_unit');
  if (unit !== 'allowance' && unit !== 'each') throw new CashRehabError(500, 'invalid_adder_unit');
  return {
    adder_type: requiredString(row.adder_type, 'adder_type') as AcquisitionRehabAdderType,
    unit,
    unit_cost_low: requiredNumber(row.unit_cost_low, 'unit_cost_low'),
    unit_cost_base: requiredNumber(row.unit_cost_base, 'unit_cost_base'),
    unit_cost_high: requiredNumber(row.unit_cost_high, 'unit_cost_high'),
    included_in_heavy_full: row.included_in_heavy_full === true,
    notes: typeof row.notes === 'string' ? row.notes : null,
    source_reference: typeof row.source_reference === 'string' ? row.source_reference : null,
  };
}

/**
 * Compatibility input boundary for the current MCP schema.
 *
 * Acquisition Rehab no longer requires itemized kitchen/bath/flooring scope.
 * Cash may submit one summary evidence item (normally `misc`) describing the
 * overall condition, plus only specifically known big-ticket items such as roof,
 * HVAC, plumbing, electrical panel or windows. Candidate condition facts are
 * also loaded server-side and take precedence when available.
 */
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

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/[$,%\s,]/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
