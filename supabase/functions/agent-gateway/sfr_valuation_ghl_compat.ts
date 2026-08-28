import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';

const ORIGINAL_URL =
  'https://raw.githubusercontent.com/turningleaf11/evergreenops/021c2173e7583280c265faa8400fb92c2514646e/supabase/functions/agent-gateway/sfr_valuation.ts';

import * as original from 'https://raw.githubusercontent.com/turningleaf11/evergreenops/021c2173e7583280c265faa8400fb92c2514646e/supabase/functions/agent-gateway/sfr_valuation.ts';
import type {
  SfrValuationOptions,
  SfrValuationResult,
} from 'https://raw.githubusercontent.com/turningleaf11/evergreenops/021c2173e7583280c265faa8400fb92c2514646e/supabase/functions/agent-gateway/sfr_valuation.ts';

export * from 'https://raw.githubusercontent.com/turningleaf11/evergreenops/021c2173e7583280c265faa8400fb92c2514646e/supabase/functions/agent-gateway/sfr_valuation.ts';

/**
 * HighLevel's opportunity detail endpoint currently returns custom-field values
 * under `fieldValue`, while other HighLevel response shapes use typed keys such
 * as `fieldValueString` / `fieldValueArray`. Cash's valuation contract accepts
 * the typed shape. Normalize the detail response here so both live API shapes
 * resolve to the same canonical SFR subject.
 */
export function normalizeGhlOpportunityRecord(
  opportunity: Record<string, unknown>,
): Record<string, unknown> {
  if (!Array.isArray(opportunity.customFields)) return opportunity;
  return {
    ...opportunity,
    customFields: opportunity.customFields.map((value) => {
      if (!isRecord(value) || value.fieldValue === undefined || value.fieldValue === null) {
        return value;
      }
      if (
        value.fieldValueString !== undefined ||
        value.fieldValueNumber !== undefined ||
        value.fieldValueDate !== undefined ||
        value.fieldValueArray !== undefined ||
        value.value !== undefined
      ) {
        return value;
      }
      const fieldValue = value.fieldValue;
      if (Array.isArray(fieldValue)) return { ...value, fieldValueArray: fieldValue };
      if (typeof fieldValue === 'number') return { ...value, fieldValueNumber: fieldValue };
      if (typeof fieldValue === 'string') return { ...value, fieldValueString: fieldValue };
      return { ...value, value: fieldValue };
    }),
  };
}

export function subjectFromOpportunityRecord(
  opportunity: Record<string, unknown>,
) {
  return original.subjectFromOpportunityRecord(normalizeGhlOpportunityRecord(opportunity));
}

export async function runSfrOpportunityValuation(
  admin: SupabaseClient,
  workspaceId: string,
  opportunityId: string,
  options: SfrValuationOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<SfrValuationResult> {
  return original.runSfrOpportunityValuation(
    admin,
    workspaceId,
    opportunityId,
    options,
    ghlOpportunityCompatFetch(fetchImpl),
  );
}

export function ghlOpportunityCompatFetch(fetchImpl: typeof fetch): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await fetchImpl(input, init);
    if (!response.ok) return response;

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) return response;

    let payload: unknown;
    try {
      payload = await response.clone().json();
    } catch {
      return response;
    }
    if (!isRecord(payload) || !isRecord(payload.opportunity)) return response;

    const normalizedOpportunity = normalizeGhlOpportunityRecord(payload.opportunity);
    const normalizedPayload = { ...payload, opportunity: normalizedOpportunity };
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.set('content-type', 'application/json');
    return new Response(JSON.stringify(normalizedPayload), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }) as typeof fetch;
}

export const sfrValuationCompatSource = ORIGINAL_URL;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
