const DEALMACHINE_BASE = 'https://api.v2.dealmachine.com/v1';
const MINIMUM_COMPS = 3;

export class DealMachineError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
    this.name = 'DealMachineError';
  }
}

export interface DealMachineCredits {
  used: number;
  properties: number;
  people: number;
  deduplicated: number;
}

export interface DealMachineSubjectFacts {
  dm_property_id: string;
  full_address: string | null;
  sqft: number | null;
  year_built: number | null;
  beds: number | null;
  baths: number | null;
  stories: number | null;
  build_style: string | null;
  property_type: string | null;
  latitude: number | null;
  longitude: number | null;
  estimated_value: number | null;
}

export interface DealMachineCompFacts {
  id: string | null;
  address: string;
  property_type: string | null;
  sqft: number;
  year_built: number | null;
  beds: number | null;
  baths: number | null;
  stories: number | null;
  build_style: string | null;
  condition: string | null;
  sale_price: number;
  sale_date: string;
  distance_miles: number;
}

export interface DealMachineValuationData {
  subject: DealMachineSubjectFacts;
  comps: DealMachineCompFacts[];
  search_pass: 'standard' | 'expanded';
  credits: DealMachineCredits;
  request_ids: string[];
}

export async function fetchDealMachineValuation(
  apiKey: string,
  address: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DealMachineValuationData> {
  if (!apiKey.trim()) throw new DealMachineError(503, 'dealmachine_not_configured');
  if (!address.trim()) throw new DealMachineError(409, 'normalized_address_required');

  const enrichment = await dealMachineJson(
    `${DEALMACHINE_BASE}/enrichment/address`,
    apiKey,
    {
      data: [{ full_address: address.trim() }],
      contact_audience: 'none',
      // These field IDs are explicitly documented by DealMachine. Contacts are intentionally disabled.
      fields: ['estimated_value', 'year_built', 'living_area_sqft'],
    },
    fetchImpl,
  );

  const enrichmentPayload = record(enrichment.body);
  const enrichmentRows = array(enrichmentPayload.data).map(record);
  const matched = enrichmentRows.find((row) => row.matched === true && stringValue(row.dm_property_id));
  if (!matched) throw new DealMachineError(404, 'dealmachine_property_not_found');

  const subject = normalizeSubject(matched);
  const standard = await fetchComps(apiKey, subject, '6months', fetchImpl);
  let comps = normalizeCompPayload(standard.body, subject);
  let searchPass: 'standard' | 'expanded' = 'standard';
  const requestIds = unique([enrichment.requestId, standard.requestId]);
  const creditParts = [creditsFrom(enrichmentPayload), creditsFrom(record(standard.body))];

  if (comps.length < MINIMUM_COMPS) {
    const expanded = await fetchComps(apiKey, subject, '12months', fetchImpl);
    comps = dedupeComps([...comps, ...normalizeCompPayload(expanded.body, subject)]);
    searchPass = 'expanded';
    requestIds.push(...unique([expanded.requestId]).filter((id) => !requestIds.includes(id)));
    creditParts.push(creditsFrom(record(expanded.body)));
  }

  return {
    subject,
    comps,
    search_pass: searchPass,
    credits: addCredits(creditParts),
    request_ids: requestIds,
  };
}

async function fetchComps(
  apiKey: string,
  subject: DealMachineSubjectFacts,
  timeframe: '6months' | '12months',
  fetchImpl: typeof fetch,
): Promise<{ body: unknown; requestId: string | null }> {
  return dealMachineJson(
    `${DEALMACHINE_BASE}/comps`,
    apiKey,
    {
      property_ids: [subject.dm_property_id],
      location: { type: 'radius', radius_miles: 1 },
      criteria: {
        timeframe,
        bedroom_tolerance: 1,
        bathroom_tolerance: 0.5,
        sqft_tolerance_percent: 15,
        match_property_type: true,
        include_foreclosures: false,
        include_pending: false,
        // CashValue is based on closed sold evidence. Active listings must not enter the comp sample.
        include_active_listings: false,
        sort_by: 'match',
        sort_direction: 'desc',
        limit: 25,
      },
    },
    fetchImpl,
  );
}

async function dealMachineJson(
  url: string,
  apiKey: string,
  body: unknown,
  fetchImpl: typeof fetch,
): Promise<{ body: unknown; requestId: string | null }> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new DealMachineError(502, 'dealmachine_invalid_response');
  }

  return { body: parsed, requestId: stringValue(response.headers.get('x-request-id')) };
}

