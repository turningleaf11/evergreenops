import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { getGhlOpportunity, GhlReadError, resolveGhlContext } from '../_shared/ghl.ts';
import {
  processAuthenticatedStageEvent,
  sha256Hex,
  type CandidateRef,
  type EventReservationInput,
  type FinalizeInput,
  type ReconcileResult,
  type ReservationResult,
  type WorkKind,
} from '../ghl-stage-events/core_signal_compat.ts';
import {
  buildWorkflowEnvelope,
  CashStageWorkflowValidationError,
  MAX_WORKFLOW_WEBHOOK_BYTES,
  parseCashStageWorkflowRequest,
  verifyWorkflowBearer,
  WORKFLOW_AUTH_SETTING_KEY,
  type WorkflowLiveOpportunity,
} from './core.ts';

const WORKSPACE_ID = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9';
const WORKFLOW_SIGNATURE_KIND = 'ghl_workflow_bearer';
const WORKFLOW_EVENT_TYPE = 'EvergreenCashStageWorkflow';

class ReceiverError extends Error {
  constructor(public status: number, public code: string, message = code) {
    super(message);
    this.name = 'ReceiverError';
  }
}

Deno.serve(async (req) => {
  const receivedAt = new Date().toISOString();
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return json({ error: 'content_type_must_be_json' }, 415);
  }

  const declaredLength = Number(req.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WORKFLOW_WEBHOOK_BYTES) {
    return json({ error: 'request_too_large' }, 413);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'receiver_not_configured' }, 500);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  let rawBody = '';
  let payloadSha256 = '';
  try {
    rawBody = await req.text();
    const rawSizeBytes = new TextEncoder().encode(rawBody).length;
    if (rawSizeBytes > MAX_WORKFLOW_WEBHOOK_BYTES) return json({ error: 'request_too_large' }, 413);
    payloadSha256 = await sha256Hex(rawBody);

    const expectedTokenHash = await loadWorkflowTokenHash(admin);
    const authenticated = await verifyWorkflowBearer(req.headers.get('authorization'), expectedTokenHash);
    if (!authenticated) {
      await recordRejectedAuth(admin, payloadSha256, rawSizeBytes);
      return json({ error: 'invalid_workflow_authorization' }, 401);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      await recordAuthenticatedMalformed(admin, payloadSha256, rawSizeBytes, 'invalid_json');
      return json({ error: 'malformed_payload' }, 400);
    }

    let request;
    try {
      request = parseCashStageWorkflowRequest(parsed);
    } catch (error) {
      const reason = error instanceof CashStageWorkflowValidationError ? error.message : 'invalid_payload';
      await recordAuthenticatedMalformed(admin, payloadSha256, rawSizeBytes, reason.slice(0, 200));
      return json({ error: 'malformed_payload' }, 400);
    }

    const ghlContext = await resolveGhlContext(admin);
    const live = await getLiveWorkflowOpportunity(ghlContext, request.opportunity_id);
    if (!live) {
      const eventId = await recordAuthenticatedUnknownOpportunity(
        admin,
        request.opportunity_id,
        ghlContext.locationId,
        payloadSha256,
        rawSizeBytes,
      );
      return json({
        ok: true,
        decision: 'unknown_opportunity',
        event_id: eventId,
        cash_task_id: null,
        work_item_id: null,
      });
    }

    const envelope = await buildWorkflowEnvelope(request, live, ghlContext.locationId);
    const deps = buildDependencies(admin, live);
    const result = await processAuthenticatedStageEvent(envelope, {
      workspaceId: WORKSPACE_ID,
      expectedLocationId: ghlContext.locationId,
      payloadSha256,
      rawSizeBytes,
      receivedAt,
    }, deps);

    return json({
      ok: true,
      decision: result.decision,
      event_id: result.eventId,
      cash_task_id: result.cashTaskId ?? null,
      work_item_id: result.workItemId ?? null,
    });
  } catch (error) {
    const normalized = normalizeError(error);
    console.error(JSON.stringify({
      event: 'cash_stage_workflow_receiver_error',
      code: normalized.code,
      status: normalized.status,
      payload_sha256: payloadSha256 || null,
    }));
    return json({ error: normalized.code }, normalized.status);
  }
});

async function loadWorkflowTokenHash(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin.from('app_settings')
    .select('value')
    .eq('key', WORKFLOW_AUTH_SETTING_KEY)
    .maybeSingle();
  if (error) throw new ReceiverError(500, 'workflow_auth_lookup_failed');
  const value = typeof data?.value === 'string' ? data.value.trim().toLowerCase() : '';
  if (!/^[0-9a-f]{64}$/.test(value)) throw new ReceiverError(503, 'workflow_auth_not_configured');
  return value;
}

