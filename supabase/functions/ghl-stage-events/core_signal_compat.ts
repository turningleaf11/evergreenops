import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';

import * as original from 'https://raw.githubusercontent.com/turningleaf11/evergreenops/51af9dc04ddf64c43a7cef29217669200fe10f4c/supabase/functions/ghl-stage-events/core.ts';
import type {
  HighLevelEnvelope,
  StageEventDependencies,
} from 'https://raw.githubusercontent.com/turningleaf11/evergreenops/51af9dc04ddf64c43a7cef29217669200fe10f4c/supabase/functions/ghl-stage-events/core.ts';
import {
  processAuthenticatedStageActivation,
  type ActivationSignalResult,
} from './activation_core.ts';

export * from 'https://raw.githubusercontent.com/turningleaf11/evergreenops/51af9dc04ddf64c43a7cef29217669200fe10f4c/supabase/functions/ghl-stage-events/core.ts';

/**
 * Drop-in replacement for the existing processAuthenticatedStageEvent export.
 * Existing webhook receivers keep their authentication, reservation, live GHL
 * verification, candidate lookup, audit finalization, and Portfolio reconciliation
 * code. Only the SFR activation side effect changes: stage entry creates a small
 * activation signal instead of a Cash task/work item.
 */
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
) {
  let admin: SupabaseClient | null = null;
  const getAdmin = (): SupabaseClient => {
    if (admin) return admin;
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new original.StageEventValidationError('activation signal backend not configured');
    }
    admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    return admin;
  };

  return processAuthenticatedStageActivation(envelope, context, {
    reserve: deps.reserve,
    finalize: deps.finalize,
    getLiveOpportunity: deps.getLiveOpportunity,
    findCandidate: deps.findCandidate,
    activateSfr: async (input): Promise<ActivationSignalResult> => {
      const { data, error } = await getAdmin().rpc('create_cash_sfr_activation_signal', {
        _workspace_id: context.workspaceId,
        _candidate_id: input.candidateId,
        _ghl_opportunity_id: input.opportunityId,
        _pipeline_id: input.pipelineId,
        _stage_id: input.stageId,
        _event_id: input.eventId,
        _activated_at: input.activatedAt,
      }).single();
      if (error || !data) {
        throw new original.StageEventValidationError('cash activation signal create failed');
      }
      const row = data as unknown as Record<string, unknown>;
      const signalId = typeof row.activation_signal_id === 'string' ? row.activation_signal_id : '';
      const activationCount = Number(row.activation_count);
      if (!signalId || !Number.isInteger(activationCount) || activationCount < 1) {
        throw new original.StageEventValidationError('cash activation signal response invalid');
      }
      return {
        activation_signal_id: signalId,
        activation_count: activationCount,
        reused_signal: Boolean(row.reused_signal),
      };
    },
    reconcilePortfolio: async (input) => deps.reconcile(input),
  });
}
