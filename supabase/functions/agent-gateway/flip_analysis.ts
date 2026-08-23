import type { CarryingFact } from './property_carrying_facts.ts';

export interface FlipAnalysisPolicy {
  id: string;
  name: string;
  market: string;
  version: number;
  acquisition_closing_cost_pct: number | null;
  sale_cost_pct: number | null;
  hold_months: number | null;
  monthly_utilities: number | null;
  monthly_maintenance: number | null;
  monthly_other_carry: number | null;
  source_reference: string;
  notes: string | null;
}

export interface FlipAnalysisInputs {
  cash_value: number;
  rehab_total: number;
  standard_mao: number;
  stretch_ceiling: number;
  carrying_facts: {
    property_taxes: CarryingFact;
    insurance: CarryingFact;
    hoa: CarryingFact;
  };
}

export interface FlipScenario {
  label: 'standard_mao' | 'stretch_ceiling';
  purchase_price: number;
  acquisition_closing_costs: number;
  rehab_total: number;
  monthly_carrying_costs: {
    property_taxes: number;
    insurance: number;
    utilities: number;
    maintenance: number;
    hoa: number;
    other: number;
    total: number;
  };
  carrying_fact_evidence: {
    property_taxes: Pick<CarryingFact, 'evidence_class' | 'source_ref' | 'as_of_year'>;
    insurance: Pick<CarryingFact, 'evidence_class' | 'source_ref' | 'as_of_year'>;
    hoa: Pick<CarryingFact, 'evidence_class' | 'source_ref' | 'as_of_year'>;
  };
  hold_months: number;
  carrying_costs_total: number;
  sale_price: number;
  sale_costs: number;
  net_sale_proceeds: number;
  total_project_cost: number;
  net_profit: number;
  return_on_cost_pct: number;
  profit_margin_on_sale_pct: number;
  break_even_sale_price: number;
  equity_spread_before_costs: number;
  requires_human_approval: boolean;
}

export interface FlipAnalysisResult {
  contract: 'flip_analysis_v2';
  status: 'calculated' | 'needs_info';
  basis: {
    financing: 'unlevered';
    assignment_fee: 'not_modeled';
    marketing_costs: 'not_modeled';
    sale_value_basis: 'cash_value';
    rehab_basis: 'successful_rehab_total_including_contingency';
    property_taxes_basis: 'deal_specific';
    insurance_basis: 'deal_specific';
    hoa_basis: 'deal_specific';
    utilities_maintenance_other_basis: 'evergreen_policy';
  };
  inputs: FlipAnalysisInputs;
  policy: {
    id: string | null;
    name: string | null;
    market: string | null;
    version: number | null;
    source_reference: string | null;
  };
  missing_policy_fields: string[];
  missing_input_fields: string[];
  standard: FlipScenario | null;
  stretch: FlipScenario | null;
  stretch_profit_compression: number | null;
  notes: string[];
}

const REQUIRED_POLICY_FIELDS = [
  'acquisition_closing_cost_pct',
  'sale_cost_pct',
  'hold_months',
  'monthly_utilities',
  'monthly_maintenance',
  'monthly_other_carry',
] as const;

export class FlipAnalysisError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = 'FlipAnalysisError';
  }
}