async function getLiveWorkflowOpportunity(
  ghlContext: { apiKey: string; locationId: string },
  opportunityId: string,
): Promise<WorkflowLiveOpportunity | null> {
  try {
    const opportunity = await getGhlOpportunity(ghlContext, opportunityId);
    if (typeof opportunity.id !== 'string' || !opportunity.id) return null;
    return {
      id: opportunity.id,
      location_id: ghlContext.locationId,
      pipeline_id: typeof opportunity.pipeline_id === 'string' ? opportunity.pipeline_id : null,
      stage_id: typeof opportunity.stage_id === 'string' ? opportunity.stage_id : null,
      name: typeof opportunity.name === 'string' ? opportunity.name : null,
      date_updated: typeof opportunity.date_updated === 'string' ? opportunity.date_updated : null,
    };
  } catch (error) {
    if (error instanceof GhlReadError && error.status === 404) return null;
    throw error;
  }
}

function buildDependencies(admin: SupabaseClient, live: WorkflowLiveOpportunity) {
  return {
    reserve: (input: EventReservationInput) => reserveWorkflowEvent(admin, input),
    finalize: (eventId: string, input: FinalizeInput) => finalizeEvent(admin, eventId, input),
    getLiveOpportunity: async (): Promise<WorkflowLiveOpportunity> => live,
    findCandidate: async (opportunityId: string): Promise<CandidateRef | null> => {
      const { data, error } = await admin
        .from('ema_candidates')
        .select('id, cash_task_id, normalized_address')
        .eq('workspace_id', WORKSPACE_ID)
        .eq('ghl_opportunity_id', opportunityId)
        .limit(2);
      if (error) throw new ReceiverError(500, 'candidate_lookup_failed');
      if (!data || data.length === 0) return null;
      if (data.length !== 1) throw new ReceiverError(409, 'candidate_lookup_ambiguous');
      return {
        id: data[0].id,
        cash_task_id: data[0].cash_task_id ?? null,
        normalized_address: data[0].normalized_address ?? null,
      };
    },
    reconcile: async (input: {
      eventId: string;
      candidateId: string | null;
      opportunityId: string;
      opportunityLabel: string | null;
      workKind: WorkKind;
      pipelineId: string;
      stageId: string;
      activatedAt: string;
    }): Promise<ReconcileResult> => {
      const { data, error } = await admin.rpc('reconcile_cash_stage_trigger_v2', {
        _workspace_id: WORKSPACE_ID,
        _candidate_id: input.candidateId,
        _ghl_opportunity_id: input.opportunityId,
        _opportunity_label: input.opportunityLabel,
        _work_kind: input.workKind,
        _pipeline_id: input.pipelineId,
        _stage_id: input.stageId,
        _event_id: input.eventId,
        _activated_at: input.activatedAt,
      }).single();
      if (error || !data) throw new ReceiverError(500, 'cash_work_reconciliation_failed');
      const row = data as unknown as Record<string, unknown>;
      return {
        work_item_id: String(row.work_item_id),
        agent_task_id: String(row.agent_task_id),
        reused_work_item: Boolean(row.reused_work_item),
        reused_task: Boolean(row.reused_task),
        reopened: Boolean(row.reopened),
        legacy_reconciled: Boolean(row.legacy_reconciled),
        activation_count: Number(row.activation_count),
      };
    },
  };
}

