import {
  ALLOWED_ACTIONS,
  parseGatewayRequest,
  RequestValidationError,
  summarizeGatewayInput,
} from './core.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`);
}

Deno.test('Cash work queue is an explicit Gateway action with no caller-controlled routing input', () => {
  assert(ALLOWED_ACTIONS.includes('underwriting.next_work_item'));
  const request = parseGatewayRequest({ action: 'underwriting.next_work_item', input: {} });
  assertEquals(request, { action: 'underwriting.next_work_item', input: {} });
  assertEquals(summarizeGatewayInput(request), {
    inputSummary: { contract: 'cash_work_queue_v1', work_kind: 'sfr_underwriting' },
    resourceType: 'cash_work_queue',
    resourceId: null,
  });
});

Deno.test('Cash work queue rejects caller-supplied pipeline, stage, work kind, or opportunity identity', () => {
  for (const input of [
    { pipeline_id: 'attacker_pipeline' },
    { stage_id: 'attacker_stage' },
    { work_kind: 'portfolio_napkin' },
    { opportunity_id: 'attacker_opportunity' },
  ]) {
    try {
      parseGatewayRequest({ action: 'underwriting.next_work_item', input });
      throw new Error('Expected queue input to be rejected');
    } catch (error) {
      assert(error instanceof RequestValidationError);
    }
  }
});
