import { emailInputValidators } from './schemas.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

const opportunityId = '5BTfmPQlMolS62aCgIRC';
const scope = {
  category: 'flooring',
  scope_level: 'replace',
  description: 'Inspection documents 1,200 sqft flooring replacement.',
  evidence_class: 'verified',
  source_type: 'inspection',
  source_ref: 'inspection:flooring-page-2',
  quantity: 1200,
};

Deno.test('Rehab MCP schema accepts source-backed scope only', () => {
  assert(emailInputValidators.underwriting_rehab.safeParse({
    opportunity_id: opportunityId,
    scope_items: [scope],
  }).success);
});

Deno.test('Rehab MCP schema rejects model-controlled costs and contingency', () => {
  assert(!emailInputValidators.underwriting_rehab.safeParse({
    opportunity_id: opportunityId,
    scope_items: [{ ...scope, unit_cost_base: 1 }],
  }).success);
  assert(!emailInputValidators.underwriting_rehab.safeParse({
    opportunity_id: opportunityId,
    scope_items: [scope],
    contingency_pct: 0,
  }).success);
});

Deno.test('Rehab MCP schema rejects assumptions and invalid scope', () => {
  assert(!emailInputValidators.underwriting_rehab.safeParse({
    opportunity_id: opportunityId,
    scope_items: [{ ...scope, evidence_class: 'assumed' }],
  }).success);
  assert(!emailInputValidators.underwriting_rehab.safeParse({
    opportunity_id: opportunityId,
    scope_items: [{ ...scope, source_ref: '' }],
  }).success);
  assert(!emailInputValidators.underwriting_rehab.safeParse({
    opportunity_id: opportunityId,
    scope_items: [],
  }).success);
});
