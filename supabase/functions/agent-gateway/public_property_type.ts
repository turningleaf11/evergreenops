const HCAD_QUERY_URL = 'https://services.arcgis.com/su8ic9KbA7PYVxPS/ArcGIS/rest/services/Harris_County_Parcels/FeatureServer/1/query';
const BCPA_QUERY_URL = 'https://services.arcgis.com/JMAJrTsHNLrSsWf5/ArcGIS/rest/services/BCPA_Parcels/FeatureServer/53/query';
const LOOKUP_TIMEOUT_MS = 2500;

export type PublicPropertyTypeStatus =
  | 'resolved'
  | 'not_supported'
  | 'not_found'
  | 'ambiguous'
  | 'failed';

export interface PublicPropertyTypeResolution {
  status: PublicPropertyTypeStatus;
  provider: 'hcad_arcgis' | 'bcpa_arcgis' | 'none';
  property_type: string | null;
  matched_address: string | null;
  parcel_id: string | null;
  classification_code: string | null;
  source_url: string | null;
  error_code: string | null;
}

interface ParsedAddress {
  street_number: number;
  street_name: string;
  city: string | null;
  state: string | null;
  zip: string | null;
}

/**
 * Resolve only the minimum public-record fact needed for Ema routing: property type.
 *
 * This is deliberately a bounded, free-first lookup. It does not scrape owner/contact
 * data and it does not try to replace DealMachine's comprehensive subject snapshot.
 * Unsupported counties, timeouts, ambiguous matches, or provider failures simply
 * fall through so the caller can decide whether a paid provider lookup is justified.
 */
