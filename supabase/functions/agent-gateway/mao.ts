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

export interface MaoFormulaPolicy {
  criterion_id: string;
  label: string;
  formula: string;
  arv_multiplier: number;
  repair_deduction: 'rehab_total_including_contingency';
}

export interface MaoResult {
  contract: 'mao_v1';
  status: 'calculated';
  pricing_policy: {
    standard: MaoFormulaPolicy;
    stretch: MaoFormulaPolicy & {
      requires_human_approval: true;
    };
  };
  inputs: MaoInputs;
  standard_mao: number;
  standard_supported_range: {
    low: number;
    base: number;
    high: number;
  };
  stretch_ceiling: number;
  stretch_supported_range: {
    low: number;
    base: number;
    high: number;
  };
  decision_boundary: {
    autonomous_cash_ceiling: number;
    human_review_ceiling: number;
    stretch_requires_human_approval: true;
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

  const standardRule = oneFormulaRule(
    criteria,
    'max_offer_rule',
    'hard',
    'mao_pricing_formula_not_configured',
    'mao_pricing_formula_ambiguous',
  );
  const stretchRule = oneFormulaRule(
    criteria,
    'stretch_offer_rule',
    'soft',
    'mao_stretch_formula_not_configured',
    'mao_stretch_formula_ambiguous',
  );

  const standardFormula = formulaString(standardRule.value);
  const stretchFormula = formulaString(stretchRule.value);
  const standardMultiplier = parseArvLessRepairsFormula(standardFormula);
  const stretchMultiplier = parseArvLessRepairsFormula(stretchFormula);
  if (stretchMultiplier <= standardMultiplier) {
    throw new MaoPolicyError('mao_stretch_multiplier_must_exceed_standard');
  }

  const standard = offerBand(inputs, standardMultiplier);
  const stretch = offerBand(inputs, stretchMultiplier);

  const softTargets = criteria
    .filter((criterion) => criterion.hardness !== 'hard' && criterion.operator === 'range')
    .flatMap((criterion): MaoSoftTargetEvaluation[] => {
      if (criterion.field !== 'arv' && criterion.field !== 'purchase_price') return [];
      const target = numericRange(criterion.value);
      if (!target) return [];
      const observed = criterion.field === 'arv' ? inputs.cash_value : standard.base;
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
    pricing_policy: {
      standard: formulaPolicy(standardRule, standardFormula, standardMultiplier),
      stretch: {
        ...formulaPolicy(stretchRule, stretchFormula, stretchMultiplier),
        requires_human_approval: true,
      },
    },
    inputs,
    standard_mao: standard.base,
    standard_supported_range: standard,
    stretch_ceiling: stretch.base,
    stretch_supported_range: stretch,
    decision_boundary: {
      autonomous_cash_ceiling: standard.base,
      human_review_ceiling: stretch.base,
      stretch_requires_human_approval: true,
    },
    soft_targets: softTargets,
    notes: [
      'The standard MAO is Evergreen’s normal pricing ceiling. The stretch ceiling is separate and is not the default MAO.',
      'Cash may calculate and display the stretch ceiling but may not autonomously price above the standard MAO; stretch pricing requires human approval.',
      'Both formulas use the successful source-backed CashValue as ARV and the successful Rehab total including contingency as repairs.',
      'The supported ranges apply each active pricing formula to CashValue and Rehab low/high bounds; valuation uncertainty is kept separate from pricing-policy stretch.',
      'Soft ARV and purchase-price targets are informational only and do not override the standard or stretch formula.',
      'MAO output is underwriting guidance for human review, not authorization to send an offer or accept terms.',
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

function oneFormulaRule(
  criteria: MaoPricingCriterion[],
  field: string,
  hardness: string,
  missingCode: string,
  ambiguousCode: string,
): MaoPricingCriterion {
  const matches = criteria.filter((criterion) =>
    criterion.field === field &&
    criterion.operator === 'formula' &&
    criterion.hardness === hardness
  );
  if (matches.length === 0) throw new MaoPolicyError(missingCode);
  if (matches.length !== 1) throw new MaoPolicyError(ambiguousCode);
  return matches[0];
}

function formulaPolicy(
  rule: MaoPricingCriterion,
  formula: string,
  multiplier: number,
): MaoFormulaPolicy {
  return {
    criterion_id: rule.id,
    label: rule.label,
    formula,
    arv_multiplier: multiplier,
    repair_deduction: 'rehab_total_including_contingency',
  };
}

function offerBand(
  inputs: MaoInputs,
  multiplier: number,
): { low: number; base: number; high: number } {
  return {
    low: roundMoney(multiplier * inputs.cash_value_range.low - inputs.rehab_total.high),
    base: roundMoney(multiplier * inputs.cash_value - inputs.rehab_total.base),
    high: roundMoney(multiplier * inputs.cash_value_range.high - inputs.rehab_total.low),
  };
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