export function calculateFlipAnalysis(
  inputs: FlipAnalysisInputs,
  policy: FlipAnalysisPolicy | null,
): FlipAnalysisResult {
  validateInputs(inputs);
  const missingPolicy = missingPolicyFields(policy);
  const missingInputs = missingInputFields(inputs);
  const policySummary = {
    id: policy?.id ?? null,
    name: policy?.name ?? null,
    market: policy?.market ?? null,
    version: policy?.version ?? null,
    source_reference: policy?.source_reference ?? null,
  };

  const basis: FlipAnalysisResult['basis'] = {
    financing: 'unlevered',
    assignment_fee: 'not_modeled',
    marketing_costs: 'not_modeled',
    sale_value_basis: 'cash_value',
    rehab_basis: 'successful_rehab_total_including_contingency',
    property_taxes_basis: 'deal_specific',
    insurance_basis: 'deal_specific',
    hoa_basis: 'deal_specific',
    utilities_maintenance_other_basis: 'evergreen_policy',
  };

  if (missingPolicy.length > 0 || missingInputs.length > 0 || !policy) {
    return {
      contract: 'flip_analysis_v2',
      status: 'needs_info',
      basis,
      inputs,
      policy: policySummary,
      missing_policy_fields: missingPolicy,
      missing_input_fields: missingInputs,
      standard: null,
      stretch: null,
      stretch_profit_compression: null,
      notes: [
        'Flip Analysis will not invent acquisition, sale, hold-period, carrying-cost, or property-specific expense assumptions.',
        'Property taxes, insurance, and HOA must be resolved for the subject property; they are not market-wide policy defaults.',
        'Utilities, maintenance, miscellaneous carry, acquisition closing costs, sale costs, and hold period come from the active versioned Evergreen Flip Analysis Policy.',
        'Financing is intentionally excluded from V2 project economics and will be modeled separately as a capital-stack/levered-return layer.',
      ],
    };
  }

  validatePolicy(policy);
  const standard = scenario('standard_mao', inputs.standard_mao, inputs, policy, false);
  const stretch = scenario('stretch_ceiling', inputs.stretch_ceiling, inputs, policy, true);

  return {
    contract: 'flip_analysis_v2',
    status: 'calculated',
    basis,
    inputs,
    policy: policySummary,
    missing_policy_fields: [],
    missing_input_fields: [],
    standard,
    stretch,
    stretch_profit_compression: roundMoney(standard.net_profit - stretch.net_profit),
    notes: [
      'The standard scenario uses Evergreen’s 65% MAO purchase price; the stretch scenario uses the separate 68% human-review ceiling.',
      'Stretch economics are informational only and do not authorize Cash to price above the standard MAO.',
      'CashValue is used as the modeled sale value and the successful Rehab total including contingency is used as rehab cost.',
      'Property taxes, insurance, and HOA are carried from subject-specific evidence/source claims rather than fixed South Florida defaults.',
      'Current public-record property taxes may change after transfer/reassessment and must be surfaced as a risk where applicable.',
      'V2 is unlevered project economics. Debt proceeds, interest, points, lender fees, down payment and amortization are intentionally excluded.',
      'Assignment and marketing fees are not assumed. A source-backed deal-specific fee must use an approved later deal-cost input path.',
    ],
  };
}

export function missingPolicyFields(policy: FlipAnalysisPolicy | null): string[] {
  if (!policy) return [...REQUIRED_POLICY_FIELDS, 'source_reference'];
  const missing: string[] = [];
  for (const field of REQUIRED_POLICY_FIELDS) {
    if (policy[field] === null || policy[field] === undefined) missing.push(field);
  }
  if (!policy.source_reference?.trim()) missing.push('source_reference');
  return missing;
}

export function missingInputFields(inputs: FlipAnalysisInputs): string[] {
  const missing: string[] = [];
  if (inputs.carrying_facts.property_taxes.monthly === null) missing.push('property_taxes');
  if (inputs.carrying_facts.insurance.monthly === null) missing.push('insurance');
  if (inputs.carrying_facts.hoa.monthly === null) missing.push('hoa');
  return missing;
}

