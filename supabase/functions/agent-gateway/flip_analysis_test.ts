import {
  calculateFlipAnalysis,
  FlipAnalysisError,
  type FlipAnalysisInputs,
  type FlipAnalysisPolicy,
} from './flip_analysis.ts';
import type { CarryingFact } from './property_carrying_facts.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`);
}

function fact(monthly: number | null, evidence: CarryingFact['evidence_class'] = 'verified_public_record'): CarryingFact {
  return {
    monthly,
    annual: monthly === null ? null : monthly * 12,
    evidence_class: monthly === null ? 'unknown' : evidence,
    source_ref: monthly === null ? null : 'test:source',
    as_of_year: null,
  };
}

const inputs: FlipAnalysisInputs = {
  cash_value: 500000,
  rehab_total: 50000,
  standard_mao: 275000,
  stretch_ceiling: 290000,
  carrying_facts: {
    property_taxes: fact(600),
    insurance: fact(400, 'source_claim'),
    hoa: fact(0, 'verified_none'),
  },
};

const policy: FlipAnalysisPolicy = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Test South Florida Flip Policy',
  market: 'South Florida',
  version: 2,
  acquisition_closing_cost_pct: 2,
  sale_cost_pct: 7,
  hold_months: 6,
  monthly_utilities: 300,
  monthly_maintenance: 200,
  monthly_other_carry: 0,
  source_reference: 'test:approved-policy',
  notes: null,
};

Deno.test('flip analysis computes standard and stretch using deal-specific tax insurance and HOA', () => {
  const result = calculateFlipAnalysis(inputs, policy);
  assertEquals(result.contract, 'flip_analysis_v2');
  assertEquals(result.status, 'calculated');
  assert(result.standard !== null);
  assert(result.stretch !== null);

  assertEquals(result.standard.purchase_price, 275000);
  assertEquals(result.standard.acquisition_closing_costs, 5500);
  assertEquals(result.standard.monthly_carrying_costs.total, 1500);
  assertEquals(result.standard.carrying_costs_total, 9000);
  assertEquals(result.standard.sale_costs, 35000);
  assertEquals(result.standard.net_sale_proceeds, 465000);
  assertEquals(result.standard.total_project_cost, 339500);
  assertEquals(result.standard.net_profit, 125500);
  assertEquals(result.standard.return_on_cost_pct, 36.97);
  assertEquals(result.standard.profit_margin_on_sale_pct, 25.1);
  assertEquals(result.standard.requires_human_approval, false);
  assertEquals(result.standard.carrying_fact_evidence.insurance.evidence_class, 'source_claim');

  assertEquals(result.stretch.purchase_price, 290000);
  assertEquals(result.stretch.requires_human_approval, true);
  assertEquals(result.stretch.net_profit, 110200);
  assertEquals(result.stretch_profit_compression, 15300);
  assertEquals(result.basis.financing, 'unlevered');
  assertEquals(result.basis.property_taxes_basis, 'deal_specific');
});

Deno.test('flip analysis fails closed when no active policy is available', () => {
  const result = calculateFlipAnalysis(inputs, null);
  assertEquals(result.status, 'needs_info');
  assertEquals(result.standard, null);
  assertEquals(result.stretch, null);
  assert(result.missing_policy_fields.includes('sale_cost_pct'));
  assert(result.missing_policy_fields.includes('hold_months'));
  assert(result.missing_policy_fields.includes('source_reference'));
});

Deno.test('flip analysis requires true policy assumptions to be explicitly populated', () => {
  const result = calculateFlipAnalysis(inputs, { ...policy, monthly_utilities: null });
  assertEquals(result.status, 'needs_info');
  assertEquals(result.missing_policy_fields, ['monthly_utilities']);
  assertEquals(result.standard, null);
});

Deno.test('flip analysis requires property-specific insurance instead of market default', () => {
  const result = calculateFlipAnalysis({
    ...inputs,
    carrying_facts: { ...inputs.carrying_facts, insurance: fact(null) },
  }, policy);
  assertEquals(result.status, 'needs_info');
  assertEquals(result.missing_input_fields, ['insurance']);
  assertEquals(result.standard, null);
});

Deno.test('zero is an explicit valid property carrying fact', () => {
  const zeroCarry: FlipAnalysisInputs = {
    ...inputs,
    carrying_facts: {
      property_taxes: fact(0, 'verified_none'),
      insurance: fact(0, 'verified_none'),
      hoa: fact(0, 'verified_none'),
    },
  };
  const zeroPolicy: FlipAnalysisPolicy = {
    ...policy,
    monthly_utilities: 0,
    monthly_maintenance: 0,
    monthly_other_carry: 0,
  };
  const result = calculateFlipAnalysis(zeroCarry, zeroPolicy);
  assertEquals(result.status, 'calculated');
  assertEquals(result.standard?.carrying_costs_total, 0);
});

Deno.test('stretch purchase price may not be below standard MAO', () => {
  try {
    calculateFlipAnalysis({ ...inputs, stretch_ceiling: 274999 }, policy);
    throw new Error('Expected rejection');
  } catch (error) {
    assert(error instanceof FlipAnalysisError);
    assertEquals(error.code, 'stretch_ceiling_below_standard_mao');
  }
});

Deno.test('flip analysis rejects invalid percentages policy carry and deal carry', () => {
  for (const invalidPolicy of [
    { ...policy, sale_cost_pct: 100 },
    { ...policy, acquisition_closing_cost_pct: -1 },
    { ...policy, monthly_utilities: -1 },
    { ...policy, hold_months: 0 },
  ]) {
    try {
      calculateFlipAnalysis(inputs, invalidPolicy);
      throw new Error('Expected policy rejection');
    } catch (error) {
      assert(error instanceof FlipAnalysisError);
    }
  }

  try {
    calculateFlipAnalysis({
      ...inputs,
      carrying_facts: {
        ...inputs.carrying_facts,
        insurance: { ...inputs.carrying_facts.insurance, monthly: -1 },
      },
    }, policy);
    throw new Error('Expected deal-carry rejection');
  } catch (error) {
    assert(error instanceof FlipAnalysisError);
    assertEquals(error.code, 'invalid_insurance_monthly');
  }
});
