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
    id: 'formula-rule',
    field: 'max_offer_rule',
    operator: 'formula',
    value: { rule: '0.70 * ARV - repairs' },
    hardness: 'hard',
    label: '70% ARV less repairs',
    notes: 'Pricing rule, not a screen',
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

Deno.test('MAO applies active formula to CashValue and Rehab total', () => {
  const result = calculateMao({
    cash_value: 550000,
    cash_value_range: { low: 525000, high: 575000 },
    rehab_total: { low: 45000, base: 50000, high: 60000 },
  }, criteria);

  assertEquals(result.maximum_allowable_offer, 335000);
  assertEquals(result.supported_offer_range, {
    low: 307500,
    base: 335000,
    high: 357500,
  });
  assertEquals(result.pricing_rule.arv_multiplier, 0.7);
  assertEquals(result.pricing_rule.repair_deduction, 'rehab_total_including_contingency');
  assertEquals(result.soft_targets.map((target) => target.status), ['within', 'within']);
});

Deno.test('MAO soft target bands never change the hard formula output', () => {
  const result = calculateMao({
    cash_value: 300000,
    cash_value_range: { low: 290000, high: 310000 },
    rehab_total: { low: 20000, base: 25000, high: 30000 },
  }, criteria);
  assertEquals(result.maximum_allowable_offer, 185000);
  const arvTarget = result.soft_targets.find((target) => target.field === 'arv');
  assert(arvTarget?.status === 'below');
});

Deno.test('MAO formula parser accepts bounded ARV-less-repairs policy only', () => {
  assertEquals(parseArvLessRepairsFormula('0.70 * ARV - repairs'), 0.7);
  for (const formula of ['ARV * 0.70 - repairs', '0.70 * ARV - repairs - 15000', '1.20 * ARV - repairs', 'eval(ARV)']) {
    try {
      parseArvLessRepairsFormula(formula);
      throw new Error('Expected policy rejection');
    } catch (error) {
      assert(error instanceof MaoPolicyError);
    }
  }
});

Deno.test('MAO fails closed without one supported hard formula', () => {
  for (const ruleSet of [
    criteria.filter((criterion) => criterion.field !== 'max_offer_rule'),
    [...criteria, { ...criteria[0], id: 'duplicate-formula' }],
    [{ ...criteria[0], value: { rule: 'ARV - repairs' } }],
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
