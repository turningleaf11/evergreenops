import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { normalizePropertyType, type CashValueSubject } from './cash_value.ts';

const ORIGINAL_URL =
  'https://raw.githubusercontent.com/turningleaf11/evergreenops/021c2173e7583280c265faa8400fb92c2514646e/supabase/functions/agent-gateway/sfr_valuation.ts';
const SFR_PIPELINE_ID = 'w3OtDJjCdN840Hwb1fpt';
const GHL_PROPERTY_TYPE_FIELD_ID = '36WeaPwncmXLzUQhbGHd';
const GHL_PROPERTY_ADDRESS_FIELD_ID = 'hH02pevCKOTpmDYfOTnu';

import * as original from 'https://raw.githubusercontent.com/turningleaf11/evergreenops/021c2173e7583280c265faa8400fb92c2514646e/supabase/functions/agent-gateway/sfr_valuation.ts';
import type {
  SfrValuationOptions,
  SfrValuationResult,
} from 'https://raw.githubusercontent.com/turningleaf11/evergreenops/021c2173e7583280c265faa8400fb92c2514646e/supabase/functions/agent-gateway/sfr_valuation.ts';

export * from 'https://raw.githubusercontent.com/turningleaf11/evergreenops/021c2173e7583280c265faa8400fb92c2514646e/supabase/functions/agent-gateway/sfr_valuation.ts';

/**
 * HighLevel's opportunity-detail endpoint currently returns custom-field values
 * under `fieldValue`, while search/list response shapes use typed keys such as
 * `fieldValueString` / `fieldValueArray`. Normalize both forms before handing
 * opportunity JSON to the existing valuation engine.
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

/**
 * Resolve an SFR subject directly from either supported HighLevel custom-field
 * shape. This deliberately does not delegate this boundary check to the older
 * immutable valuation module, so the compatibility contract is explicit and
 * regression-testable.
 */
export function subjectFromOpportunityRecord(
  opportunity: Record<string, unknown>,
): CashValueSubject {
  const normalized = normalizeGhlOpportunityRecord(opportunity);
  const pipelineId = stringValue(normalized.pipelineId ?? normalized.pipeline_id);
  if (pipelineId !== SFR_PIPELINE_ID) {
    throw new original.SfrValuationError(409, 'sfr_pipeline_required');
  }
  const fields = Array.isArray(normalized.customFields)
    ? normalized.customFields.filter(isRecord)
    : [];
  const propertyType = stringValue(customFieldValue(fields, GHL_PROPERTY_TYPE_FIELD_ID));
  if (normalizePropertyType(propertyType ?? '') !== 'Single Family Residence') {
    throw new original.SfrValuationError(409, 'single_family_residence_required');
  }
  const address = stringValue(customFieldValue(fields, GHL_PROPERTY_ADDRESS_FIELD_ID)) ??
    stringValue(normalized.name);
  if (!address) throw new original.SfrValuationError(409, 'normalized_address_required');
  return {
    address,
    property_type: 'Single Family Residence',
    sqft: 0,
    year_built: null,
    beds: null,
    baths: null,
    stories: null,
    build_style: null,
  };
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

function customFieldValue(fields: Record<string, unknown>[], fieldId: string): unknown {
  const field = fields.find((item) => stringValue(item.id) === fieldId);
  if (!field) return null;
  for (const key of [
    'fieldValueString',
    'fieldValueNumber',
    'fieldValueDate',
    'fieldValueArray',
    'fieldValue',
    'value',
  ]) {
    if (field[key] !== undefined && field[key] !== null) return field[key];
  }
  return null;
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const firstString = value.find((item) => typeof item === 'string' && item.trim());
    return typeof firstString === 'string' ? firstString.trim() : null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
