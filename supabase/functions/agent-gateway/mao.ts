export interface MaoPricingCriterion {
  id: string;
  field: string;
  operator: string;
  value: unknown;
  hardness: string;
  label: string;
  notes: string | null;
}

export interface MaoInputs {
  cash_value: number;
  cash_value_range: { low: number; high: number };
  rehab_total: { low: number; base: number; high: number };
}

export interface MaoSoftTargetEvaluation {
  criterion_id: string;
  field: 'arv' | 'purchase_price';
  label: string;
  observed_value: number;
  target: { min: number; max: number };
  status: 'within' | 'below' | 'above';
}

export interface MaoResult {
  contract: 'mao_v1';
  status: 'calculated';
  pricing_rule: {
    criterion_id: string;
    label: string;
    formula: string;
    arv_multiplier: number;
    repair_deduction: 'rehab_total_including_contingency';
  };
  inputs: MaoInputs;
  maximum_allowable_offer: number;
  supported_offer_range: {
    low: number;
    base: number;
    high: number;
  };
  soft_targets: MaoSoftTargetEvaluation[];
  notes: string[];
}

export class MaoPolicyError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = 'MaoPolicyError';
  }
}

export function calculateMao(
  inputs: MaoInputs,
  criteria: MaoPricingCriterion[],
): MaoResult {
  validateInputs(inputs);
  const hardFormulaRules = criteria.filter((criterion) =>
    criterion.field === 'max_offer_rule' &&
    criterion.operator === 'formula' &&
    criterion.hardness === 'hard'
  );
  if (hardFormulaRules.length === 0) throw new MaoPolicyError('mao_pricing_formula_not_configured');
  if (hardFormulaRules.length !== 1) throw new MaoPolicyError('mao_pricing_formula_ambiguous');

  const formulaRule = hardFormulaRules[0];
  const formula = formulaString(formulaRule.value);
  const arvMultiplier = parseArvLessRepairsFormula(formula);
  const base = roundMoney(arvMultiplier * inputs.cash_value - inputs.rehab_total.base);
  const low = roundMoney(arvMultiplier * inputs.cash_value_range.low - inputs.rehab_total.high);
  const high = roundMoney(arvMultiplier * inputs.cash_value_range.high - inputs.rehab_total.low);

  const softTargets = criteria
    .filter((criterion) => criterion.hardness !== 'hard' && criterion.operator === 'range')
    .flatMap((criterion): MaoSoftTargetEvaluation[] => {
      if (criterion.field !== 'arv' && criterion.field !== 'purchase_price') return [];
      const target = numericRange(criterion.value);
      if (!target) return [];
      const observed = criterion.field === 'arv' ? inputs.cash_value : base;
      return [{
        criterion_id: criterion.id,
        field: criterion.field,
        label: criterion.label,
        observed_value: observed,
        target,
        status: observed < target.min ? 'below' : observed > target.max ? 'above' : 'within',
      }];
    });

  return {
    contract: 'mao_v1',
    status: 'calculated',
    pricing_rule: {
      criterion_id: formulaRule.id,
      label: formulaRule.label,
      formula,
      arv_multiplier: arvMultiplier,
      repair_deduction: 'rehab_total_including_contingency',
    },
    inputs,
    maximum_allowable_offer: base,
    supported_offer_range: { low, base, high },
    soft_targets: softTargets,
    notes: [
      'MAO V1 uses the successful source-backed CashValue as ARV and the successful Rehab total including contingency as repairs.',
      'The supported offer range applies the same active pricing formula to CashValue and Rehab low/high bounds; it is not a separate pricing rule.',
      'Soft ARV and purchase-price targets are informational only and do not override the hard max-offer formula.',
      'MAO is an underwriting ceiling for human review, not authorization to send an offer or accept terms.',
    ],
  };
}

export function parseArvLessRepairsFormula(formula: string): number {
  const normalized = formula.trim().replace(/\s+/g, ' ');
  const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)\s*\*\s*ARV\s*-\s*repairs$/i);
  if (!match) throw new MaoPolicyError('mao_pricing_formula_unsupported');
  const multiplier = Number(match[1]);
  if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 1) {
    throw new MaoPolicyError('mao_pricing_multiplier_invalid');
  }
  return multiplier;
}

function validateInputs(inputs: MaoInputs): void {
  for (const [field, value] of [
    ['cash_value', inputs.cash_value],
    ['cash_value_range.low', inputs.cash_value_range.low],
    ['cash_value_range.high', inputs.cash_value_range.high],
    ['rehab_total.low', inputs.rehab_total.low],
    ['rehab_total.base', inputs.rehab_total.base],
    ['rehab_total.high', inputs.rehab_total.high],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) throw new MaoPolicyError(`invalid_${field.replaceAll('.', '_')}`);
  }
  if (inputs.cash_value_range.low > inputs.cash_value_range.high) throw new MaoPolicyError('invalid_cash_value_range');
  if (inputs.rehab_total.low > inputs.rehab_total.base || inputs.rehab_total.base > inputs.rehab_total.high) {
    throw new MaoPolicyError('invalid_rehab_total_range');
  }
}

function formulaString(value: unknown): string {
  if (!isRecord(value) || typeof value.rule !== 'string' || !value.rule.trim()) {
    throw new MaoPolicyError('mao_pricing_formula_invalid');
  }
  return value.rule.trim();
}

function numericRange(value: unknown): { min: number; max: number } | null {
  if (!isRecord(value)) return null;
  const min = Number(value.min), max = Number(value.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return null;
  return { min, max };
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
