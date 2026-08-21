import {
  buildWorkflowEnvelope,
  CashStageWorkflowValidationError,
  parseCashStageWorkflowRequest,
  verifyWorkflowBearer,
} from './core.ts';
import {
  PORTFOLIO_PIPELINE_ID,
  PORTFOLIO_READY_FOR_NAPKIN_STAGE_ID,
  SFR_PIPELINE_ID,
  SFR_UNDERWRITING_STAGE_ID,
  sha256Hex,
} from '../ghl-stage-events/core.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`);
}

Deno.test('workflow request accepts only an opportunity identity', () => {
  assertEquals(parseCashStageWorkflowRequest({ opportunity_id: 'opp_123' }), {
    opportunity_id: 'opp_123',
  });

  for (const payload of [
    { opportunity_id: 'opp_123', pipeline_id: SFR_PIPELINE_ID },
    { opportunity_id: 'opp_123', stage_id: SFR_UNDERWRITING_STAGE_ID },
    { opportunity_id: 'opp_123', workspace_id: 'workspace_attacker' },
  ]) {
    try {
      parseCashStageWorkflowRequest(payload);
      throw new Error('Expected unsupported workflow fields to be rejected');
    } catch (error) {
      assert(error instanceof CashStageWorkflowValidationError);
      assert(error.message.includes('unsupported fields'));
    }
  }
});

Deno.test('workflow bearer auth hashes the presented secret and rejects malformed credentials', async () => {
  const token = 'cash-stage-workflow-token_abcdefghijklmnopqrstuvwxyz0123456789';
  const expectedHash = await sha256Hex(token);

  assert(await verifyWorkflowBearer(`Bearer ${token}`, expectedHash));
  assert(!(await verifyWorkflowBearer(`Bearer ${token}-wrong`, expectedHash)));
  assert(!(await verifyWorkflowBearer(token, expectedHash)));
  assert(!(await verifyWorkflowBearer(null, expectedHash)));
  assert(!(await verifyWorkflowBearer(`Bearer ${token}`, 'not-a-hash')));
});

Deno.test('workflow envelope derives routing only from the live HighLevel opportunity', async () => {
  const live = {
    id: 'opp_123',
    location_id: 'location_123',
    pipeline_id: SFR_PIPELINE_ID,
    stage_id: SFR_UNDERWRITING_STAGE_ID,
    name: '123 Main St',
    date_updated: '2026-08-21T16:30:00.000Z',
  };

  const first = await buildWorkflowEnvelope(
    { opportunity_id: 'opp_123' },
    live,
    'location_123',
  );
  const retry = await buildWorkflowEnvelope(
    { opportunity_id: 'opp_123' },
    live,
    'location_123',
  );

  assertEquals(first.pipelineId, SFR_PIPELINE_ID);
  assertEquals(first.pipelineStageId, SFR_UNDERWRITING_STAGE_ID);
  assertEquals(first.locationId, 'location_123');
  assertEquals(first.webhookId, retry.webhookId);
  assertEquals(first.rawMetadata.source, 'ghl_workflow');
});

Deno.test('workflow event identity changes on a later live opportunity update', async () => {
  const first = await buildWorkflowEnvelope(
    { opportunity_id: 'opp_123' },
    {
      id: 'opp_123',
      location_id: 'location_123',
      pipeline_id: PORTFOLIO_PIPELINE_ID,
      stage_id: PORTFOLIO_READY_FOR_NAPKIN_STAGE_ID,
      date_updated: '2026-08-21T16:30:00.000Z',
    },
    'location_123',
  );
  const later = await buildWorkflowEnvelope(
    { opportunity_id: 'opp_123' },
    {
      id: 'opp_123',
      location_id: 'location_123',
      pipeline_id: PORTFOLIO_PIPELINE_ID,
      stage_id: PORTFOLIO_READY_FOR_NAPKIN_STAGE_ID,
      date_updated: '2026-08-21T17:30:00.000Z',
    },
    'location_123',
  );

  assert(first.webhookId !== later.webhookId);
});

Deno.test('workflow envelope fails closed when live identity or update timestamp is missing', async () => {
  for (const live of [
    {
      id: 'different_opp',
      location_id: 'location_123',
      pipeline_id: SFR_PIPELINE_ID,
      stage_id: SFR_UNDERWRITING_STAGE_ID,
      date_updated: '2026-08-21T16:30:00.000Z',
    },
    {
      id: 'opp_123',
      location_id: 'location_123',
      pipeline_id: SFR_PIPELINE_ID,
      stage_id: SFR_UNDERWRITING_STAGE_ID,
      date_updated: null,
    },
  ]) {
    try {
      await buildWorkflowEnvelope({ opportunity_id: 'opp_123' }, live, 'location_123');
      throw new Error('Expected workflow envelope construction to fail');
    } catch (error) {
      assert(error instanceof CashStageWorkflowValidationError);
    }
  }
});
