import { isUntrustedExternalAction, parseGatewayRequest, RequestValidationError, summarizeGatewayInput } from './core.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`);
}

function assertThrows(fn: () => unknown) {
  try {
    fn();
  } catch (error) {
    assert(error instanceof RequestValidationError);
    return;
  }
  throw new Error('Expected function to throw');
}

const opportunityId = '5BTfmPQlMolS62aCgIRC';
const validScope = {
  category: 'roof',
  scope_level: 'replace',
  description: 'Inspection states the roof requires replacement.',
  evidence_class: 'verified',
  source_type: 'inspection',
  source_ref: 'inspection:roof-page-4',
  quantity: 1800,
};

Deno.test('Rehab V1 accepts only opportunity identity and source-backed scope', () => {
  const request = parseGatewayRequest({
    action: 'underwriting.rehab',
    input: { opportunity_id: opportunityId, scope_items: [validScope] },
  });
  assertEquals(request.action, 'underwriting.rehab');
  assertEquals(request.input.opportunity_id, opportunityId);
  assertEquals((request.input.scope_items as Array<Record<string, unknown>>)[0].category, 'roof');
  const summary = summarizeGatewayInput(request);
  assertEquals(summary.resourceType, 'ghl_opportunity');
  assertEquals(summary.resourceId, opportunityId);
  assertEquals(summary.inputSummary, {
    contract: 'rehab_v1',
    scope_item_count: 1,
    categories: ['roof'],
    evidence_classes: ['verified'],
  });
  assert(!JSON.stringify(summary).includes('inspection:roof-page-4'));
  assert(isUntrustedExternalAction('underwriting.rehab'));
});

Deno.test('Rehab V1 rejects caller-supplied costs, contingency, and routing fields', () => {
  assertThrows(() => parseGatewayRequest({
    action: 'underwriting.rehab',
    input: {
      opportunity_id: opportunityId,
      scope_items: [{ ...validScope, unit_cost_base: 1, unit: 'sqft' }],
    },
  }));
  assertThrows(() => parseGatewayRequest({
    action: 'underwriting.rehab',
    input: {
      opportunity_id: opportunityId,
      scope_items: [validScope],
      contingency_pct: 0,
    },
  }));
  assertThrows(() => parseGatewayRequest({
    action: 'underwriting.rehab',
    input: {
      opportunity_id: opportunityId,
      scope_items: [validScope],
      pipeline_id: 'attacker-selected',
    },
  }));
});

Deno.test('Rehab V1 rejects unsourced or invalid scope', () => {
  assertThrows(() => parseGatewayRequest({ action: 'underwriting.rehab', input: { opportunity_id: opportunityId, scope_items: [] } }));
  assertThrows(() => parseGatewayRequest({
    action: 'underwriting.rehab',
    input: { opportunity_id: opportunityId, scope_items: [{ ...validScope, source_ref: '' }] },
  }));
  assertThrows(() => parseGatewayRequest({
    action: 'underwriting.rehab',
    input: { opportunity_id: opportunityId, scope_items: [{ ...validScope, category: 'luxury_upgrade' }] },
  }));
  assertThrows(() => parseGatewayRequest({
    action: 'underwriting.rehab',
    input: { opportunity_id: opportunityId, scope_items: [{ ...validScope, evidence_class: 'assumed' }] },
  }));
  assertThrows(() => parseGatewayRequest({
    action: 'underwriting.rehab',
    input: { opportunity_id: opportunityId, scope_items: [{ ...validScope, quantity: -10 }] },
  }));
});
