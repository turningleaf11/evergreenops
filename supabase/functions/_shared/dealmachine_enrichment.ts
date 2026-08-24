import { DealMachineError, type DealMachineCredits } from './dealmachine.ts';

const DEALMACHINE_ENRICHMENT_URL = 'https://api.v2.dealmachine.com/v1/enrichment/address';

/**
 * Property-only fields used by Evergreen lead enrichment and reusable underwriting evidence.
 * Owner/contact fields are intentionally excluded; this path must not consume people credits.
 */
export const DEALMACHINE_PROPERTY_FIELDS = [
  'estimated_value',
  'estimated_equity_amount',
  'estimated_equity_percentage',
  'num_bedrooms',
  'num_bathrooms',
  'year_built',
  'living_area_sqft',
  'num_units',
  'num_buildings',
  'building_style',
  'stories',
  'property_construction_type',
  'property_type',
  'property_class',
  'building_condition',
  'building_quality',
  'num_mortgages',
  'estimated_loan_to_value_percentage',
  'total_estimated_loan_balance',
  'total_original_loan_amount',
  'total_estimated_loan_payment_monthly',
  'mortgage_1_loan_balance',
  'mortgage_1_loan_interest_rate',
  'mortgage_1_loan_amount',
  'mortgage_1_loan_term_months',
  'mortgage_1_loan_type',
  'mortgage_1_financing_type',
  'mortgage_1_lender_name',
  'mortgage_1_estimated_payment_amount',
  'mortgage_1_loan_due_date',
  'mortgage_1_recording_date',
  'mortgage_1_loan_start_date',
  'market_status',
  'mls_current_listing_price',
  'mls_days_on_market',
  'mls_last_initial_listing_date',
  'mls_max_listing_price',
  'mls_min_listing_price',
  'last_sale_date',
  'last_sale_price',
  'last_sale_doc_type',
  'property_preforeclosure_status',
  'foreclosure_auction_date',
  'foreclosure_default_date',
  'foreclosure_past_due_amount',
  'tax_amount',
  'tax_delinquent_year',
  'tax_year',
  'assessed_total_value',
  'assessed_improvement_value',
  'assessed_land_value',
  'num_total_active_liens',
  'num_total_open_liens',
  'hoa_1_fee_amount',
  'flood_zone',
  'lot_size_acres',
  'lot_frontage',
  'lot_depth',
  'zoning',
  'parcel_number_raw',
  'legal_description',
  'subdivision_name',
  'pool',
  'garage_type',
  'basement',
  'patio',
  'porch',
  'driveway',
  'air_conditioning',
  'heating_type',
  'heating_fuel',
  'sewer',
  'water',
  'has_fireplaces',
  'exterior_walls',
  'interior_walls',
  'roof_type',
  'roof_cover',
  'floor_cover',
] as const;

export interface DealMachinePropertyEnrichment {
  dm_property_id: string;
  full_address: string | null;
  facts: Record<string, unknown>;
  credits: DealMachineCredits;
  request_id: string | null;
}

export async function fetchDealMachinePropertyEnrichment(
  apiKey: string,
  address: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DealMachinePropertyEnrichment> {
  if (!apiKey.trim()) throw new DealMachineError(503, 'dealmachine_not_configured');
  if (!address.trim()) throw new DealMachineError(409, 'normalized_address_required');

  let response: Response;
  try {
    response = await fetchImpl(DEALMACHINE_ENRICHMENT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: [{ full_address: address.trim() }],
        contact_audience: 'none',
        fields: [...DEALMACHINE_PROPERTY_FIELDS],
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new DealMachineError(504, 'dealmachine_timeout');
    }
    throw new DealMachineError(502, 'dealmachine_request_failed');
  }

  if (response.status === 401 || response.status === 403) throw new DealMachineError(503, 'dealmachine_auth_failed');
  if (response.status === 402) throw new DealMachineError(503, 'dealmachine_credits_unavailable');
  if (response.status === 429) throw new DealMachineError(503, 'dealmachine_rate_limited');
  if (!response.ok) throw new DealMachineError(502, 'dealmachine_request_failed');

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new DealMachineError(502, 'dealmachine_invalid_response');
  }

  const root = record(payload);
  const rows = Array.isArray(root.data) ? root.data.map(record) : [];
  const matched = rows.find((row) => row.matched === true && stringValue(row.dm_property_id));
  if (!matched) throw new DealMachineError(404, 'dealmachine_property_not_found');

  const source = mergeRecords(
    matched,
    record(matched.property),
    record(matched.property_data),
    record(matched.fields),
  );
  const facts: Record<string, unknown> = {};
  for (const field of DEALMACHINE_PROPERTY_FIELDS) {
    const value = sanitizeFact(source[field]);
    if (value !== null) facts[field] = value;
  }

  return {
    dm_property_id: requiredString(matched.dm_property_id, 'dealmachine_property_id_missing'),
    full_address: stringValue(first(source, ['full_address', 'formatted_address', 'property_address', 'address'])),
    facts,
    credits: creditsFrom(root),
    request_id: stringValue(response.headers.get('x-request-id')),
  };
}

function sanitizeFact(value: unknown): unknown | null {
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? text.slice(0, 4000) : null;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const output = value.flatMap((item) => {
      const sanitized = sanitizeFact(item);
      return sanitized === null || typeof sanitized === 'object' ? [] : [sanitized];
    }).slice(0, 100);
    return output.length ? output : null;
  }
  return null;
}

function creditsFrom(payload: Record<string, unknown>): DealMachineCredits {
  const credits = record(payload.credits);
  return {
    used: nonNegativeNumber(credits.used),
    properties: nonNegativeNumber(credits.properties),
    people: nonNegativeNumber(credits.people),
    deduplicated: nonNegativeNumber(credits.deduplicated),
  };
}

function nonNegativeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  return 0;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function mergeRecords(...values: Record<string, unknown>[]): Record<string, unknown> {
  return Object.assign({}, ...values);
}

function first(value: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (value[key] !== undefined && value[key] !== null && value[key] !== '') return value[key];
  }
  return null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requiredString(value: unknown, code: string): string {
  const result = stringValue(value);
  if (!result) throw new DealMachineError(502, code);
  return result;
}
