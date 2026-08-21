import { calculateRehabEstimate, type RehabCostBook, type RehabScopeItem } from './rehab.ts';

const scope: RehabScopeItem[] = [
  {
    category: 'kitchen',
    scope_level: 'medium',
    description: 'Source-backed kitchen refresh scope.',
    evidence_class: 'verified',
    source_type: 'human_verified',
    source_ref: 'human:scope-1',
    quantity: null,
  },
  {
    category: 'flooring',
    scope_level: 'replace',
    description: 'Replace 1,200 sqft of flooring.',
    evidence_class: 'observed',
    source_type: 'inspection',
    source_ref: 'inspection:flooring',
    quantity: 1200,
  },
];

const book: RehabCostBook = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Test Cost Book',
  market: 'South Florida',
  version: 1,
  default_contingency_pct: 10,
  rates: [
    {
      category: 'kitchen',
      scope_level: 'medium',
      unit: 'allowance',
      unit_cost_low: 10000,
      unit_cost_base: 12000,
      unit_cost_high: 15000,
    },
    {
      category: 'flooring',
      scope_level: 'replace',
      unit: 'sqft',
      unit_cost_low: 4,
      unit_cost_base: 5,
      unit_cost_high: 6,
    },
  ],
};

Deno.test('rehab uses only cost-book pricing and applies contingency', () => {
  const result = calculateRehabEstimate(scope, book);
  if (result.status !== 'estimated') throw new Error(`expected estimated, got ${result.status}`);
  if (result.priced_item_count !== 2) throw new Error('expected two priced items');
  if (result.subtotal.base !== 18000) throw new Error(`unexpected subtotal ${result.subtotal.base}`);
  if (result.contingency?.base !== 1800) throw new Error('unexpected contingency');
  if (result.total?.base !== 19800) throw new Error('unexpected total');
  if (result.confidence !== 'medium') throw new Error('observed evidence should cap confidence at medium');
});

Deno.test('rehab does not price when cost book is unavailable', () => {
  const result = calculateRehabEstimate(scope, null);
  if (result.status !== 'needs_info') throw new Error('missing cost book must need info');
  if (result.total !== null) throw new Error('missing cost book must not produce total');
  if (result.unresolved_items.length !== 2) throw new Error('all scope items should remain unresolved');
});

Deno.test('rehab returns partial known subtotal and flags missing rate', () => {
  const partialBook: RehabCostBook = { ...book, rates: [book.rates[0]] };
  const result = calculateRehabEstimate(scope, partialBook);
  if (result.status !== 'needs_info') throw new Error('missing rate must need info');
  if (result.subtotal.base !== 12000) throw new Error('known subtotal should be preserved');
  if (result.total?.base !== 13200) throw new Error('partial known total should be preserved for review');
  if (result.unresolved_items[0]?.reason !== 'cost_book_rate_missing') throw new Error('expected missing rate reason');
  if (result.confidence !== 'low') throw new Error('unresolved scope must be low confidence');
});

Deno.test('rehab requires source-backed quantity for non-allowance rates', () => {
  const noQuantity = scope.map((item) => item.category === 'flooring' ? { ...item, quantity: null } : item);
  const result = calculateRehabEstimate(noQuantity, book);
  if (result.status !== 'needs_info') throw new Error('missing quantity must need info');
  if (!result.unresolved_items.some((item) => item.reason === 'quantity_required')) throw new Error('expected quantity blocker');
});

Deno.test('source claims cap rehab confidence at low', () => {
  const claimed = scope.map((item, index) => index === 0 ? { ...item, evidence_class: 'source_claim' as const } : { ...item, evidence_class: 'verified' as const });
  const result = calculateRehabEstimate(claimed, book);
  if (result.status !== 'estimated') throw new Error('fully priced claimed scope can still be estimated');
  if (result.confidence !== 'low') throw new Error('source claim should cap confidence at low');
});
