import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { getGhlOpportunity, GhlReadError, resolveGhlContext } from '../_shared/ghl.ts';
import {
  MAX_WEBHOOK_BYTES,
  parseHighLevelEnvelope,
  processAuthenticatedStageEvent,
  sha256Hex,
  StageEventValidationError,
  verifyHighLevelSignature,
  type CandidateRef,
  type EventReservationInput,
  type FinalizeInput,
  type HighLevelEnvelope,
  type LiveOpportunity,
  type ReconcileResult,
  type ReservationResult,
  type WorkKind,
} from './core.ts';

const WORKSPACE_ID = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9';

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
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
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
    if (rawSizeBytes > MAX_WEBHOOK_BYTES) return json({ error: 'request_too_large' }, 413);
    payloadSha256 = await sha256Hex(rawBody);

    const signature = req.headers.get('x-ghl-signature');
    const authenticated = await verifyHighLevelSignature(rawBody, signature);
    if (!authenticated) {
      await recordRejectedSignature(admin, payloadSha256, rawSizeBytes);
      return json({ error: 'invalid_highlevel_signature' }, 401);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      await recordAuthenticatedMalformed(admin, payloadSha256, rawSizeBytes, { reason: 'invalid_json' });
      return json({ error: 'malformed_payload' }, 400);
    }

    let envelope: HighLevelEnvelope;
    try {
      envelope = parseHighLevelEnvelope(parsed);
    } catch (error) {
      const reason = error instanceof StageEventValidationError ? error.message : 'invalid_payload';
      await recordAuthenticatedMalformed(admin, payloadSha256, rawSizeBytes, { reason: reason.slice(0, 200) });
      return json({ error: 'malformed_payload' }, 400);
    }

    const ghlContext = await resolveGhlContext(admin);
    const deps = buildDependencies(admin, ghlContext);
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
      event: 'ghl_stage_event_receiver_error',
      code: normalized.code,
      status: normalized.status,
      payload_sha256: payloadSha256 || null,
    }));
    return json({ error: normalized.code }, normalized.status);
  }
});

function buildDependencies(admin: SupabaseClient, ghlContext: { apiKey: string; locationId: string }) {
  return {
    reserve: (input: EventReservationInput) => reserveEvent(admin, input),
    finalize: (eventId: string, input: FinalizeInput) => finalizeEvent(admin, eventId, input),
    getLiveOpportunity: async (opportunityId: string): Promise<LiveOpportunity | null> => {
      try {
        const opportunity = await getGhlOpportunity(ghlContext, opportunityId);
        if (typeof opportunity.id !== 'string' || !opportunity.id) return null;
        return {
          id: opportunity.id,
          // The server-side HighLevel credential is location-scoped. Binding this
          // read to the configured location avoids trusting a webhook location field.
          location_id: ghlContext.locationId,
          pipeline_id: typeof opportunity.pipeline_id === 'string' ? opportunity.pipeline_id : null,
          stage_id: typeof opportunity.stage_id === 'string' ? opportunity.stage_id : null,
          name: typeof opportunity.name === 'string' ? opportunity.name : null,
        };
      } catch (error) {
        if (error instanceof GhlReadError && error.status === 404) return null;
        throw error;
      }
    },
    findCandidate: async (opportunityId: string): Promise<CandidateRef | null> => {
      const { data, error } = await admin
        .from('ema_candidates')
        .select('id, cash_task_id, normalized_address')
        .eq('workspace_id', WORKSPACE_ID)
        .eq('ghl_opportunity_id', opportunityId)
        .limit(2);
      if (error) throw new ReceiverError(500, 'candidate_lookup_failed');
      if (!data || data.length !== 1) return null;
      return {
        id: data[0].id,
        cash_task_id: data[0].cash_task_id ?? null,
        normalized_address: data[0].normalized_address ?? null,
      };
    },
    reconcile: async (input: {
      eventId: string;
      candidateId: string;
      opportunityId: string;
      workKind: WorkKind;
      pipelineId: string;
      stageId: string;
      activatedAt: string;
    }): Promise<ReconcileResult> => {
      const { data, error } = await admin.rpc('reconcile_cash_stage_trigger', {
        _workspace_id: WORKSPACE_ID,
        _candidate_id: input.candidateId,
        _ghl_opportunity_id: input.opportunityId,
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

async function reserveEvent(
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
    signature_kind: 'ghl_ed25519',
    event_type: input.envelope.type,
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

async function recordRejectedSignature(
  admin: SupabaseClient,
  payloadSha256: string,
  rawSizeBytes: number,
): Promise<void> {
  const deliveryKey = `rejected:${payloadSha256}`;
  const { error } = await admin.from('ghl_stage_events').insert({
    workspace_id: WORKSPACE_ID,
    delivery_key: deliveryKey,
    payload_sha256: payloadSha256,
    raw_size_bytes: rawSizeBytes,
    authenticated: false,
    signature_kind: 'ghl_ed25519',
    decision: 'rejected_signature',
    raw_metadata: {},
  });
  if (error?.code === '23505') {
    const { data } = await admin.from('ghl_stage_events')
      .select('id, duplicate_count')
      .eq('workspace_id', WORKSPACE_ID)
      .eq('delivery_key', deliveryKey)
      .maybeSingle();
    if (data) {
      await admin.from('ghl_stage_events').update({
        duplicate_count: Number(data.duplicate_count ?? 0) + 1,
        last_received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', data.id);
    }
  } else if (error) {
    console.error(JSON.stringify({ event: 'ghl_stage_event_rejected_audit_failed', code: error.code ?? null }));
  }
}

async function recordAuthenticatedMalformed(
  admin: SupabaseClient,
  payloadSha256: string,
  rawSizeBytes: number,
  metadata: Record<string, unknown>,
): Promise<void> {
  const deliveryKey = `malformed:${payloadSha256}`;
  const { error } = await admin.from('ghl_stage_events').insert({
    workspace_id: WORKSPACE_ID,
    delivery_key: deliveryKey,
    payload_sha256: payloadSha256,
    raw_size_bytes: rawSizeBytes,
    authenticated: true,
    signature_kind: 'ghl_ed25519',
    decision: 'malformed',
    raw_metadata: metadata,
  });
  if (error && error.code !== '23505') {
    console.error(JSON.stringify({ event: 'ghl_stage_event_malformed_audit_failed', code: error.code ?? null }));
  }
}

function normalizeError(error: unknown): ReceiverError {
  if (error instanceof ReceiverError) return error;
  if (error instanceof GhlReadError) return new ReceiverError(error.status, error.code);
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
