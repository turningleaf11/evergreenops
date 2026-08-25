const CENSUS_GEOCODER_URL = 'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress';
const LOOKUP_TIMEOUT_MS = 2500;

export type PublicGeographyStatus = 'resolved' | 'not_supported' | 'not_found' | 'ambiguous' | 'failed';

export interface PublicGeographyResolution {
  status: PublicGeographyStatus;
  provider: 'census_geocoder' | 'none';
  county: string | null;
  state: string | null;
  city: string | null;
  zip: string | null;
  matched_address: string | null;
  source_url: string | null;
  error_code: string | null;
}

export interface ParsedNormalizedAddress {
  city: string | null;
  state: string | null;
  zip: string | null;
}

/**
 * Parse only facts explicitly represented in Evergreen's normalized address.
 * These are deterministic address-normalization facts and require no network call.
 */
export function parseNormalizedAddressFacts(address: string): ParsedNormalizedAddress {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  const city = parts.length >= 2 ? clean(parts[1]) : null;
  const region = parts.length >= 3 ? parts.slice(2).join(' ') : '';
  const stateMatch = region.match(/\b([A-Za-z]{2})\b/);
  const zipMatch = region.match(/\b(\d{5})(?:-\d{4})?\b/);
  return {
    city,
    state: stateMatch ? stateMatch[1].toUpperCase() : null,
    zip: zipMatch?.[1] ?? null,
  };
}

/**
 * Free county resolution for Florida intake candidates whose normalized address
 * identifies Florida but whose county was not supplied by the source. The Census
 * Geocoder is bounded and non-authoritative for property facts; failure simply
 * leaves county unknown for human review.
 */
export async function resolveFreeFloridaCounty(
  address: string,
  facts: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<PublicGeographyResolution> {
  const parsed = parseNormalizedAddressFacts(address);
  const state = stateValue(first(facts, ['state', 'property_state'])) ?? parsed.state;
  const existingCounty = clean(first(facts, ['county', 'property_county']));
  if (existingCounty) {
    return {
      status: 'not_supported',
      provider: 'none',
      county: existingCounty,
      state,
      city: clean(first(facts, ['city', 'property_city'])) ?? parsed.city,
      zip: zipValue(first(facts, ['zip', 'postal_code', 'property_zip'])) ?? parsed.zip,
      matched_address: null,
      source_url: null,
      error_code: null,
    };
  }
  if (state !== 'FL') return empty('not_supported', null);

  const url = new URL(CENSUS_GEOCODER_URL);
  url.searchParams.set('address', address);
  url.searchParams.set('benchmark', 'Public_AR_Current');
  url.searchParams.set('vintage', 'Current_Current');
  url.searchParams.set('format', 'json');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return empty('failed', `census_geocoder_http_${response.status}`);
    const body = record(await response.json());
    const result = record(body.result);
    const matches = recordArray(result.addressMatches);
    if (!matches.length) return empty('not_found', null);
    if (matches.length !== 1) return empty('ambiguous', 'census_geocoder_multiple_matches');

    const match = matches[0];
    const geographies = record(match.geographies);
    const counties = recordArray(geographies.Counties);
    if (!counties.length) return empty('not_found', 'census_county_not_found');
    if (counties.length !== 1) return empty('ambiguous', 'census_county_ambiguous');

    const county = clean(counties[0].NAME);
    if (!county) return empty('not_found', 'census_county_name_missing');
    const components = record(match.addressComponents);
    return {
      status: 'resolved',
      provider: 'census_geocoder',
      county,
      state: stateValue(components.state) ?? state,
      city: clean(components.city) ?? parsed.city,
      zip: zipValue(components.zip) ?? parsed.zip,
      matched_address: clean(match.matchedAddress),
      source_url: CENSUS_GEOCODER_URL,
      error_code: null,
    };
  } catch (error) {
    if (controller.signal.aborted) return empty('failed', 'census_geocoder_timeout');
    return empty('failed', error instanceof Error ? 'census_geocoder_request_failed' : 'census_geocoder_request_failed');
  } finally {
    clearTimeout(timer);
  }
}

function empty(status: Exclude<PublicGeographyStatus, 'resolved'>, errorCode: string | null): PublicGeographyResolution {
  return {
    status,
    provider: status === 'not_supported' ? 'none' : 'census_geocoder',
    county: null,
    state: null,
    city: null,
    zip: null,
    matched_address: null,
    source_url: status === 'not_supported' ? null : CENSUS_GEOCODER_URL,
    error_code: errorCode,
  };
}

function first(value: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const candidate = value[key];
    if (candidate !== undefined && candidate !== null && candidate !== '') return candidate;
  }
  return null;
}

function clean(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function stateValue(value: unknown): string | null {
  const text = clean(value)?.toUpperCase() ?? '';
  return /^[A-Z]{2}$/.test(text) ? text : null;
}

function zipValue(value: unknown): string | null {
  const text = clean(value) ?? '';
  return text.match(/\b(\d{5})\b/)?.[1] ?? null;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
    : [];
}
