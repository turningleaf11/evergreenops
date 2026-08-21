import {
  HIGHLEVEL_EVENT_TYPE,
  sha256Hex,
  type HighLevelEnvelope,
  type LiveOpportunity,
} from '../ghl-stage-events/core.ts';

export const MAX_WORKFLOW_WEBHOOK_BYTES = 16 * 1024;
export const WORKFLOW_AUTH_SETTING_KEY = 'CASH_STAGE_WORKFLOW_TOKEN_SHA256';

export interface CashStageWorkflowRequest {
  opportunity_id: string;
}

export interface WorkflowLiveOpportunity extends LiveOpportunity {
  date_updated?: string | null;
}

export class CashStageWorkflowValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CashStageWorkflowValidationError';
  }
}

export function parseCashStageWorkflowRequest(value: unknown): CashStageWorkflowRequest {
  if (!isRecord(value)) throw new CashStageWorkflowValidationError('payload must be an object');
  const keys = Object.keys(value);
  if (keys.some((key) => key !== 'opportunity_id')) {
    throw new CashStageWorkflowValidationError('payload contains unsupported fields');
  }
  const opportunityId = requiredId(value.opportunity_id, 'opportunity_id');
  return { opportunity_id: opportunityId };
}

export async function verifyWorkflowBearer(
  authorizationHeader: string | null,
  expectedTokenHash: string,
): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/i.test(expectedTokenHash)) return false;
  if (!authorizationHeader) return false;
  const match = /^Bearer ([A-Za-z0-9_-]{32,512})$/.exec(authorizationHeader);
  if (!match) return false;
  const presentedHash = await sha256Hex(match[1]);
  return constantTimeHexEqual(presentedHash, expectedTokenHash.toLowerCase());
}

export async function buildWorkflowEnvelope(
  request: CashStageWorkflowRequest,
  live: WorkflowLiveOpportunity,
  expectedLocationId: string,
): Promise<HighLevelEnvelope> {
  if (live.id !== request.opportunity_id) {
    throw new CashStageWorkflowValidationError('live opportunity identity mismatch');
  }
  const pipelineId = requiredId(live.pipeline_id, 'live_pipeline_id');
  const stageId = requiredId(live.stage_id, 'live_stage_id');
  const dateUpdated = normalizeTimestamp(live.date_updated);
  if (!dateUpdated) throw new CashStageWorkflowValidationError('live opportunity timestamp missing');

  const digest = await sha256Hex(`${live.id}|${pipelineId}|${stageId}|${dateUpdated}`);
  const workflowEventId = `wf_${digest.slice(0, 48)}`;

  return {
    type: HIGHLEVEL_EVENT_TYPE,
    locationId: expectedLocationId,
    opportunityId: live.id,
    pipelineId,
    pipelineStageId: stageId,
    webhookId: workflowEventId,
    eventTimestamp: dateUpdated,
    rawMetadata: {
      source: 'ghl_workflow',
      workflow_event_id: workflowEventId,
      opportunity_id: live.id,
      live_pipeline_id: pipelineId,
      live_stage_id: stageId,
      live_date_updated: dateUpdated,
    },
  };
}

function requiredId(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new CashStageWorkflowValidationError(`${field} must be a string`);
  const result = value.trim();
  if (!result || result.length > 128 || !/^[A-Za-z0-9_-]+$/.test(result)) {
    throw new CashStageWorkflowValidationError(`${field} is invalid`);
  }
  return result;
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function constantTimeHexEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) {
    difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return difference === 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
