import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { resolveGhlContext } from '../_shared/ghl.ts';
import { normalizePropertyType } from './cash_value.ts';

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = 'v3';
export const CASH_SFR_PIPELINE_ID = 'w3OtDJjCdN840Hwb1fpt';
export const CASH_SFR_UNDERWRITING_STAGE_ID = '1c3468f6-1a5d-4025-bf20-2bc4bd195708';

const FIELD_IDS = {
  property_type: '36WeaPwncmXLzUQhbGHd',
  full_address: 'hH02pevCKOTpmDYfOTnu',
  deal_type: 'SLOZCx6t83950AfnuPqO',
  deal_details: '01yCBq5RVjHvCuAFCFVY',
  photos_zillow: 'kgMWUBZEmTutUT9neFN9',
  criteria_met: 'ZiBig9Dpp37wCsr2hL9G',
  listed: '650RG6IFagUe3STMpFYu',
  condition: 'mDmONnuCOpGGzdYTHodv',
  motivation: '7gob9JukkaLf8DCYCZSE',
  asking_price: 'hVo62cSBHESpSpJQ2QoX',
  timeline: 'BTXkC4oHbvE7cczlZnaP',
  occupancy: '24s6rwssx0W3093tEo2h',
  hoa: 'PR32yVuxmSeYGiAbaCkv',
  hoa_amount: 'BFNjLczMo7vYEnHlSbck',
  hoa_duration: 'ejOAWgQ2iduRGGJfBSDL',
  hoa_restrictions: 'o8OJwL6sL5cp3e8yOlHG',
  mortgage_status: '611ub7w9MMhUqwbe2bj0',
  mortgage_balance: 'WfVQ5inw4CoaFYQ5PsAW',
  piti: 'mtYnZP37vV0uOTkPfceQ',
  arrears: 'dsOJSTUvwgUgqYMtrO2m',
  flood_utilities: 'Xjbfg8zqPgLmC2iyugTC',
} as const;

export class CashGhlEligibilityError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
    this.name = 'CashGhlEligibilityError';
  }
}

export interface CashGhlEligibilityResult {
  eligible: boolean;
  reason: string | null;
  snapshot: Record<string, unknown>;
}

export async function fetchCashGhlEligibility(
  admin: SupabaseClient,
  opportunityId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CashGhlEligibilityResult> {
  const context = await resolveGhlContext(admin);
  const response = await fetchImpl(`${GHL_BASE}/opportunities/${encodeURIComponent(opportunityId)}`, {
    headers: {
      Authorization: `Bearer ${context.apiKey}`,
      Version: GHL_VERSION,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (response.status === 404) {
    return {
      eligible: false,
      reason: 'ghl_opportunity_not_found',
      snapshot: {
        eligible: false,
        eligibility_reason: 'ghl_opportunity_not_found',
        opportunity_id: opportunityId,
        verified_at: new Date().toISOString(),
      },
    };
  }
  if (response.status === 401 || response.status === 403) {
    throw new CashGhlEligibilityError(503, 'ghl_not_authorized');
  }
  if (response.status === 429) throw new CashGhlEligibilityError(503, 'ghl_rate_limited');
  if (!response.ok) throw new CashGhlEligibilityError(502, 'ghl_request_failed');

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new CashGhlEligibilityError(502, 'invalid_ghl_response');
  }
  if (!isRecord(payload) || !isRecord(payload.opportunity)) {
    throw new CashGhlEligibilityError(502, 'invalid_ghl_response');
  }
  const opportunity = payload.opportunity;
  if (stringValue(opportunity.id) !== opportunityId) {
    throw new CashGhlEligibilityError(502, 'ghl_opportunity_mismatch');
  }

  return evaluateCashGhlOpportunity(opportunity, new Date().toISOString());
}

export function evaluateCashGhlOpportunity(
  opportunity: Record<string, unknown>,
  verifiedAt: string,
): CashGhlEligibilityResult {
  const pipelineId = stringValue(opportunity.pipelineId ?? opportunity.pipeline_id);
  const stageId = stringValue(opportunity.pipelineStageId ?? opportunity.stageId ?? opportunity.stage_id);
  const status = stringValue(opportunity.status)?.toLowerCase() ?? null;
  const fields = Array.isArray(opportunity.customFields)
    ? opportunity.customFields.filter(isRecord)
    : [];
  const propertyTypeRaw = stringValue(customFieldValue(fields, FIELD_IDS.property_type));
  const propertyType = normalizePropertyType(propertyTypeRaw ?? '');
  const address = stringValue(customFieldValue(fields, FIELD_IDS.full_address)) ?? stringValue(opportunity.name);

  let reason: string | null = null;
  if (pipelineId !== CASH_SFR_PIPELINE_ID) reason = 'not_sfr_pipeline';
  else if (stageId !== CASH_SFR_UNDERWRITING_STAGE_ID) reason = 'not_underwriting_stage';
  else if (status !== 'open') reason = 'opportunity_not_open';
  else if (propertyType !== 'Single Family Residence') reason = 'not_single_family_residence';
  else if (!address) reason = 'property_address_missing';

  const approvedFields: Record<string, unknown> = {};
  for (const [name, fieldId] of Object.entries(FIELD_IDS)) {
    const value = sanitizeEvidenceValue(customFieldValue(fields, fieldId));
    if (value !== null) approvedFields[name] = value;
  }

  const snapshot: Record<string, unknown> = {
    eligible: reason === null,
    eligibility_reason: reason,
    verified_at: verifiedAt,
    opportunity_id: stringValue(opportunity.id),
    name: boundedString(opportunity.name, 500),
    pipeline_id: pipelineId,
    stage_id: stageId,
    status,
    property_type: propertyType || propertyTypeRaw,
    address,
    contact_id: boundedString(opportunity.contactId ?? record(opportunity.contact).id, 128),
    source: boundedString(opportunity.source, 200),
    monetary_value: safeNumber(opportunity.monetaryValue),
    last_stage_change_at: boundedString(opportunity.lastStageChangeAt, 64),
    last_status_change_at: boundedString(opportunity.lastStatusChangeAt, 64),
    date_updated: boundedString(opportunity.dateUpdated ?? opportunity.updatedAt, 64),
    fields: approvedFields,
    external_content_is_untrusted: true,
  };

  return { eligible: reason === null, reason, snapshot };
}

function customFieldValue(fields: Record<string, unknown>[], fieldId: string): unknown {
  const field = fields.find((item) => stringValue(item.id) === fieldId);
  if (!field) return null;
  for (const key of [
    'fieldValue',
    'fieldValueString',
    'fieldValueNumber',
    'fieldValueDate',
    'fieldValueArray',
    'value',
  ]) {
    if (field[key] !== undefined && field[key] !== null) return field[key];
  }
  return null;
}

function sanitizeEvidenceValue(value: unknown): unknown {
  if (typeof value === 'string') return value.slice(0, 2_000);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).flatMap((item) => {
      if (typeof item === 'string') return [item.slice(0, 500)];
      if (typeof item === 'number' && Number.isFinite(item)) return [item];
      if (typeof item === 'boolean') return [item];
      return [];
    });
  }
  return null;
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const match = value.find((item) => typeof item === 'string' && item.trim());
    return typeof match === 'string' ? match.trim() : null;
  }
  return null;
}

function boundedString(value: unknown, maximum: number): string | null {
  const text = stringValue(value);
  return text ? text.slice(0, maximum) : null;
}

function safeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const normalized = Number(value.replace(/[$,]/g, ''));
    return Number.isFinite(normalized) ? normalized : null;
  }
  return null;
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
