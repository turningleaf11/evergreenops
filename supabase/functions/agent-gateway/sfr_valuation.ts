import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import {
  DealMachineError,
  fetchDealMachineValuation,
  type DealMachineCachedProperty,
  type DealMachineCompFacts,
} from '../_shared/dealmachine.ts';
import { resolveGhlContext } from '../_shared/ghl.ts';
import { calculateCashValue, normalizePropertyType, type CashValueComp, type CashValueSubject } from './cash_value.ts';
import { DealIntakeError, deriveRoute } from './intake.ts';

const RENTCAST_BASE = 'https://api.rentcast.io/v1';
const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = 'v3';
const SFR_PIPELINE_ID = 'w3OtDJjCdN840Hwb1fpt';
const GHL_PROPERTY_TYPE_FIELD_ID = '36WeaPwncmXLzUQhbGHd';
const GHL_PROPERTY_ADDRESS_FIELD_ID = 'hH02pevCKOTpmDYfOTnu';
const MAX_SOURCE_RECORDS = 50;
const MINIMUM_COMPS = 3;
const PROPERTY_CACHE_DAYS = 30;

export class SfrValuationError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
    this.name = 'SfrValuationError';
  }
}

interface CandidateRow {
  id: string;
  workspace_id: string;
  normalized_address: string | null;
  extracted_facts: Record<string, unknown>;
  ghl_opportunity_id: string | null;
  is_test: boolean;
}

interface ProviderConfig {
  dealmachineApiKey: string | null;
  rentcastApiKey: string | null;
  zillowToken: string | null;
}

interface CachedPropertySnapshot {
  id: string;
  provider_property_id: string;
  normalized_address: string;
  facts: Record<string, unknown>;
  credits_used: number;
  fetched_at: string;
}

export interface PublicSubjectEvidence {
  source_url: string;
  source_name?: string | null;
  sqft?: number | null;
  year_built?: number | null;
  beds?: number | null;
  baths?: number | null;
  stories?: number | null;
  build_style?: string | null;
}

export interface SfrValuationOptions {
  subject_evidence?: PublicSubjectEvidence | null;
  public_comps?: CashValueComp[];
}

export interface SfrValuationResult {
  contract: 'sfr_valuation_v2';
  target_source: 'ema_candidate' | 'ghl_opportunity';
  candidate_id: string | null;
  opportunity_id: string | null;
  subject: CashValueSubject;
  providers: {
    dealmachine: {
      status: 'used' | 'not_configured' | 'failed';
      comp_count: number;
      property_id: string | null;
      estimated_value: number | null;
      credits_used: number;
      error_code: string | null;
    };
    rentcast: {
      status: 'used' | 'not_configured' | 'failed' | 'skipped_primary_sufficient';
      comp_count: number;
      avm: number | null;
      avm_range: { low: number; high: number } | null;
      error_code: string | null;
    };
    public_evidence: { status: 'used' | 'not_supplied'; comp_count: number; subject_evidence: boolean };
    zillow: { status: 'not_configured' | 'configured_pending_adapter' };
  };
  dealmachine_property: {
    status: 'fetched' | 'cached' | 'not_available';
    snapshot_id: string | null;
    provider_property_id: string | null;
    normalized_address: string | null;
    facts: Record<string, unknown>;
    request_id: string | null;
    credits_used: number;
    fetched_at: string | null;
  };
  comp_source: 'dealmachine' | 'rentcast' | 'public_evidence' | 'mixed' | 'none';
  comps_found: number;
  valuation_reference: {
    source: 'dealmachine_estimated_value' | 'rentcast_avm' | 'none';
    value: number | null;
    range: { low: number; high: number } | null;
  };
  cash_value: ReturnType<typeof calculateCashValue>;
  notes: string[];
}

