import {
  PORTFOLIO_PIPELINE_ID,
  PORTFOLIO_READY_FOR_NAPKIN_STAGE_ID,
  SFR_PIPELINE_ID,
  SFR_UNDERWRITING_STAGE_ID,
  type HighLevelEnvelope,
  type ReconcileResult,
} from './core.ts';
import {
  processAuthenticatedStageActivation,
  type ActivationSignalResult,
  type StageActivationDependencies,
} from './activation_core.ts';

const WORKSPACE_ID = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9';
const LOCATION_ID = 'P1eXkPmyGMQD6hHTIQiC';

function assertEquals(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`);
}

function event(overrides: Partial<HighLevelEnvelope> = {}): HighLevelEnvelope {
  return {
    type: 'OpportunityStageUpdate',
    locationId: LOCATION_ID,
    opportunityId: 'opp_123',
    pipelineId: SFR_PIPELINE_ID,
    pipelineStageId: SFR_UNDERWRITING_STAGE_ID,
    webhookId: 'wh_123',
    eventTimestamp: '2026-08-28T17:00:00.000Z',
    rawMetadata: {},
    ...overrides,
  };
}

function context() {
  return {
    workspaceId: WORKSPACE_ID,
    expectedLocationId: LOCATION_ID,
    payloadSha256: 'a'.repeat(64),
    rawSizeBytes: 200,
    receivedAt: '2026-08-28T17:00:00.000Z',
  };
}

function deps(options: {
  duplicate?: boolean;
  candidate?: null | { id: string; cash_task_id: string | null; normalized_address: string | null };
  liveStage?: string;
  signal?: ActivationSignalResult;
  portfolio?: ReconcileResult;
} = {}) {
  const activations: Array<Record<string, unknown>> = [];
  const portfolios: Array<Record<string, unknown>> = [];
  const finalizations: Array<Record<string, unknown>> = [];
  const value: StageActivationDependencies = {
    reserve: async () => ({ eventId: 'event_123', duplicate: options.duplicate ?? false }),
    finalize: async (_eventId, input) => { finalizations.push(input as unknown as Record<string, unknown>); },
    getLiveOpportunity: async () => ({
      id: 'opp_123',
      location_id: LOCATION_ID,
      pipeline_id: event().pipelineId,
      stage_id: options.liveStage ?? event().pipelineStageId,
      name: '123 Main St',
    }),
    findCandidate: async () => options.candidate === null
      ? null
      : (options.candidate ?? { id: 'candidate_123', cash_task_id: null, normalized_address: '123 Main St' }),
    activateSfr: async (input) => {
      activations.push(input);
      return options.signal ?? {
        activation_signal_id: 'signal_123',
        activation_count: 1,
        reused_signal: false,
      };
    },
    reconcilePortfolio: async (input) => {
      portfolios.push(input);
      return options.portfolio ?? {
        work_item_id: 'portfolio_work_123',
        agent_task_id: 'portfolio_task_123',
        reused_work_item: false,
        reused_task: false,
        reopened: false,
        legacy_reconciled: false,
        activation_count: 1,
      };
    },
  };
  return { value, activations, portfolios, finalizations };
}

Deno.test('SFR Underwriting stage creates an activation signal without a Cash task or work item', async () => {
  const fake = deps();
  const result = await processAuthenticatedStageActivation(event(), context(), fake.value);
  assertEquals(result, { decision: 'activated', eventId: 'event_123', activationSignalId: 'signal_123' });
  assertEquals(fake.activations.length, 1);
  assertEquals(fake.portfolios.length, 0);
  const metadata = fake.finalizations[0].resultMetadata as Record<string, unknown>;
  assertEquals(metadata.activation_mode, 'signal_only');
  assertEquals(metadata.work_item_created, false);
  assertEquals(metadata.task_created, false);
});

Deno.test('manual GHL SFR can create a signal without an Ema candidate', async () => {
  const fake = deps({ candidate: null });
  await processAuthenticatedStageActivation(event(), context(), fake.value);
  assertEquals(fake.activations[0].candidateId, null);
});

Deno.test('Portfolio Ready for Napkin keeps the existing durable work-envelope path', async () => {
  const portfolioEvent = event({
    pipelineId: PORTFOLIO_PIPELINE_ID,
    pipelineStageId: PORTFOLIO_READY_FOR_NAPKIN_STAGE_ID,
  });
  const fake = deps();
  fake.value.getLiveOpportunity = async () => ({
    id: 'opp_123',
    location_id: LOCATION_ID,
    pipeline_id: PORTFOLIO_PIPELINE_ID,
    stage_id: PORTFOLIO_READY_FOR_NAPKIN_STAGE_ID,
    name: 'Portfolio Opportunity',
  });
  const result = await processAuthenticatedStageActivation(portfolioEvent, context(), fake.value);
  assertEquals(result.workItemId, 'portfolio_work_123');
  assertEquals(result.cashTaskId, 'portfolio_task_123');
  assertEquals(fake.activations.length, 0);
  assertEquals(fake.portfolios.length, 1);
});

Deno.test('duplicate stage delivery creates no second activation signal', async () => {
  const fake = deps({ duplicate: true });
  const result = await processAuthenticatedStageActivation(event(), context(), fake.value);
  assertEquals(result.decision, 'duplicate');
  assertEquals(fake.activations.length, 0);
});

Deno.test('live stage mismatch creates no activation signal', async () => {
  const fake = deps({ liveStage: 'dead_stage' });
  const result = await processAuthenticatedStageActivation(event(), context(), fake.value);
  assertEquals(result.decision, 'stale_or_mismatched_opportunity');
  assertEquals(fake.activations.length, 0);
});

Deno.test('wrong stage creates no activation signal', async () => {
  const fake = deps();
  const result = await processAuthenticatedStageActivation(event({ pipelineStageId: 'other_stage' }), context(), fake.value);
  assertEquals(result.decision, 'ignored_wrong_stage');
  assertEquals(fake.activations.length, 0);
});