export async function resolvePublicPropertyType(
  address: string,
  facts: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<PublicPropertyTypeResolution> {
  const parsed = parseAddress(address, facts);
  if (!parsed) return empty('not_supported', 'none', 'public_record_address_unparseable');

  const county = normalized(first(facts, ['county', 'property_county']));
  const city = normalized(first(facts, ['city', 'property_city'])) ?? normalized(parsed.city);
  const state = normalizedState(first(facts, ['state', 'property_state'])) ?? parsed.state;

  // Harris County pilot. Houston is allowed as a routing hint because the HCAD
  // endpoint itself contains only Harris County parcels; no match safely falls through.
  if (state === 'TX' && (county?.includes('harris') || city === 'houston')) {
    return lookupHcad(parsed, fetchImpl);
  }

  // Broward County public parcel data exposes BCPA's use code directly. We only
  // invoke it when the source already identifies Broward to avoid querying every
  // Florida county speculatively.
  if (state === 'FL' && county?.includes('broward')) {
    return lookupBcpa(parsed, fetchImpl);
  }

  return empty('not_supported', 'none', null);
}

async function lookupHcad(
  parsed: ParsedAddress,
  fetchImpl: typeof fetch,
): Promise<PublicPropertyTypeResolution> {
  const whereParts = [
    `site_str_num = ${parsed.street_number}`,
    `UPPER(site_str_name) = '${sqlLiteral(parsed.street_name)}'`,
  ];
  if (parsed.zip) whereParts.push(`site_zip LIKE '${sqlLiteral(parsed.zip)}%'`);

  const url = arcgisUrl(HCAD_QUERY_URL, {
    where: whereParts.join(' AND '),
    outFields: 'HCAD_NUM,state_class,land_use,dscr,Full_Address,site_city,site_county,site_zip',
    returnGeometry: 'false',
    resultRecordCount: '3',
    f: 'json',
  });

  try {
    const body = await getArcgisJson(url, fetchImpl);
    const features = featureAttributes(body);
    if (!features.length) return empty('not_found', 'hcad_arcgis', null, HCAD_QUERY_URL);
    if (features.length !== 1) return empty('ambiguous', 'hcad_arcgis', 'public_record_multiple_matches', HCAD_QUERY_URL);

    const row = features[0];
    const stateClass = text(row.state_class)?.toUpperCase() ?? null;
    const description = text(row.dscr)?.toLowerCase() ?? '';
    const propertyType = hcadPropertyType(stateClass, description);
    if (!propertyType) {
      return {
        status: 'not_found',
        provider: 'hcad_arcgis',
        property_type: null,
        matched_address: text(row.Full_Address),
        parcel_id: text(row.HCAD_NUM),
        classification_code: stateClass,
        source_url: HCAD_QUERY_URL,
        error_code: 'public_record_type_unresolved',
      };
    }

    return {
      status: 'resolved',
      provider: 'hcad_arcgis',
      property_type: propertyType,
      matched_address: text(row.Full_Address),
      parcel_id: text(row.HCAD_NUM),
      classification_code: stateClass,
      source_url: HCAD_QUERY_URL,
      error_code: null,
    };
  } catch (error) {
    return empty(
      'failed',
      'hcad_arcgis',
      error instanceof Error && error.message === 'public_record_timeout'
        ? 'public_record_timeout'
        : 'public_record_request_failed',
      HCAD_QUERY_URL,
    );
  }
}

async function lookupBcpa(
  parsed: ParsedAddress,
  fetchImpl: typeof fetch,
): Promise<PublicPropertyTypeResolution> {
  const prefix = `${parsed.street_number} ${parsed.street_name}`;
  const whereParts = [`UPPER(FULL_SITE_ADDRESS) LIKE '${sqlLiteral(prefix)}%'`];
  if (parsed.city) whereParts.push(`UPPER(CITY_NAME) = '${sqlLiteral(parsed.city)}'`);

  const url = arcgisUrl(BCPA_QUERY_URL, {
    where: whereParts.join(' AND '),
    outFields: 'FOLIO,USE_CODE,FULL_SITE_ADDRESS,CITY_NAME',
    returnGeometry: 'false',
    resultRecordCount: '3',
    f: 'json',
  });

  try {
    const body = await getArcgisJson(url, fetchImpl);
    const features = featureAttributes(body);
    if (!features.length) return empty('not_found', 'bcpa_arcgis', null, BCPA_QUERY_URL);
    if (features.length !== 1) return empty('ambiguous', 'bcpa_arcgis', 'public_record_multiple_matches', BCPA_QUERY_URL);

    const row = features[0];
    const useCode = text(row.USE_CODE)?.padStart(2, '0') ?? null;
    const propertyType = bcpaPropertyType(useCode);
    if (!propertyType) {
      return {
        status: 'not_found',
        provider: 'bcpa_arcgis',
        property_type: null,
        matched_address: text(row.FULL_SITE_ADDRESS),
        parcel_id: text(row.FOLIO),
        classification_code: useCode,
        source_url: BCPA_QUERY_URL,
        error_code: 'public_record_type_unresolved',
      };
    }

    return {
      status: 'resolved',
      provider: 'bcpa_arcgis',
      property_type: propertyType,
      matched_address: text(row.FULL_SITE_ADDRESS),
      parcel_id: text(row.FOLIO),
      classification_code: useCode,
      source_url: BCPA_QUERY_URL,
      error_code: null,
    };
  } catch (error) {
    return empty(
      'failed',
      'bcpa_arcgis',
      error instanceof Error && error.message === 'public_record_timeout'
        ? 'public_record_timeout'
        : 'public_record_request_failed',
      BCPA_QUERY_URL,
    );
  }
}

function hcadPropertyType(stateClass: string | null, description: string): string | null {
  // Texas/HCAD A1 is single-family residential. Description is only a
  // corroborating fallback when the public layer exposes a clear label.
  if (stateClass === 'A1') return 'Single Family Residence';
  if (/single[ -]?family|residential 1 family|1 family residential/.test(description)) {
    return 'Single Family Residence';
  }
  if (/condo/.test(description)) return 'Condo';
  return null;
}

function bcpaPropertyType(useCode: string | null): string | null {
  // BCPA official use codes: 01 Single family, 04 Condominium. We deliberately
  // do not infer 08 (multi-family <10 units) because that does not distinguish
  // Evergreen's 2-4 unit small-multifamily boundary from 5-9 units.
  if (useCode === '01') return 'Single Family Residence';
  if (useCode === '04') return 'Condo';
  if (useCode === '02') return 'Manufactured Home';
  if (useCode === '03') return 'Multifamily';
  return null;
}

async function getArcgisJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`public_record_http_${response.status}`);
    const body = await response.json();
    if (record(body).error) throw new Error('public_record_arcgis_error');
    return body;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('public_record_timeout');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function featureAttributes(body: unknown): Record<string, unknown>[] {
  const features = Array.isArray(record(body).features) ? record(body).features as unknown[] : [];
  return features
    .map((feature) => record(record(feature).attributes))
    .filter((attributes) => Object.keys(attributes).length > 0);
}

