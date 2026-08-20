export const HIGHLEVEL_EVENT_TYPE = 'OpportunityStageUpdate';
export const HIGHLEVEL_ED25519_PUBLIC_KEY_SPKI_BASE64 =
  'MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=';
export const MAX_WEBHOOK_BYTES = 64 * 1024;

export const SFR_PIPELINE_ID = 'w3OtDJjCdN840Hwb1fpt';
export const SFR_UNDERWRITING_STAGE_ID = '1c3468f6-1a5d-4025-bf20-2bc4bd195708';
export const PORTFOLIO_PIPELINE_ID = 'K6YsnZw6qhYLvXSvuixD';
export const PORTFOLIO_READY_FOR_NAPKIN_STAGE_ID = 'a4c70dff-3832-427f-adb7-a3945a175783';

export type WorkKind = 'sfr_underwriting' | 'portfolio_napkin';
export type StageDecision =
  | 'malformed'
  | 'ignored_event_type'
  | 'rejected_location'
  | 'ignored_wrong_pipeline'
  | 'ignored_wrong_stage'
  | 'stale_or_mismatched_opportunity'
  | 'unknown_opportunity'
  | 'activated'
  | 'reconciled'
  | 'duplicate'
  | 'failed';

export interface HighLevelEnvelope {
  type: string;
  locationId: string;
  opportunityId: string | null;
  pipelineId: string | null;
  pipelineStageId: string | null;
  webhookId: string | null;
  eventTimestamp: string | null;
  rawMetadata: Record<string, unknown>;
}

export interface LiveOpportunity {
  id: string;
  location_id: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  name?: string | null;
}

export interface CandidateRef {
  id: string;
  cash_task_id: string | null;
  normalized_address: string | null;
}

export interface ReconcileResult {
  work_item_id: string;
  agent_task_id: string;
  reused_work_item: boolean;
  reused_task: boolean;
  reopened: boolean;
  legacy_reconciled: boolean;
  activation_count: number;
}

export interface ReservationResult {
  eventId: string;
  duplicate: boolean;
}

export interface EventReservationInput {
  deliveryKey: string;
  providerEventId: string | null;
  payloadSha256: string;
  rawSizeBytes: number;
  envelope: HighLevelEnvelope;
}

export interface FinalizeInput {
  decision: StageDecision;
  candidateId?: string | null;
  cashTaskId?: string | null;
  resultMetadata?: Record<string, unknown>;
}

export interface StageEventDependencies {
  reserve(input: EventReservationInput): Promise<ReservationResult>;
  finalize(eventId: string, input: FinalizeInput): Promise<void>;
  getLiveOpportunity(opportunityId: string): Promise<LiveOpportunity | null>;
  findCandidate(opportunityId: string): Promise<CandidateRef | null>;
  reconcile(input: {
    eventId: string;
    candidateId: string;
    opportunityId: string;
    workKind: WorkKind;
    pipelineId: string;
    stageId: string;
    activatedAt: string;
  }): Promise<ReconcileResult>;
}

export class StageEventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StageEventValidationError';
  }
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyHighLevelSignature(
  rawBody: string,
  signatureHeader: string | null,
  publicKeySpkiBase64 = HIGHLEVEL_ED25519_PUBLIC_KEY_SPKI_BASE64,
): Promise<boolean> {
  if (!signatureHeader || signatureHeader === 'N/A' || signatureHeader.length > 512) return false;
  try {
    const signature = decodeBase64(signatureHeader);
    if (signature.byteLength !== 64) return false;
    const key = await crypto.subtle.importKey(
      'spki',
      decodeBase64(publicKeySpkiBase64),
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      signature,
      new TextEncoder().encode(rawBody),
    );
  } catch {
    return false;
  }
}

export function parseHighLevelEnvelope(value: unknown): HighLevelEnvelope {
  if (!isRecord(value)) throw new StageEventValidationError('payload must be an object');
  const type = requiredString(value.type, 'type', 1, 100);
  const locationId = requiredId(value.locationId, 'locationId');
  const opportunityId = optionalId(value.id ?? value.opportunityId ?? recordValue(value.opportunity, 'id'), 'id');
  const pipelineId = optionalId(value.pipelineId, 'pipelineId');
  const pipelineStageId = optionalId(value.pipelineStageId ?? value.stageId, 'pipelineStageId');
  const webhookId = optionalId(value.webhookId, 'webhookId');
  const eventTimestamp = normalizeTimestamp(value.timestamp);

  return {
    type,
    locationId,
    opportunityId,
    pipelineId,
    pipelineStageId,
    webhookId,
    eventTimestamp,
    rawMetadata: {
      webhook_id: webhookId,
      timestamp: safeScalar(value.timestamp),
      type,
      location_id: locationId,
      opportunity_id: opportunityId,
      pipeline_id: pipelineId,
      stage_id: pipelineStageId,
    },
  };
}

