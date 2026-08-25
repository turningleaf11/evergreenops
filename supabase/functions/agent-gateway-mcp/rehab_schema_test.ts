import { emailInputValidators } from './schemas.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

const opportunityId = '5BTfmPQlMolS62aCgIRC';
const scope = {
  category: 'roof',
  scope_level: 'replace',
  description: 'Inspection documents roof replacement.',
  evidence_class: 'verified',
  source_type: 'inspection',
  source_ref: 'inspection:roof-page-2',
  quantity: 1,
};

Deno.test('Acquisition Rehab MCP schema accepts opportunity alone', () => {
  assert(emailInputValidators.underwriting_rehab.safeParse({
    opportunity_id: opportunityId,
  }).success);
  assert(emailInputValidators.underwriting_rehab.safeParse({
    opportunity_id: opportunityId,
    scope_items: [],
  }).success);
});

Deno.test('Acquisition Rehab MCP schema accepts optional source-backed known repairs', () => {
  assert(emailInputValidators.underwriting_rehab.safeParse({
    opportunity_id: opportunityId,
    scope_items: [scope],
  }).success);
});

Deno.test('Acquisition Rehab MCP schema rejects model-controlled costs and contingency', () => {
  assert(!emailInputValidators.underwriting_rehab.safeParse({
    opportunity_id: opportunityId,
    scope_items: [{ ...scope, unit_cost_base: 1 }],
  }).success);
  assert(!emailInputValidators.underwriting_rehab.safeParse({
    opportunity_id: opportunityId,
    contingency_pct: 0,
  }).success);
});

Deno.test('Optional known repairs still reject assumptions and invalid evidence', () => {
  assert(!emailInputValidators.underwriting_rehab.safeParse({
    opportunity_id: opportunityId,
    scope_items: [{ ...scope, evidence_class: 'assumed' }],
  }).success);
  assert(!emailInputValidators.underwriting_rehab.safeParse({
    opportunity_id: opportunityId,
    scope_items: [{ ...scope, source_ref: '' }],
  }).success);
});
