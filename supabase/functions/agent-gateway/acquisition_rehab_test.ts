import {
  calculateAcquisitionRehabEstimate,
  type AcquisitionRehabPolicy,
} from './acquisition_rehab.ts';
import type { RehabScopeItem } from './rehab.ts';

const policy: AcquisitionRehabPolicy = {
  id: 'policy-1',
  name: 'Evergreen Acquisition Rehab',
  market: 'South Florida',
  version: 1,
  default_contingency_pct: 10,
  class_rates: [
    rate('lipstick', 8, 10, 12, 10000),
    rate('light', 15, 20, 25, 20000),
    rate('medium', 30, 37.5, 45, 35000),
    rate('heavy', 50, 62.5, 75, 60000),
    rate('full_reno', 80, 100, 120, 90000),
  ],
  adders: [
    adder('roof', 'allowance', 8000, 11500, 15000, true),
    adder('hvac', 'allowance', 5000, 7500, 10000, true),
    adder('water_heater', 'allowance', 1200, 1850, 2500, true),
    adder('plumbing', 'allowance', 2000, 4000, 6000, true),
    adder('electrical_panel', 'allowance', 1500, 2750, 4000, true),
    adder('non_impact_windows', 'each', 300, 550, 800, true),
    adder('impact_windows', 'each', 800, 1300, 1800, true),
    adder('foundation', 'allowance', 5000, 10000, 15000, false),
  ],
};

Deno.test('cosmetic refresh becomes Light Rehab and uses normal base', () => {
  const result = calculateAcquisitionRehabEstimate({
    subjectSqft: 1080,
    candidateFacts: { condition: 'Cosmetic refresh candidate' },
    scopeItems: [],
    policy,
  });
  assertEquals(result.status, 'estimated');
  assertEquals(result.classification.rehab_class, 'light');
  assertEquals(result.classification.confidence, 'low');
  assertEquals(result.class_allowance, { low: 20000, base: 21600, high: 27000 });
  assertEquals(result.range_total, { low: 22000, base: 23760, high: 29700 });
  assertEquals(result.total, { low: 22000, base: 23760, high: 29700 });
  assertEquals(result.modeled_rehab, 23760);
  assertEquals(result.modeled_rehab_basis, 'base');
});

Deno.test('unknown condition defaults to Medium Low confidence and high-side modeled rehab', () => {
  const result = calculateAcquisitionRehabEstimate({
    subjectSqft: 1080,
    candidateFacts: {},
    scopeItems: [],
    policy,
  });
  assertEquals(result.status, 'estimated');
  assertEquals(result.classification.rehab_class, 'medium');
  assertEquals(result.classification.mode, 'default_unknown');
  assertEquals(result.classification.confidence, 'low');
  assertEquals(result.range_total, { low: 38500, base: 44550, high: 53460 });
  assertEquals(result.modeled_rehab, 53460);
  assertEquals(result.modeled_rehab_basis, 'high_due_to_unknown_condition');
  assertEquals(result.total, { low: 38500, base: 53460, high: 53460 });
});

Deno.test('known roof is additive to Light Rehab', () => {
  const result = calculateAcquisitionRehabEstimate({
    subjectSqft: 1080,
    candidateFacts: { condition: 'Light rehab' },
    scopeItems: [scope('roof', 'replace', 'Roof replacement required', 1)],
    policy,
  });
  assertEquals(result.status, 'estimated');
  assertEquals(result.known_adders.length, 1);
  assertEquals(result.known_adders[0].adder_type, 'roof');
  assertEquals(result.range_total, { low: 30800, base: 36410, high: 46200 });
});

Deno.test('known roof is not double counted inside Heavy Rehab', () => {
  const result = calculateAcquisitionRehabEstimate({
    subjectSqft: 1080,
    candidateFacts: { condition: 'Heavy rehab with major deferred maintenance' },
    scopeItems: [scope('roof', 'replace', 'Roof replacement required', 1)],
    policy,
  });
  assertEquals(result.status, 'estimated');
  assertEquals(result.classification.rehab_class, 'heavy');
  assertEquals(result.known_adders.length, 0);
  assertEquals(result.skipped_adders.length, 1);
  assertEquals(result.skipped_adders[0].reason, 'included_in_rehab_class');
});

Deno.test('foundation remains additive even for Heavy Rehab', () => {
  const result = calculateAcquisitionRehabEstimate({
    subjectSqft: 1080,
    candidateFacts: { condition: 'Heavy rehab' },
    scopeItems: [scope('misc', 'heavy', 'Foundation repair required', 1)],
    policy,
  });
  assertEquals(result.status, 'estimated');
  assertEquals(result.known_adders.length, 1);
  assertEquals(result.known_adders[0].adder_type, 'foundation');
});

Deno.test('known windows without impact type or quantity fail closed', () => {
  const result = calculateAcquisitionRehabEstimate({
    subjectSqft: 1080,
    candidateFacts: { condition: 'Light rehab' },
    scopeItems: [scope('windows_doors', 'replace', 'Replace windows', null)],
    policy,
  });
  assertEquals(result.status, 'needs_info');
  assertEquals(result.unresolved_adders.length, 1);
  assertEquals(result.unresolved_adders[0].reason, 'window_type_required');
});

function scope(
  category: RehabScopeItem['category'],
  scope_level: RehabScopeItem['scope_level'],
  description: string,
  quantity: number | null,
): RehabScopeItem {
  return {
    category,
    scope_level,
    description,
    evidence_class: 'source_claim',
    source_type: 'attachment',
    source_ref: `test:${category}`,
    quantity,
  };
}

function rate(
  rehab_class: AcquisitionRehabPolicy['class_rates'][number]['rehab_class'],
  per_sqft_low: number,
  per_sqft_base: number,
  per_sqft_high: number,
  minimum_rehab: number,
): AcquisitionRehabPolicy['class_rates'][number] {
  return {
    rehab_class,
    per_sqft_low,
    per_sqft_base,
    per_sqft_high,
    minimum_rehab,
    notes: null,
    source_reference: 'test',
  };
}

function adder(
  adder_type: AcquisitionRehabPolicy['adders'][number]['adder_type'],
  unit: AcquisitionRehabPolicy['adders'][number]['unit'],
  unit_cost_low: number,
  unit_cost_base: number,
  unit_cost_high: number,
  included_in_heavy_full: boolean,
): AcquisitionRehabPolicy['adders'][number] {
  return {
    adder_type,
    unit,
    unit_cost_low,
    unit_cost_base,
    unit_cost_high,
    included_in_heavy_full,
    notes: null,
    source_reference: 'test',
  };
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