async function reserveWorkflowEvent(
  admin: SupabaseClient,
  input: EventReservationInput,
): Promise<ReservationResult> {
  const { data, error } = await admin.from('ghl_stage_events').insert({
    workspace_id: WORKSPACE_ID,
    delivery_key: input.deliveryKey,
    provider_event_id: input.providerEventId,
    payload_sha256: input.payloadSha256,
    raw_size_bytes: input.rawSizeBytes,
    authenticated: true,
    signature_kind: WORKFLOW_SIGNATURE_KIND,
    event_type: WORKFLOW_EVENT_TYPE,
    location_id: input.envelope.locationId,
    opportunity_id: input.envelope.opportunityId,
    pipeline_id: input.envelope.pipelineId,
    stage_id: input.envelope.pipelineStageId,
    event_timestamp: input.envelope.eventTimestamp,
    decision: 'received',
    raw_metadata: input.envelope.rawMetadata,
  }).select('id').single();

  if (!error && data) return { eventId: data.id, duplicate: false };
  if (error?.code !== '23505') throw new ReceiverError(500, 'event_reservation_failed');

  const { data: existing, error: lookupError } = await admin
    .from('ghl_stage_events')
    .select('id, duplicate_count')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('delivery_key', input.deliveryKey)
    .maybeSingle();
  if (lookupError || !existing) throw new ReceiverError(500, 'duplicate_event_lookup_failed');
  await admin.from('ghl_stage_events').update({
    duplicate_count: Number(existing.duplicate_count ?? 0) + 1,
    last_received_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', existing.id).eq('workspace_id', WORKSPACE_ID);
  return { eventId: existing.id, duplicate: true };
}

async function finalizeEvent(admin: SupabaseClient, eventId: string, input: FinalizeInput): Promise<void> {
  const patch: Record<string, unknown> = {
    decision: input.decision,
    updated_at: new Date().toISOString(),
  };
  if (input.candidateId !== undefined) patch.candidate_id = input.candidateId;
  if (input.cashTaskId !== undefined) patch.cash_task_id = input.cashTaskId;
  if (input.resultMetadata !== undefined) patch.result_metadata = input.resultMetadata;
  const { error } = await admin.from('ghl_stage_events').update(patch)
    .eq('id', eventId)
    .eq('workspace_id', WORKSPACE_ID);
  if (error) throw new ReceiverError(500, 'event_finalize_failed');
}

async function recordRejectedAuth(
  admin: SupabaseClient,
  payloadSha256: string,
  rawSizeBytes: number,
): Promise<void> {
  await insertAuditEvent(admin, {
    deliveryKey: `workflow-rejected:${payloadSha256}`,
    payloadSha256,
    rawSizeBytes,
    authenticated: false,
    decision: 'rejected_auth',
    metadata: { source: 'ghl_workflow' },
  });
}

async function recordAuthenticatedMalformed(
  admin: SupabaseClient,
  payloadSha256: string,
  rawSizeBytes: number,
  reason: string,
): Promise<void> {
  await insertAuditEvent(admin, {
    deliveryKey: `workflow-malformed:${payloadSha256}`,
    payloadSha256,
    rawSizeBytes,
    authenticated: true,
    decision: 'malformed',
    metadata: { source: 'ghl_workflow', reason },
  });
}

async function recordAuthenticatedUnknownOpportunity(
  admin: SupabaseClient,
  opportunityId: string,
  locationId: string,
  payloadSha256: string,
  rawSizeBytes: number,
): Promise<string | null> {
  return insertAuditEvent(admin, {
    deliveryKey: `workflow-unknown:${payloadSha256}`,
    payloadSha256,
    rawSizeBytes,
    authenticated: true,
    decision: 'unknown_opportunity',
    metadata: { source: 'ghl_workflow', opportunity_id: opportunityId },
    opportunityId,
    locationId,
  });
}

async function insertAuditEvent(
  admin: SupabaseClient,
  input: {
    deliveryKey: string;
    payloadSha256: string;
    rawSizeBytes: number;
    authenticated: boolean;
    decision: 'rejected_auth' | 'malformed' | 'unknown_opportunity';
    metadata: Record<string, unknown>;
    opportunityId?: string;
    locationId?: string;
  },
): Promise<string | null> {
  const { data, error } = await admin.from('ghl_stage_events').insert({
    workspace_id: WORKSPACE_ID,
    delivery_key: input.deliveryKey,
    payload_sha256: input.payloadSha256,
    raw_size_bytes: input.rawSizeBytes,
    authenticated: input.authenticated,
    signature_kind: WORKFLOW_SIGNATURE_KIND,
    event_type: WORKFLOW_EVENT_TYPE,
    location_id: input.locationId ?? null,
    opportunity_id: input.opportunityId ?? null,
    decision: input.decision,
    raw_metadata: input.metadata,
  }).select('id').single();

  if (!error && data) return data.id;
  if (error?.code !== '23505') {
    console.error(JSON.stringify({ event: 'cash_stage_workflow_audit_failed', code: error?.code ?? null }));
    return null;
  }

  const { data: existing } = await admin.from('ghl_stage_events')
    .select('id, duplicate_count')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('delivery_key', input.deliveryKey)
    .maybeSingle();
  if (!existing) return null;
  await admin.from('ghl_stage_events').update({
    duplicate_count: Number(existing.duplicate_count ?? 0) + 1,
    last_received_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', existing.id).eq('workspace_id', WORKSPACE_ID);
  return existing.id;
}

function normalizeError(error: unknown): ReceiverError {
  if (error instanceof ReceiverError) return error;
  if (error instanceof GhlReadError) return new ReceiverError(error.status, error.code);
  if (error instanceof CashStageWorkflowValidationError) return new ReceiverError(409, 'workflow_live_validation_failed');
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return new ReceiverError(504, 'upstream_timeout');
  }
  return new ReceiverError(500, 'internal_receiver_error');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
