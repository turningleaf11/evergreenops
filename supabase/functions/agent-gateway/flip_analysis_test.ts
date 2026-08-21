import {
  calculateFlipAnalysis,
  FlipAnalysisError,
  type FlipAnalysisInputs,
  type FlipAnalysisPolicy,
} from './flip_analysis.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`);
}

const inputs: FlipAnalysisInputs = {
  cash_value: 500000,
  rehab_total: 50000,
  standard_mao: 275000,
  stretch_ceiling: 290000,
};

const policy: FlipAnalysisPolicy = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Test South Florida Flip Policy',
  market: 'South Florida',
  version: 1,
  acquisition_closing_cost_pct: 2,
  sale_cost_pct: 7,
  hold_months: 6,
  monthly_property_taxes: 600,
  monthly_insurance: 400,
  monthly_utilities: 300,
  monthly_maintenance: 200,
  monthly_hoa: 0,
  monthly_other_carry: 0,
  source_reference: 'test:approved-policy',
  notes: null,
};

Deno.test('flip analysis computes standard and stretch unlevered scenarios', () => {
  const result = calculateFlipAnalysis(inputs, policy);
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

  assertEquals(result.stretch.purchase_price, 290000);
  assertEquals(result.stretch.requires_human_approval, true);
  assertEquals(result.stretch.net_profit, 110200);
  assertEquals(result.stretch_profit_compression, 15300);
  assertEquals(result.basis.financing, 'unlevered');
  assertEquals(result.basis.assignment_fee, 'not_modeled');
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

Deno.test('flip analysis requires every policy assumption to be explicitly populated', () => {
  const result = calculateFlipAnalysis(inputs, { ...policy, monthly_insurance: null });
  assertEquals(result.status, 'needs_info');
  assertEquals(result.missing_policy_fields, ['monthly_insurance']);
  assertEquals(result.standard, null);
});

Deno.test('zero is an explicit valid carrying-cost assumption', () => {
  const zeroCarry: FlipAnalysisPolicy = {
    ...policy,
    monthly_property_taxes: 0,
    monthly_insurance: 0,
    monthly_utilities: 0,
    monthly_maintenance: 0,
    monthly_hoa: 0,
    monthly_other_carry: 0,
  };
  const result = calculateFlipAnalysis(inputs, zeroCarry);
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

Deno.test('flip analysis rejects invalid percentages and negative carry costs', () => {
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
});