export function classifyTrigger(
  pipelineId: string,
  stageId: string,
): { workKind: WorkKind | null; decision: 'trigger' | 'ignored_wrong_pipeline' | 'ignored_wrong_stage' } {
  if (pipelineId === SFR_PIPELINE_ID) {
    return stageId === SFR_UNDERWRITING_STAGE_ID
      ? { workKind: 'sfr_underwriting', decision: 'trigger' }
      : { workKind: null, decision: 'ignored_wrong_stage' };
  }
  if (pipelineId === PORTFOLIO_PIPELINE_ID) {
    return stageId === PORTFOLIO_READY_FOR_NAPKIN_STAGE_ID
      ? { workKind: 'portfolio_napkin', decision: 'trigger' }
      : { workKind: null, decision: 'ignored_wrong_stage' };
  }
  return { workKind: null, decision: 'ignored_wrong_pipeline' };
}

export async function processAuthenticatedStageEvent(
  envelope: HighLevelEnvelope,
  context: {
    workspaceId: string;
    expectedLocationId: string;
    payloadSha256: string;
    rawSizeBytes: number;
    receivedAt: string;
  },
  deps: StageEventDependencies,
): Promise<{ decision: StageDecision; eventId: string; cashTaskId?: string; workItemId?: string }> {
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
  if (trigger.decision !== 'trigger' || !trigger.workKind) {
    await deps.finalize(eventId, { decision: trigger.decision });
    return { decision: trigger.decision, eventId };
  }

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
  if (!candidate) {
    await deps.finalize(eventId, { decision: 'unknown_opportunity' });
    return { decision: 'unknown_opportunity', eventId };
  }

  const reconciled = await deps.reconcile({
    eventId,
    candidateId: candidate.id,
    opportunityId: envelope.opportunityId,
    workKind: trigger.workKind,
    pipelineId: envelope.pipelineId,
    stageId: envelope.pipelineStageId,
    activatedAt: envelope.eventTimestamp ?? context.receivedAt,
  });
  const decision: StageDecision = reconciled.reused_work_item || reconciled.reused_task
    ? 'reconciled'
    : 'activated';
  await deps.finalize(eventId, {
    decision,
    candidateId: candidate.id,
    cashTaskId: reconciled.agent_task_id,
    resultMetadata: {
      work_item_id: reconciled.work_item_id,
      work_kind: trigger.workKind,
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

function requiredId(value: unknown, field: string): string {
  return requiredStringId(value, field, false)!;
}

function optionalId(value: unknown, field: string): string | null {
  return requiredStringId(value, field, true);
}

function requiredStringId(value: unknown, field: string, optional: boolean): string | null {
  if ((value === undefined || value === null || value === '') && optional) return null;
  if (typeof value !== 'string') throw new StageEventValidationError(`${field} must be a string`);
  const result = value.trim();
  if (!result || result.length > 128 || !/^[A-Za-z0-9_-]+$/.test(result)) {
    throw new StageEventValidationError(`${field} is invalid`);
  }
  return result;
}

function requiredString(value: unknown, field: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string') throw new StageEventValidationError(`${field} must be a string`);
  const result = value.trim();
  if (result.length < minimum || result.length > maximum) {
    throw new StageEventValidationError(`${field} is invalid`);
  }
  return result;
}

function normalizeTimestamp(value: unknown): string | null {
  let milliseconds: number | null = null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    milliseconds = value < 10_000_000_000 ? value * 1000 : value;
  } else if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) milliseconds = numeric < 10_000_000_000 ? numeric * 1000 : numeric;
    else {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) milliseconds = parsed;
    }
  }
  if (milliseconds === null) return null;
  const date = new Date(milliseconds);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function safeScalar(value: unknown): string | number | boolean | null {
  if (typeof value === 'string') return value.slice(0, 128);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  return null;
}

function recordValue(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function decodeBase64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