function parseAddress(address: string, facts: Record<string, unknown>): ParsedAddress | null {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  const line = parts[0] ?? '';
  const match = line.match(/^(\d{1,8})\s+(.+)$/);
  if (!match) return null;

  const tokens = match[2].toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const directions = new Set(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW']);
  const suffixes = new Set([
    'ST', 'STREET', 'AVE', 'AVENUE', 'DR', 'DRIVE', 'RD', 'ROAD', 'LN', 'LANE',
    'BLVD', 'BOULEVARD', 'CT', 'COURT', 'CIR', 'CIRCLE', 'PL', 'PLACE', 'PKWY',
    'PARKWAY', 'WAY', 'TER', 'TERRACE', 'TRL', 'TRAIL', 'HWY', 'HIGHWAY',
  ]);
  if (tokens.length && directions.has(tokens[0])) tokens.shift();
  if (tokens.length && directions.has(tokens[tokens.length - 1])) tokens.pop();
  if (tokens.length && suffixes.has(tokens[tokens.length - 1])) tokens.pop();
  if (!tokens.length) return null;

  const city = normalized(first(facts, ['city', 'property_city'])) ?? normalized(parts[1]);
  const state = normalizedState(first(facts, ['state', 'property_state'])) ??
    normalizedState((parts[2] ?? '').match(/\b([A-Za-z]{2})\b/)?.[1] ?? null);
  const zip = normalizedZip(first(facts, ['zip', 'postal_code', 'property_zip'])) ??
    normalizedZip((parts[2] ?? '').match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] ?? null);

  return {
    street_number: Number(match[1]),
    street_name: tokens.join(' '),
    city,
    state,
    zip,
  };
}

function arcgisUrl(base: string, params: Record<string, string>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function sqlLiteral(value: string): string {
  return value.toUpperCase().replace(/'/g, "''");
}

function empty(
  status: Exclude<PublicPropertyTypeStatus, 'resolved'>,
  provider: PublicPropertyTypeResolution['provider'],
  errorCode: string | null,
  sourceUrl: string | null = null,
): PublicPropertyTypeResolution {
  return {
    status,
    provider,
    property_type: null,
    matched_address: null,
    parcel_id: null,
    classification_code: null,
    source_url: sourceUrl,
    error_code: errorCode,
  };
}

function first(recordValue: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = recordValue[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function normalized(value: unknown): string | null {
  const valueText = text(value);
  return valueText ? valueText.toLowerCase().replace(/\s+county$/i, '').trim() : null;
}

function normalizedState(value: unknown): string | null {
  const valueText = text(value)?.toUpperCase() ?? '';
  return /^[A-Z]{2}$/.test(valueText) ? valueText : null;
}

function normalizedZip(value: unknown): string | null {
  const valueText = text(value) ?? '';
  const match = valueText.match(/\b(\d{5})\b/);
  return match?.[1] ?? null;
}

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