function normalizeSubject(row: Record<string, unknown>): DealMachineSubjectFacts {
  const property = mergedPropertyRecord(row);
  const id = stringValue(first(property, ['dm_property_id', 'property_id', 'id']));
  if (!id) throw new DealMachineError(502, 'dealmachine_property_id_missing');
  return {
    dm_property_id: id,
    full_address: stringValue(first(property, ['full_address', 'formatted_address', 'property_address', 'address'])),
    sqft: numberValue(first(property, ['living_area_sqft', 'square_feet', 'sqft', 'building_square_feet', 'squareFootage'])),
    year_built: numberValue(first(property, ['year_built', 'yearBuilt'])),
    beds: numberValue(first(property, ['bedrooms', 'beds', 'bed_count', 'bedroom_count'])),
    baths: numberValue(first(property, ['bathrooms', 'baths', 'bath_count', 'bathroom_count', 'total_bathrooms'])),
    stories: numberValue(first(property, ['stories', 'story_count', 'number_of_stories', 'floor_count'])),
    build_style: stringValue(first(property, ['build_style', 'building_style', 'architecture_style', 'architecture_type', 'style'])),
    property_type: stringValue(first(property, ['property_type', 'propertyType', 'property_type_label', 'land_use'])),
    latitude: numberValue(first(property, ['latitude', 'lat'])),
    longitude: numberValue(first(property, ['longitude', 'lng', 'lon'])),
    estimated_value: numberValue(first(property, ['estimated_value', 'estimatedValue', 'property_value'])),
  };
}

function normalizeCompPayload(payload: unknown, subject: DealMachineSubjectFacts): DealMachineCompFacts[] {
  const rows = extractCompRows(payload);
  const comps: DealMachineCompFacts[] = [];
  for (const row of rows) {
    const comp = normalizeComp(row, subject);
    if (comp) comps.push(comp);
  }
  return dedupeComps(comps);
}

function normalizeComp(row: Record<string, unknown>, subject: DealMachineSubjectFacts): DealMachineCompFacts | null {
  const property = mergedPropertyRecord(row);
  const sale = mergeRecords(record(row.sale), record(row.last_sale), record(row.mls), record(property.sale), record(property.last_sale));
  const id = stringValue(first(property, ['dm_property_id', 'property_id', 'id']));
  if (id && id === subject.dm_property_id) return null;

  const address = stringValue(first(property, ['full_address', 'formatted_address', 'property_address', 'address']));
  const sqft = numberValue(first(property, ['living_area_sqft', 'square_feet', 'sqft', 'building_square_feet', 'squareFootage']));
  const salePrice = numberValue(first(mergeRecords(row, sale, property), ['sale_price', 'last_sale_price', 'sold_price', 'close_price', 'lastSalePrice', 'price']));
  const saleDateRaw = stringValue(first(mergeRecords(row, sale, property), ['sale_date', 'last_sale_date', 'sold_date', 'close_date', 'lastSaleDate', 'date']));
  if (!address || sqft === null || sqft <= 0 || salePrice === null || salePrice <= 0 || !saleDateRaw) return null;
  if (subject.full_address && normalizeAddress(address) === normalizeAddress(subject.full_address)) return null;

  const saleDate = normalizeDate(saleDateRaw);
  if (!saleDate) return null;

  let distance = numberValue(first(row, ['distance_miles', 'distance', 'distance_from_subject', 'distanceMiles']));
  if (distance === null) {
    const latitude = numberValue(first(property, ['latitude', 'lat']));
    const longitude = numberValue(first(property, ['longitude', 'lng', 'lon']));
    if (subject.latitude !== null && subject.longitude !== null && latitude !== null && longitude !== null) {
      distance = haversineMiles(subject.latitude, subject.longitude, latitude, longitude);
    }
  }
  // DealMachine is requested with a 1-mile radius. If neither the provider nor coordinates provide
  // a defensible distance, do not invent one simply to make a comp pass Evergreen's hard filter.
  if (distance === null || distance < 0 || distance > 1) return null;

  return {
    id,
    address,
    property_type: stringValue(first(property, ['property_type', 'propertyType', 'property_type_label', 'land_use'])),
    sqft,
    year_built: numberValue(first(property, ['year_built', 'yearBuilt'])),
    beds: numberValue(first(property, ['bedrooms', 'beds', 'bed_count', 'bedroom_count'])),
    baths: numberValue(first(property, ['bathrooms', 'baths', 'bath_count', 'bathroom_count', 'total_bathrooms'])),
    stories: numberValue(first(property, ['stories', 'story_count', 'number_of_stories', 'floor_count'])),
    build_style: stringValue(first(property, ['build_style', 'building_style', 'architecture_style', 'architecture_type', 'style'])),
    condition: stringValue(first(property, ['condition', 'property_condition', 'quality'])),
    sale_price: salePrice,
    sale_date: saleDate,
    distance_miles: Math.round(distance * 100) / 100,
  };
}

