import {
  classifyTrigger,
  HIGHLEVEL_EVENT_TYPE,
  StageEventValidationError,
  type CandidateRef,
  type EventReservationInput,
  type FinalizeInput,
  type HighLevelEnvelope,
  type LiveOpportunity,
  type ReconcileResult,
  type ReservationResult,
  type StageDecision,
  type WorkKind,
} from './core.ts';

export interface ActivationSignalResult {
  activation_signal_id: string;
  activation_count: number;
  reused_signal: boolean;
}

export interface StageActivationDependencies {
  reserve(input: EventReservationInput): Promise<ReservationResult>;
  finalize(eventId: string, input: FinalizeInput): Promise<void>;
  getLiveOpportunity(opportunityId: string): Promise<LiveOpportunity | null>;
  findCandidate(opportunityId: string): Promise<CandidateRef | null>;
  activateSfr(input: {
    eventId: string;
    candidateId: string | null;
    opportunityId: string;
    pipelineId: string;
    stageId: string;
    activatedAt: string;
  }): Promise<ActivationSignalResult>;
  reconcilePortfolio(input: {
    eventId: string;
    candidateId: string | null;
    opportunityId: string;
    opportunityLabel: string | null;
    workKind: 'portfolio_napkin';
    pipelineId: string;
    stageId: string;
    activatedAt: string;
  }): Promise<ReconcileResult>;
}

export async function processAuthenticatedStageActivation(
  envelope: HighLevelEnvelope,
  context: {
    workspaceId: string;
    expectedLocationId: string;
    payloadSha256: string;
    rawSizeBytes: number;
    receivedAt: string;
  },
  deps: StageActivationDependencies,
): Promise<{
  decision: StageDecision;
  eventId: string;
  activationSignalId?: string;
  cashTaskId?: string;
  workItemId?: string;
}> {
  const deliveryKey = envelope.webhookId
    ? `webhook:${envelope.webhookId}`
    : `sha256:${context.payloadSha256}`;
  const reserved = await deps.reserve({
    deliveryKey,
    providerEventId: envelope.webhookId,
    payloadSha256: context.payloadSha256,
    rawSizeBytes: context.rawSizeBytes,
    envelope,
  });
  if (reserved.duplicate) return { decision: 'duplicate', eventId: reserved.eventId };

  const eventId = reserved.eventId;
  if (envelope.type !== HIGHLEVEL_EVENT_TYPE) {
    await deps.finalize(eventId, { decision: 'ignored_event_type' });
    return { decision: 'ignored_event_type', eventId };
  }
  if (!envelope.opportunityId || !envelope.pipelineId || !envelope.pipelineStageId) {
    await deps.finalize(eventId, { decision: 'malformed' });
    return { decision: 'malformed', eventId };
  }
  if (envelope.locationId !== context.expectedLocationId) {
    await deps.finalize(eventId, { decision: 'rejected_location' });
    return { decision: 'rejected_location', eventId };
  }

  const trigger = classifyTrigger(envelope.pipelineId, envelope.pipelineStageId);
  if (trigger.decision === 'ignored_wrong_pipeline' || trigger.decision === 'ignored_wrong_stage') {
    const decision: StageDecision = trigger.decision;
    await deps.finalize(eventId, { decision });
    return { decision, eventId };
  }
  if (!trigger.workKind) throw new StageEventValidationError('trigger work kind missing');

  const live = await deps.getLiveOpportunity(envelope.opportunityId);
  if (!live) {
    await deps.finalize(eventId, { decision: 'unknown_opportunity' });
    return { decision: 'unknown_opportunity', eventId };
  }
  if (
    live.id !== envelope.opportunityId ||
    live.location_id !== context.expectedLocationId ||
    live.pipeline_id !== envelope.pipelineId ||
    live.stage_id !== envelope.pipelineStageId
  ) {
    await deps.finalize(eventId, {
      decision: 'stale_or_mismatched_opportunity',
      resultMetadata: {
        live_pipeline_matches: live.pipeline_id === envelope.pipelineId,
        live_stage_matches: live.stage_id === envelope.pipelineStageId,
        live_location_matches: live.location_id === context.expectedLocationId,
      },
    });
    return { decision: 'stale_or_mismatched_opportunity', eventId };
  }

  const candidate = await deps.findCandidate(envelope.opportunityId);
  const activatedAt = envelope.eventTimestamp ?? context.receivedAt;

  if (trigger.workKind === 'sfr_underwriting') {
    const signal = await deps.activateSfr({
      eventId,
      candidateId: candidate?.id ?? null,
      opportunityId: envelope.opportunityId,
      pipelineId: envelope.pipelineId,
      stageId: envelope.pipelineStageId,
      activatedAt,
    });
    const decision: StageDecision = signal.reused_signal ? 'reconciled' : 'activated';
    await deps.finalize(eventId, {
      decision,
      candidateId: candidate?.id ?? null,
      resultMetadata: {
        activation_signal_id: signal.activation_signal_id,
        activation_count: signal.activation_count,
        work_kind: 'sfr_underwriting',
        subject_origin: candidate ? 'ema_candidate' : 'manual_ghl',
        activation_mode: 'signal_only',
        work_item_created: false,
        task_created: false,
      },
    });
    return {
      decision,
      eventId,
      activationSignalId: signal.activation_signal_id,
    };
  }

  if (trigger.workKind !== 'portfolio_napkin') {
    throw new StageEventValidationError(`unsupported work kind: ${String(trigger.workKind as WorkKind)}`);
  }

  const reconciled = await deps.reconcilePortfolio({
    eventId,
    candidateId: candidate?.id ?? null,
    opportunityId: envelope.opportunityId,
    opportunityLabel: live.name ?? candidate?.normalized_address ?? null,
    workKind: 'portfolio_napkin',
    pipelineId: envelope.pipelineId,
    stageId: envelope.pipelineStageId,
    activatedAt,
  });
  const decision: StageDecision = reconciled.reused_work_item || reconciled.reused_task
    ? 'reconciled'
    : 'activated';
  await deps.finalize(eventId, {
    decision,
    candidateId: candidate?.id ?? null,
    cashTaskId: reconciled.agent_task_id,
    resultMetadata: {
      work_item_id: reconciled.work_item_id,
      work_kind: 'portfolio_napkin',
      subject_origin: candidate ? 'ema_candidate' : 'manual_ghl',
      reused_work_item: reconciled.reused_work_item,
      reused_task: reconciled.reused_task,
      reopened: reconciled.reopened,
      legacy_reconciled: reconciled.legacy_reconciled,
      activation_count: reconciled.activation_count,
    },
  });
  return {
    decision,
    eventId,
    cashTaskId: reconciled.agent_task_id,
    workItemId: reconciled.work_item_id,
  };
}
