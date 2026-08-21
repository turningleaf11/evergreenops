import { calculateMao, MaoPolicyError, parseArvLessRepairsFormula, type MaoPricingCriterion } from './mao.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`);
}

const criteria: MaoPricingCriterion[] = [
  {
    id: 'standard-formula-rule',
    field: 'max_offer_rule',
    operator: 'formula',
    value: { rule: '0.65 * ARV - repairs' },
    hardness: 'hard',
    label: '65% ARV less repairs',
    notes: 'Standard Evergreen MAO',
  },
  {
    id: 'stretch-formula-rule',
    field: 'stretch_offer_rule',
    operator: 'formula',
    value: { rule: '0.68 * ARV - repairs' },
    hardness: 'soft',
    label: 'Stretch ceiling: 68% ARV less repairs',
    notes: 'Human approval required above standard MAO',
  },
  {
    id: 'arv-target',
    field: 'arv',
    operator: 'range',
    value: { min: 350000, max: 900000 },
    hardness: 'soft',
    label: 'ARV target $350K–$900K',
    notes: null,
  },
  {
    id: 'purchase-target',
    field: 'purchase_price',
    operator: 'range',
    value: { min: 150000, max: 750000 },
    hardness: 'soft',
    label: 'Purchase price $150K–$750K',
    notes: null,
  },
];

Deno.test('MAO uses 65% standard and keeps 68% as a separate stretch ceiling', () => {
  const result = calculateMao({
    cash_value: 550000,
    cash_value_range: { low: 525000, high: 575000 },
    rehab_total: { low: 45000, base: 50000, high: 60000 },
  }, criteria);

  assertEquals(result.standard_mao, 307500);
  assertEquals(result.standard_supported_range, {
    low: 281250,
    base: 307500,
    high: 328750,
  });
  assertEquals(result.stretch_ceiling, 324000);
  assertEquals(result.stretch_supported_range, {
    low: 297000,
    base: 324000,
    high: 346000,
  });
  assertEquals(result.pricing_policy.standard.arv_multiplier, 0.65);
  assertEquals(result.pricing_policy.stretch.arv_multiplier, 0.68);
  assertEquals(result.decision_boundary.autonomous_cash_ceiling, 307500);
  assertEquals(result.decision_boundary.human_review_ceiling, 324000);
  assert(result.decision_boundary.stretch_requires_human_approval === true);
  assertEquals(result.soft_targets.map((target) => target.status), ['within', 'within']);
});

Deno.test('MAO soft target bands never change standard or stretch formula outputs', () => {
  const result = calculateMao({
    cash_value: 300000,
    cash_value_range: { low: 290000, high: 310000 },
    rehab_total: { low: 20000, base: 25000, high: 30000 },
  }, criteria);
  assertEquals(result.standard_mao, 170000);
  assertEquals(result.stretch_ceiling, 179000);
  const arvTarget = result.soft_targets.find((target) => target.field === 'arv');
  assert(arvTarget?.status === 'below');
});

Deno.test('MAO formula parser accepts bounded ARV-less-repairs policy only', () => {
  assertEquals(parseArvLessRepairsFormula('0.65 * ARV - repairs'), 0.65);
  assertEquals(parseArvLessRepairsFormula('0.68 * ARV - repairs'), 0.68);
  for (const formula of ['ARV * 0.65 - repairs', '0.65 * ARV - repairs - 15000', '1.20 * ARV - repairs', 'eval(ARV)']) {
    try {
      parseArvLessRepairsFormula(formula);
      throw new Error('Expected policy rejection');
    } catch (error) {
      assert(error instanceof MaoPolicyError);
    }
  }
});

Deno.test('MAO fails closed without one supported standard and one stretch formula', () => {
  for (const ruleSet of [
    criteria.filter((criterion) => criterion.field !== 'max_offer_rule'),
    criteria.filter((criterion) => criterion.field !== 'stretch_offer_rule'),
    [...criteria, { ...criteria[0], id: 'duplicate-standard-formula' }],
    [...criteria, { ...criteria[1], id: 'duplicate-stretch-formula' }],
    [{ ...criteria[0], value: { rule: 'ARV - repairs' } }, ...criteria.slice(1)],
  ]) {
    try {
      calculateMao({
        cash_value: 500000,
        cash_value_range: { low: 480000, high: 520000 },
        rehab_total: { low: 40000, base: 50000, high: 60000 },
      }, ruleSet as MaoPricingCriterion[]);
      throw new Error('Expected policy rejection');
    } catch (error) {
      assert(error instanceof MaoPolicyError);
    }
  }
});

Deno.test('stretch multiplier must be above the standard MAO multiplier', () => {
  const invalid = criteria.map((criterion) =>
    criterion.field === 'stretch_offer_rule'
      ? { ...criterion, value: { rule: '0.64 * ARV - repairs' } }
      : criterion
  );
  try {
    calculateMao({
      cash_value: 500000,
      cash_value_range: { low: 480000, high: 520000 },
      rehab_total: { low: 40000, base: 50000, high: 60000 },
    }, invalid);
    throw new Error('Expected stretch policy rejection');
  } catch (error) {
    assert(error instanceof MaoPolicyError);
    assertEquals(error.code, 'mao_stretch_multiplier_must_exceed_standard');
  }
});