function extractCompRows(payload: unknown): Record<string, unknown>[] {
  const root = record(payload);
  const data = array(root.data);
  const rows: Record<string, unknown>[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    const item = record(value);
    if (!Object.keys(item).length) return;
    let nested = false;
    for (const key of ['comps', 'comparables', 'comparable_properties', 'comparable_sales', 'results']) {
      if (Array.isArray(item[key])) {
        nested = true;
        visit(item[key]);
      }
    }
    if (!nested && looksLikeComp(item)) rows.push(item);
  };
  visit(data);
  return rows;
}

function looksLikeComp(row: Record<string, unknown>): boolean {
  const property = mergedPropertyRecord(row);
  const combined = mergeRecords(row, record(row.sale), record(row.last_sale), record(row.mls), property);
  return Boolean(
    stringValue(first(property, ['full_address', 'formatted_address', 'property_address', 'address'])) &&
      numberValue(first(combined, ['sale_price', 'last_sale_price', 'sold_price', 'close_price', 'lastSalePrice', 'price'])) !== null &&
      stringValue(first(combined, ['sale_date', 'last_sale_date', 'sold_date', 'close_date', 'lastSaleDate', 'date'])),
  );
}

function mergedPropertyRecord(row: Record<string, unknown>): Record<string, unknown> {
  return mergeRecords(row, record(row.property), record(row.property_data), record(row.subject_property));
}

function creditsFrom(payload: Record<string, unknown>): DealMachineCredits {
  const value = record(payload.credits);
  return {
    used: numberValue(value.used) ?? 0,
    properties: numberValue(value.properties) ?? 0,
    people: numberValue(value.people) ?? 0,
    deduplicated: numberValue(value.deduplicated) ?? 0,
  };
}

function addCredits(values: DealMachineCredits[]): DealMachineCredits {
  return values.reduce(
    (total, value) => ({
      used: total.used + value.used,
      properties: total.properties + value.properties,
      people: total.people + value.people,
      deduplicated: total.deduplicated + value.deduplicated,
    }),
    { used: 0, properties: 0, people: 0, deduplicated: 0 },
  );
}

function dedupeComps(comps: DealMachineCompFacts[]): DealMachineCompFacts[] {
  const seen = new Set<string>();
  const result: DealMachineCompFacts[] = [];
  for (const comp of comps) {
    const key = (comp.id || normalizeAddress(comp.address)).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(comp);
  }
  return result;
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

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value.replace(/[$,%\s,]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value: string): string | null {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function normalizeAddress(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function unique(values: Array<string | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radius = 3958.7613;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