function scenario(
  label: FlipScenario['label'],
  purchasePrice: number,
  inputs: FlipAnalysisInputs,
  policy: FlipAnalysisPolicy,
  requiresHumanApproval: boolean,
): FlipScenario {
  const acquisitionPct = policy.acquisition_closing_cost_pct as number;
  const salePct = policy.sale_cost_pct as number;
  const holdMonths = policy.hold_months as number;
  const monthly = {
    property_taxes: inputs.carrying_facts.property_taxes.monthly as number,
    insurance: inputs.carrying_facts.insurance.monthly as number,
    utilities: policy.monthly_utilities as number,
    maintenance: policy.monthly_maintenance as number,
    hoa: inputs.carrying_facts.hoa.monthly as number,
    other: policy.monthly_other_carry as number,
    total: 0,
  };
  monthly.total = roundMoney(
    monthly.property_taxes + monthly.insurance + monthly.utilities +
    monthly.maintenance + monthly.hoa + monthly.other,
  );

  const acquisitionClosing = roundMoney(purchasePrice * acquisitionPct / 100);
  const carryTotal = roundMoney(monthly.total * holdMonths);
  const saleCosts = roundMoney(inputs.cash_value * salePct / 100);
  const netSaleProceeds = roundMoney(inputs.cash_value - saleCosts);
  const totalProjectCost = roundMoney(purchasePrice + acquisitionClosing + inputs.rehab_total + carryTotal);
  const netProfit = roundMoney(netSaleProceeds - totalProjectCost);
  const returnOnCost = totalProjectCost > 0 ? roundPct(netProfit / totalProjectCost * 100) : 0;
  const marginOnSale = inputs.cash_value > 0 ? roundPct(netProfit / inputs.cash_value * 100) : 0;
  const saleRetention = 1 - salePct / 100;
  const breakEvenSale = saleRetention > 0
    ? roundMoney((purchasePrice + acquisitionClosing + inputs.rehab_total + carryTotal) / saleRetention)
    : 0;

  return {
    label,
    purchase_price: purchasePrice,
    acquisition_closing_costs: acquisitionClosing,
    rehab_total: inputs.rehab_total,
    monthly_carrying_costs: monthly,
    carrying_fact_evidence: {
      property_taxes: evidence(inputs.carrying_facts.property_taxes),
      insurance: evidence(inputs.carrying_facts.insurance),
      hoa: evidence(inputs.carrying_facts.hoa),
    },
    hold_months: holdMonths,
    carrying_costs_total: carryTotal,
    sale_price: inputs.cash_value,
    sale_costs: saleCosts,
    net_sale_proceeds: netSaleProceeds,
    total_project_cost: totalProjectCost,
    net_profit: netProfit,
    return_on_cost_pct: returnOnCost,
    profit_margin_on_sale_pct: marginOnSale,
    break_even_sale_price: breakEvenSale,
    equity_spread_before_costs: roundMoney(inputs.cash_value - purchasePrice),
    requires_human_approval: requiresHumanApproval,
  };
}

function validateInputs(inputs: FlipAnalysisInputs): void {
  for (const [field, value] of Object.entries({
    cash_value: inputs.cash_value,
    rehab_total: inputs.rehab_total,
    standard_mao: inputs.standard_mao,
    stretch_ceiling: inputs.stretch_ceiling,
  })) {
    if (!Number.isFinite(value) || value < 0) throw new FlipAnalysisError(`invalid_${field}`);
  }
  if (inputs.stretch_ceiling < inputs.standard_mao) {
    throw new FlipAnalysisError('stretch_ceiling_below_standard_mao');
  }
  for (const [field, fact] of Object.entries(inputs.carrying_facts)) {
    if (fact.monthly !== null && (!Number.isFinite(fact.monthly) || fact.monthly < 0)) {
      throw new FlipAnalysisError(`invalid_${field}_monthly`);
    }
    if (fact.annual !== null && (!Number.isFinite(fact.annual) || fact.annual < 0)) {
      throw new FlipAnalysisError(`invalid_${field}_annual`);
    }
  }
}

function validatePolicy(policy: FlipAnalysisPolicy): void {
  const pctFields = [policy.acquisition_closing_cost_pct, policy.sale_cost_pct];
  for (const value of pctFields) {
    if (value === null || !Number.isFinite(value) || value < 0 || value >= 100) {
      throw new FlipAnalysisError('invalid_flip_policy_percentage');
    }
  }
  if (policy.hold_months === null || !Number.isInteger(policy.hold_months) || policy.hold_months < 1) {
    throw new FlipAnalysisError('invalid_flip_policy_hold_months');
  }
  for (const field of [
    policy.monthly_utilities,
    policy.monthly_maintenance,
    policy.monthly_other_carry,
  ]) {
    if (field === null || !Number.isFinite(field) || field < 0) {
      throw new FlipAnalysisError('invalid_flip_policy_carry_cost');
    }
  }
  if (!policy.source_reference.trim()) throw new FlipAnalysisError('flip_policy_source_reference_required');
}

function evidence(fact: CarryingFact): Pick<CarryingFact, 'evidence_class' | 'source_ref' | 'as_of_year'> {
  return {
    evidence_class: fact.evidence_class,
    source_ref: fact.source_ref,
    as_of_year: fact.as_of_year,
  };
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundPct(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