export async function runSfrValuation(
  admin: SupabaseClient,
  workspaceId: string,
  candidateId: string,
  options: SfrValuationOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<SfrValuationResult> {
  const candidate = await loadCandidate(admin, workspaceId, candidateId);
  if (candidate.is_test) throw new SfrValuationError(409, 'test_candidate_not_permitted');
  return runResolvedSfrValuation(admin, workspaceId, {
    targetSource: 'ema_candidate',
    candidateId: candidate.id,
    opportunityId: candidate.ghl_opportunity_id,
    subject: subjectFromCandidate(candidate),
  }, options, fetchImpl);
}

export async function runSfrOpportunityValuation(
  admin: SupabaseClient,
  workspaceId: string,
  opportunityId: string,
  options: SfrValuationOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<SfrValuationResult> {
  const subject = await subjectFromGhlOpportunity(admin, opportunityId, fetchImpl);
  const { data: candidates, error } = await admin.from('ema_candidates').select('id')
    .eq('workspace_id', workspaceId).eq('ghl_opportunity_id', opportunityId).limit(2);
  if (error) throw new SfrValuationError(500, 'candidate_lookup_failed');
  const candidateId = candidates?.length === 1 ? String(candidates[0].id) : null;
  return runResolvedSfrValuation(admin, workspaceId, {
    targetSource: 'ghl_opportunity',
    candidateId,
    opportunityId,
    subject,
  }, options, fetchImpl);
}

async function runResolvedSfrValuation(
  admin: SupabaseClient,
  workspaceId: string,
  target: {
    targetSource: 'ema_candidate' | 'ghl_opportunity';
    candidateId: string | null;
    opportunityId: string | null;
    subject: CashValueSubject;
  },
  options: SfrValuationOptions,
  fetchImpl: typeof fetch,
): Promise<SfrValuationResult> {
  const config = await resolveProviderConfig(admin);
  let subject = applySubjectEvidence(target.subject, options.subject_evidence ?? null);
  const notes: string[] = [];
  if (options.subject_evidence?.source_url) {
    notes.push(`Public subject facts were supplied from ${options.subject_evidence.source_url}; the Gateway does not treat the source as a sold comp.`);
  }

  const publicComps = dedupeComps((options.public_comps ?? []).map((comp) => ({
    ...comp,
    source: comp.source ?? 'public_evidence',
  })));

  const providerState: SfrValuationResult['providers'] = {
    dealmachine: {
      status: 'not_configured',
      comp_count: 0,
      property_id: null,
      estimated_value: null,
      credits_used: 0,
      error_code: null,
    },
    rentcast: { status: 'not_configured', comp_count: 0, avm: null, avm_range: null, error_code: null },
    public_evidence: {
      status: publicComps.length || options.subject_evidence ? 'used' : 'not_supplied',
      comp_count: publicComps.length,
      subject_evidence: Boolean(options.subject_evidence),
    },
    zillow: { status: config.zillowToken ? 'configured_pending_adapter' : 'not_configured' },
  };

  let dealMachineProperty: SfrValuationResult['dealmachine_property'] = {
    status: 'not_available',
    snapshot_id: null,
    provider_property_id: null,
    normalized_address: null,
    facts: {},
    request_id: null,
    credits_used: 0,
    fetched_at: null,
  };
  let dealMachineComps: CashValueComp[] = [];
  let rentcastComps: CashValueComp[] = [];
  let reference: SfrValuationResult['valuation_reference'] = { source: 'none', value: null, range: null };

  // DealMachine is Evergreen's primary property/comps provider. If Ema already
  // persisted a fresh property snapshot, Cash reuses it and makes only the comps
  // call. Otherwise the valuation run performs one comprehensive subject-property
  // enrichment call plus one 12-month closed-comps call.
  if (config.dealmachineApiKey) {
    try {
      const cachedSnapshot = target.candidateId
        ? await loadFreshDealMachineSnapshot(admin, workspaceId, target.candidateId)
        : null;
      const cachedProperty: DealMachineCachedProperty | null = cachedSnapshot
        ? {
          dm_property_id: cachedSnapshot.provider_property_id,
          full_address: cachedSnapshot.normalized_address,
          facts: cachedSnapshot.facts,
        }
        : null;
      const dealMachine = await fetchDealMachineValuation(
        config.dealmachineApiKey,
        String(subject.address ?? ''),
        fetchImpl,
        cachedProperty,
      );
      subject = mergeSubject(subject, {
        sqft: dealMachine.subject.sqft ?? undefined,
        year_built: dealMachine.subject.year_built,
        beds: dealMachine.subject.beds,
        baths: dealMachine.subject.baths,
        stories: dealMachine.subject.stories,
        build_style: dealMachine.subject.build_style,
      });
      dealMachineComps = dealMachine.comps.map(normalizeDealMachineComp);
      providerState.dealmachine = {
        status: 'used',
        comp_count: dealMachineComps.length,
        property_id: dealMachine.subject.dm_property_id,
        estimated_value: dealMachine.subject.estimated_value,
        credits_used: dealMachine.credits.used,
        error_code: null,
      };
      dealMachineProperty = {
        status: dealMachine.property_source,
        snapshot_id: cachedSnapshot?.id ?? null,
        provider_property_id: dealMachine.subject.dm_property_id,
        normalized_address: dealMachine.subject.full_address ?? (String(subject.address ?? '').trim() || null),
        facts: dealMachine.property_facts,
        request_id: dealMachine.property_request_id,
        credits_used: dealMachine.property_credits.used,
        fetched_at: cachedSnapshot?.fetched_at ?? null,
      };
      if (dealMachine.subject.estimated_value !== null) {
        reference = {
          source: 'dealmachine_estimated_value',
          value: dealMachine.subject.estimated_value,
          range: null,
        };
      }
      notes.push(
        dealMachine.property_source === 'cached'
          ? `DealMachine subject property data was reused from Evergreen's fresh cache; one 12-month closed-comps API call returned ${dealMachineComps.length} comp${dealMachineComps.length === 1 ? '' : 's'} for Evergreen filtering.`
          : `DealMachine fetched comprehensive subject property data once and one 12-month closed-comps pool; ${dealMachineComps.length} comp${dealMachineComps.length === 1 ? '' : 's'} were returned for Evergreen filtering.`,
      );
      notes.push('CashValue applies Evergreen’s 6-month standard criteria first and 12-month expanded criteria locally to the single DealMachine comp pool; it does not make a second comps call solely for recency expansion.');
    } catch (error) {
      const code = error instanceof DealMachineError ? error.code : 'dealmachine_request_failed';
      providerState.dealmachine = {
        status: 'failed',
        comp_count: 0,
        property_id: null,
        estimated_value: null,
        credits_used: 0,
        error_code: code,
      };
      notes.push(`DealMachine could not provide source-backed subject/comps data (${code}); the valuation pipeline continued to configured fallbacks.`);
    }
  } else {
    notes.push('DealMachine is not configured for the Agent Gateway; no DealMachine API call was attempted.');
  }

  // RentCast is a fallback only. Do not spend another provider call when
  // DealMachine already supplied the minimum comp set.
  if (dealMachineComps.length >= MINIMUM_COMPS) {
    providerState.rentcast.status = config.rentcastApiKey ? 'skipped_primary_sufficient' : 'not_configured';
  } else if (config.rentcastApiKey) {
    try {
      const rentcast = await fetchRentCastValuation(config.rentcastApiKey, subject, fetchImpl);
      subject = mergeSubject(subject, rentcast.subject);
      rentcastComps = rentcast.comps;
      providerState.rentcast = {
        status: 'used',
        comp_count: rentcastComps.length,
        avm: rentcast.avm,
        avm_range: rentcast.avmRange,
        error_code: null,
      };
      if (reference.value === null && rentcast.avm !== null) {
        reference = { source: 'rentcast_avm', value: rentcast.avm, range: rentcast.avmRange };
      }
    } catch (error) {
      const code = error instanceof SfrValuationError ? error.code : 'rentcast_request_failed';
      providerState.rentcast = { status: 'failed', comp_count: 0, avm: null, avm_range: null, error_code: code };
      notes.push(`RentCast fallback could not provide verified comps (${code}).`);
    }
  } else {
    notes.push('RentCast is not configured; after DealMachine, source-backed public evidence is the next available comp fallback.');
  }

  if (!config.zillowToken) {
    notes.push('Zillow Zestimate API access is not configured. Zillow is not required for CashValue when source-backed sold comps are available.');
  } else {
    notes.push('Zillow credentials are present, but the Zillow adapter remains valuation-reference-only pending the approved access contract and response shape.');
  }

  if (!(subject.sqft > 0)) throw new SfrValuationError(409, 'subject_sqft_required');

  const comps = dedupeComps([...dealMachineComps, ...rentcastComps, ...publicComps]);
  const activeSources = [
    dealMachineComps.length ? 'dealmachine' : null,
    rentcastComps.length ? 'rentcast' : null,
    publicComps.length ? 'public_evidence' : null,
  ].filter((value): value is 'dealmachine' | 'rentcast' | 'public_evidence' => Boolean(value));
  const compSource: SfrValuationResult['comp_source'] = activeSources.length > 1
    ? 'mixed'
    : activeSources[0] ?? 'none';
  const cashValue = calculateCashValue(subject, comps);

  if (publicComps.length) {
    notes.push(`${publicComps.length} source-backed public comp${publicComps.length === 1 ? ' was' : 's were'} supplied for CashValue review. Source URLs remain attached to the comp evidence for audit.`);
  }
  if (cashValue.status === 'thin_comp_set') {
    notes.push(`Only ${cashValue.selected_comp_count} defensible comp${cashValue.selected_comp_count === 1 ? '' : 's'} were found. Cash must submit the available comps and low-confidence CashValue rather than inventing replacements.`);
  }
  if (cashValue.selected_comp_count === 0) {
    notes.push('No defensible sold comps were found from DealMachine or the configured fallback evidence set.');
  }
  if (cashValue.selected_comp_count === 0 && reference.value !== null) {
    notes.push('An external estimated-value reference is available, but it is not labeled as CashValue because no defensible sold comps qualified.');
  }

  return {
    contract: 'sfr_valuation_v2',
    target_source: target.targetSource,
    candidate_id: target.candidateId,
    opportunity_id: target.opportunityId,
    subject,
    providers: providerState,
    dealmachine_property: dealMachineProperty,
    comp_source: compSource,
    comps_found: comps.length,
    valuation_reference: reference,
    cash_value: cashValue,
    notes,
  };
}

async function loadCandidate(admin: SupabaseClient, workspaceId: string, candidateId: string): Promise<CandidateRow> {
  const { data, error } = await admin.from('ema_candidates')
    .select('id, workspace_id, normalized_address, extracted_facts, ghl_opportunity_id, is_test')
    .eq('id', candidateId).eq('workspace_id', workspaceId).maybeSingle();
  if (error) throw new SfrValuationError(500, 'candidate_lookup_failed');
  if (!data) throw new SfrValuationError(404, 'candidate_not_found');
  return data as CandidateRow;
}

async function loadFreshDealMachineSnapshot(
  admin: SupabaseClient,
  workspaceId: string,
  candidateId: string,
): Promise<CachedPropertySnapshot | null> {
  const cutoff = new Date(Date.now() - PROPERTY_CACHE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin.from('property_enrichment_snapshots')
    .select('id, provider_property_id, normalized_address, facts, credits_used, fetched_at')
    .eq('workspace_id', workspaceId)
    .eq('candidate_id', candidateId)
    .eq('provider', 'dealmachine')
    .gte('fetched_at', cutoff)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const providerPropertyId = stringValue(data.provider_property_id);
  const normalizedAddress = stringValue(data.normalized_address);
  if (!providerPropertyId || !normalizedAddress) return null;
  return {
    id: String(data.id),
    provider_property_id: providerPropertyId,
    normalized_address: normalizedAddress,
    facts: record(data.facts),
    credits_used: numberValue(data.credits_used) ?? 0,
    fetched_at: String(data.fetched_at),
  };
}

async function resolveProviderConfig(admin: SupabaseClient): Promise<ProviderConfig> {
  // DealMachine is intentionally Edge-secret-only. Never source its raw key from app_settings.
  const keys = [
    'RENTCAST_API_KEY',
    'ZILLOW_ACCESS_TOKEN',
    'ZILLOW_API_TOKEN',
    'ZILLOW_ZESTIMATE_TOKEN',
  ];
  const { data, error } = await admin.from('app_settings').select('key, value').in('key', keys);
  if (error) throw new SfrValuationError(500, 'valuation_configuration_lookup_failed');
  const settings: Record<string, string> = {};
  for (const row of data ?? []) {
    if (typeof row.key === 'string' && typeof row.value === 'string' && row.value.trim()) settings[row.key] = row.value.trim();
  }
  const dealmachineApiKey = Deno.env.get('DEALMACHINE_API_KEY')?.trim() || null;
  const rentcastApiKey = settings.RENTCAST_API_KEY || Deno.env.get('RENTCAST_API_KEY') || null;
  const zillowToken = settings.ZILLOW_ACCESS_TOKEN || settings.ZILLOW_API_TOKEN || settings.ZILLOW_ZESTIMATE_TOKEN ||
    Deno.env.get('ZILLOW_ACCESS_TOKEN') || Deno.env.get('ZILLOW_API_TOKEN') || Deno.env.get('ZILLOW_ZESTIMATE_TOKEN') || null;
  return { dealmachineApiKey, rentcastApiKey, zillowToken };
}

export function subjectFromCandidate(candidate: Pick<CandidateRow, 'normalized_address' | 'extracted_facts'>): CashValueSubject {
  const facts = candidate.extracted_facts ?? {};
  let propertyType: string;
  try {
    propertyType = deriveRoute(facts).propertyType;
  } catch (error) {
    if (error instanceof DealIntakeError) throw new SfrValuationError(409, 'property_type_unresolved');
    throw error;
  }
  if (propertyType !== 'Single Family Residence') throw new SfrValuationError(409, 'single_family_residence_required');
  const address = stringValue(candidate.normalized_address);
  if (!address) throw new SfrValuationError(409, 'normalized_address_required');
  return {
    address,
    property_type: 'Single Family Residence',
    sqft: numberValue(first(facts, ['sqft', 'square_feet', 'squareFeet', 'living_area', 'livingArea'])) ?? 0,
    year_built: numberValue(first(facts, ['year_built', 'yearBuilt', 'built_year', 'builtYear'])),
    beds: numberValue(first(facts, ['bedrooms', 'beds', 'bed_count', 'bedCount'])),
    baths: numberValue(first(facts, ['bathrooms', 'baths', 'bath_count', 'bathCount'])),
    stories: numberValue(first(facts, ['stories', 'story_count', 'storyCount', 'floor_count', 'floorCount'])),
    build_style: stringValue(first(facts, ['build_style', 'buildStyle', 'architecture_type', 'architectureType'])),
  };
}

export function subjectFromOpportunityRecord(opportunity: Record<string, unknown>): CashValueSubject {
  const pipelineId = stringValue(opportunity.pipelineId ?? opportunity.pipeline_id);
  if (pipelineId !== SFR_PIPELINE_ID) throw new SfrValuationError(409, 'sfr_pipeline_required');
  const fields = Array.isArray(opportunity.customFields) ? opportunity.customFields.filter(isRecord) : [];
  const propertyType = stringValue(customFieldValue(fields, GHL_PROPERTY_TYPE_FIELD_ID));
  if (normalizePropertyType(propertyType ?? '') !== 'Single Family Residence') {
    throw new SfrValuationError(409, 'single_family_residence_required');
  }
  const address = stringValue(customFieldValue(fields, GHL_PROPERTY_ADDRESS_FIELD_ID)) ?? stringValue(opportunity.name);
  if (!address) throw new SfrValuationError(409, 'normalized_address_required');
  return { address, property_type: 'Single Family Residence', sqft: 0, year_built: null, beds: null, baths: null, stories: null, build_style: null };
}

async function subjectFromGhlOpportunity(admin: SupabaseClient, opportunityId: string, fetchImpl: typeof fetch): Promise<CashValueSubject> {
  const context = await resolveGhlContext(admin);
  const response = await fetchImpl(`${GHL_BASE}/opportunities/${encodeURIComponent(opportunityId)}`, {
    headers: { Authorization: `Bearer ${context.apiKey}`, Version: GHL_VERSION, Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 404) throw new SfrValuationError(404, 'ghl_opportunity_not_found');
  if (response.status === 401 || response.status === 403) throw new SfrValuationError(503, 'ghl_not_authorized');
  if (response.status === 429) throw new SfrValuationError(503, 'ghl_rate_limited');
  if (!response.ok) throw new SfrValuationError(502, 'ghl_request_failed');
  const payload = record(await response.json());
  const opportunity = record(payload.opportunity);
  if (stringValue(opportunity.id) !== opportunityId) throw new SfrValuationError(502, 'ghl_opportunity_mismatch');
  return subjectFromOpportunityRecord(opportunity);
}

function applySubjectEvidence(subject: CashValueSubject, evidence: PublicSubjectEvidence | null): CashValueSubject {
  if (!evidence) return subject;
  return mergeSubject(subject, {
    sqft: numberValue(evidence.sqft) ?? undefined,
    year_built: numberValue(evidence.year_built),
    beds: numberValue(evidence.beds),
    baths: numberValue(evidence.baths),
    stories: numberValue(evidence.stories),
    build_style: stringValue(evidence.build_style),
  });
}

function normalizeDealMachineComp(comp: DealMachineCompFacts): CashValueComp {
  return {
    id: comp.id,
    address: comp.address,
    property_type: mapDealMachinePropertyType(comp.property_type),
    sqft: comp.sqft,
    year_built: comp.year_built,
    beds: comp.beds,
    baths: comp.baths,
    stories: comp.stories,
    build_style: comp.build_style,
    condition: comp.condition,
    sale_price: comp.sale_price,
    sale_date: comp.sale_date,
    distance_miles: comp.distance_miles,
    source: 'dealmachine_comps',
  };
}

export async function fetchRentCastValuation(
  apiKey: string,
  subject: CashValueSubject,
  fetchImpl: typeof fetch = fetch,
): Promise<{
  subject: Partial<CashValueSubject>;
  comps: CashValueComp[];
  avm: number | null;
  avmRange: { low: number; high: number } | null;
}> {
  if (!subject.address) throw new SfrValuationError(409, 'normalized_address_required');
  const subjectRecord = await rentCastJson(
    `${RENTCAST_BASE}/properties?${new URLSearchParams({ address: subject.address, limit: '1' }).toString()}`,
    apiKey,
    fetchImpl,
  );
  const subjectRow = Array.isArray(subjectRecord) ? record(subjectRecord[0]) : record(subjectRecord);
  const resolvedSubject: Partial<CashValueSubject> = {
    sqft: numberValue(subjectRow.squareFootage) ?? subject.sqft,
    year_built: numberValue(subjectRow.yearBuilt) ?? subject.year_built,
    beds: numberValue(subjectRow.bedrooms) ?? subject.beds,
    baths: numberValue(subjectRow.bathrooms) ?? subject.baths,
    stories: numberValue(record(subjectRow.features).floorCount) ?? subject.stories,
    build_style: stringValue(record(subjectRow.features).architectureType) ?? subject.build_style,
  };
  const sqft = Number(resolvedSubject.sqft ?? 0);
  if (!(sqft > 0)) throw new SfrValuationError(409, 'subject_sqft_required');
  const yearBuilt = numberValue(resolvedSubject.year_built);
  const beds = numberValue(resolvedSubject.beds);
  const baths = numberValue(resolvedSubject.baths);
  const subjectLat = numberValue(subjectRow.latitude);
  const subjectLng = numberValue(subjectRow.longitude);
  const subjectId = stringValue(subjectRow.id);

  const standardParams = rentCastCompParams(subject.address, sqft, yearBuilt, beds, baths, 180, 10);
  const standardRaw = await rentCastJson(`${RENTCAST_BASE}/properties?${standardParams.toString()}`, apiKey, fetchImpl);
  let comps = normalizeRentCastComps(standardRaw, subject, subjectId, subjectLat, subjectLng);
  if (comps.length < MINIMUM_COMPS) {
    const expandedParams = rentCastCompParams(subject.address, sqft, yearBuilt, beds, baths, 365, 20);
    const expandedRaw = await rentCastJson(`${RENTCAST_BASE}/properties?${expandedParams.toString()}`, apiKey, fetchImpl);
    comps = dedupeComps([...comps, ...normalizeRentCastComps(expandedRaw, subject, subjectId, subjectLat, subjectLng)]);
  }

  let avm: number | null = null;
  let avmRange: { low: number; high: number } | null = null;
  try {
    const avmParams = new URLSearchParams({
      address: subject.address,
      propertyType: 'Single Family',
      squareFootage: String(Math.round(sqft)),
      maxRadius: '1',
      daysOld: '365',
      compCount: '20',
      lookupSubjectAttributes: 'true',
    });
    if (beds !== null) avmParams.set('bedrooms', String(beds));
    if (baths !== null) avmParams.set('bathrooms', String(baths));
    const avmRaw = record(await rentCastJson(`${RENTCAST_BASE}/avm/value?${avmParams.toString()}`, apiKey, fetchImpl));
    avm = numberValue(avmRaw.price);
    const low = numberValue(avmRaw.priceRangeLow);
    const high = numberValue(avmRaw.priceRangeHigh);
    if (low !== null && high !== null) avmRange = { low, high };
  } catch {
    // AVM is supporting evidence only and never replaces sold comps.
  }
  return { subject: resolvedSubject, comps, avm, avmRange };
}

function rentCastCompParams(
  address: string,
  sqft: number,
  yearBuilt: number | null,
  beds: number | null,
  baths: number | null,
  saleDateRange: number,
  yearTolerance: number,
): URLSearchParams {
  const params = new URLSearchParams({
    address,
    radius: '1',
    propertyType: 'Single Family',
    squareFootage: `${Math.max(1, Math.round(sqft - 250))}:${Math.round(sqft + 250)}`,
    saleDateRange: String(saleDateRange),
    limit: String(MAX_SOURCE_RECORDS),
  });
  if (yearBuilt !== null) params.set('yearBuilt', `${Math.max(1600, Math.round(yearBuilt - yearTolerance))}:${Math.round(yearBuilt + yearTolerance)}`);
  if (beds !== null) params.set('bedrooms', `${Math.max(0, beds - 1)}:${beds + 1}`);
  if (baths !== null) params.set('bathrooms', `${Math.max(0, baths - 1)}:${baths + 1}`);
  return params;
}

function normalizeRentCastComps(
  raw: unknown,
  subject: CashValueSubject,
  subjectId: string | null,
  subjectLat: number | null,
  subjectLng: number | null,
): CashValueComp[] {
  const rows = Array.isArray(raw) ? raw : [];
  const comps: CashValueComp[] = [];
  for (const rawRow of rows) {
    const row = record(rawRow);
    const id = stringValue(row.id);
    const address = stringValue(row.formattedAddress);
    const salePrice = numberValue(row.lastSalePrice);
    const saleDate = stringValue(row.lastSaleDate);
    const squareFootage = numberValue(row.squareFootage);
    if (!address || salePrice === null || !saleDate || squareFootage === null || squareFootage <= 0) continue;
    if ((subjectId && id === subjectId) || address.toLowerCase() === String(subject.address ?? '').toLowerCase()) continue;
    const lat = numberValue(row.latitude);
    const lng = numberValue(row.longitude);
    const distance = subjectLat !== null && subjectLng !== null && lat !== null && lng !== null
      ? haversineMiles(subjectLat, subjectLng, lat, lng)
      : null;
    if (distance === null || distance > 1) continue;
    comps.push({
      id,
      address,
      property_type: mapRentCastPropertyType(stringValue(row.propertyType)),
      sqft: squareFootage,
      year_built: numberValue(row.yearBuilt),
      beds: numberValue(row.bedrooms),
      baths: numberValue(row.bathrooms),
      stories: numberValue(record(row.features).floorCount),
      build_style: stringValue(record(row.features).architectureType),
      condition: null,
      sale_price: salePrice,
      sale_date: saleDate.slice(0, 10),
      distance_miles: Math.round(distance * 100) / 100,
      source: 'rentcast_property_record',
    });
  }
  return comps;
}

function dedupeComps(comps: CashValueComp[]): CashValueComp[] {
  const seen = new Set<string>();
  const out: CashValueComp[] = [];
  for (const comp of comps) {
    const key = (comp.id || comp.address).trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(comp);
  }
  return out;
}

async function rentCastJson(url: string, apiKey: string, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 401 || response.status === 403) throw new SfrValuationError(503, 'rentcast_auth_failed');
  if (response.status === 429) throw new SfrValuationError(503, 'rentcast_rate_limited');
  if (!response.ok) throw new SfrValuationError(502, 'rentcast_request_failed');
  return response.json();
}

function customFieldValue(fields: Record<string, unknown>[], fieldId: string): unknown {
  const field = fields.find((item) => stringValue(item.id) === fieldId);
  if (!field) return null;
  for (const key of ['fieldValue', 'fieldValueString', 'fieldValueNumber', 'fieldValueDate', 'fieldValueArray', 'value']) {
    if (field[key] !== undefined && field[key] !== null) return field[key];
  }
  return null;
}

function mergeSubject(base: CashValueSubject, patch: Partial<CashValueSubject>): CashValueSubject {
  return {
    ...base,
    ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== null && value !== undefined && value !== 0 && value !== '')),
  } as CashValueSubject;
}

function mapDealMachinePropertyType(value: string | null): string {
  if (!value) return 'Single Family Residence';
  const normalized = normalizePropertyType(value);
  return normalized ?? value;
}

function mapRentCastPropertyType(value: string | null): string {
  return value === 'Single Family' ? 'Single Family Residence' : value ?? '';
}

function first(recordValue: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (recordValue[key] !== undefined && recordValue[key] !== null && recordValue[key] !== '') return recordValue[key];
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

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value) && value.length) return numberValue(value[0]);
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value.replace(/[$,%\s,]/g, '')))) {
    return Number(value.replace(/[$,%\s,]/g, ''));
  }
  return null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radius = 3958.7613;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
