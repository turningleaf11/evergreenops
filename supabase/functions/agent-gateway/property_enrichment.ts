import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { DealMachineError } from '../_shared/dealmachine.ts';
import {
  DEALMACHINE_PROPERTY_FIELDS,
  fetchDealMachinePropertyEnrichment,
} from '../_shared/dealmachine_enrichment.ts';

const CACHE_DAYS = 30;
const PROVIDER = 'dealmachine';

export type PropertyEnrichmentStatus = 'cached' | 'fetched' | 'not_configured' | 'failed';

export interface PropertyEnrichmentResult {
  status: PropertyEnrichmentStatus;
  provider: 'dealmachine';
  snapshot_id: string | null;
  provider_property_id: string | null;
  fetched_at: string | null;
  facts: Record<string, unknown>;
  credits_used: number;
  error_code: string | null;
}

interface SnapshotRow {
  id: string;
  provider_property_id: string;
  facts: Record<string, unknown>;
  credits_used: number;
  fetched_at: string;
}

export async function enrichCandidateProperty(
  admin: SupabaseClient,
  workspaceId: string,
  candidateId: string,
  address: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PropertyEnrichmentResult> {
  const cached = await loadFreshSnapshot(admin, workspaceId, candidateId);
  if (cached) return snapshotResult('cached', cached);

  const apiKey = resolveDealMachineApiKey();
  if (!apiKey) return emptyResult('not_configured', null);

  try {
    const enrichment = await fetchDealMachinePropertyEnrichment(apiKey, address, fetchImpl);
    if (enrichment.credits.people > 0) {
      return emptyResult('failed', 'dealmachine_unexpected_people_credits');
    }

    const fetchedAt = new Date().toISOString();
    const provenance = {
      source: 'dealmachine_v2_address_enrichment',
      request_id: enrichment.request_id,
      contact_audience: 'none',
      requested_fields: [...DEALMACHINE_PROPERTY_FIELDS],
      credits: {
        used: enrichment.credits.used,
        properties: enrichment.credits.properties,
        people: enrichment.credits.people,
        deduplicated: enrichment.credits.deduplicated,
      },
    };
    const { data, error } = await admin.from('property_enrichment_snapshots').insert({
      workspace_id: workspaceId,
      candidate_id: candidateId,
      provider: PROVIDER,
      provider_property_id: enrichment.dm_property_id,
      normalized_address: address.trim(),
      facts: enrichment.facts,
      provenance,
      credits_used: Math.max(0, Math.round(enrichment.credits.used)),
      fetched_at: fetchedAt,
    }).select('id, provider_property_id, facts, credits_used, fetched_at').single();
    if (error || !data) return emptyResult('failed', 'property_enrichment_persist_failed');
    return snapshotResult('fetched', data as SnapshotRow);
  } catch (error) {
    const code = error instanceof DealMachineError ? error.code : 'dealmachine_enrichment_failed';
    return emptyResult('failed', code);
  }
}

export async function linkPropertyEnrichmentOpportunity(
  admin: SupabaseClient,
  workspaceId: string,
  snapshotId: string | null,
  opportunityId: string,
): Promise<boolean> {
  if (!snapshotId) return false;
  const { error } = await admin.from('property_enrichment_snapshots').update({
    ghl_opportunity_id: opportunityId,
  }).eq('id', snapshotId).eq('workspace_id', workspaceId).eq('provider', PROVIDER);
  return !error;
}

async function loadFreshSnapshot(
  admin: SupabaseClient,
  workspaceId: string,
  candidateId: string,
): Promise<SnapshotRow | null> {
  const cutoff = new Date(Date.now() - CACHE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin.from('property_enrichment_snapshots')
    .select('id, provider_property_id, facts, credits_used, fetched_at')
    .eq('workspace_id', workspaceId)
    .eq('candidate_id', candidateId)
    .eq('provider', PROVIDER)
    .gte('fetched_at', cutoff)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as SnapshotRow;
}

function resolveDealMachineApiKey(): string | null {
  const edgeSecret = Deno.env.get('DEALMACHINE_API_KEY')?.trim() ?? '';
  return edgeSecret || null;
}

function snapshotResult(status: 'cached' | 'fetched', row: SnapshotRow): PropertyEnrichmentResult {
  return {
    status,
    provider: PROVIDER,
    snapshot_id: row.id,
    provider_property_id: row.provider_property_id,
    fetched_at: row.fetched_at,
    facts: record(row.facts),
    credits_used: Number.isFinite(Number(row.credits_used)) ? Number(row.credits_used) : 0,
    error_code: null,
  };
}

function emptyResult(status: 'not_configured' | 'failed', errorCode: string | null): PropertyEnrichmentResult {
  return {
    status,
    provider: PROVIDER,
    snapshot_id: null,
    provider_property_id: null,
    fetched_at: null,
    facts: {},
    credits_used: 0,
    error_code: errorCode,
  };
}

/**
 * Human-readable, source-labeled DealMachine facts for the existing HighLevel Deal Details field.
 * Missing fields are omitted. Missing HOA, lien, mortgage, flood, or tax data must never be converted to zero/none.
 */
export function formatDealMachinePropertyDetails(facts: Record<string, unknown>): string | null {
  const lines: string[] = [];
  const add = (label: string, key: string, formatter: (value: unknown) => string | null = textValue) => {
    const rendered = formatter(facts[key]);
    if (rendered !== null) lines.push(`${label}: ${rendered}`);
  };

  add('Property Type', 'property_type');
  add('Property Class', 'property_class');
  add('Bedrooms', 'num_bedrooms', numberText);
  add('Bathrooms', 'num_bathrooms', numberText);
  add('Living Area', 'living_area_sqft', squareFeet);
  add('Year Built', 'year_built', numberText);
  add('Stories', 'stories', numberText);
  add('Building Style', 'building_style');
  add('Construction', 'property_construction_type');
  add('Building Condition', 'building_condition');
  add('Building Quality', 'building_quality');
  add('Estimated Value', 'estimated_value', currency);
  add('Estimated Equity', 'estimated_equity_amount', currency);
  add('Estimated Equity %', 'estimated_equity_percentage', percent);
  add('Estimated Loan Balance', 'total_estimated_loan_balance', currency);
  add('Estimated LTV', 'estimated_loan_to_value_percentage', percent);
  add('Estimated Monthly Loan Payment', 'total_estimated_loan_payment_monthly', currency);
  add('Primary Mortgage Balance', 'mortgage_1_loan_balance', currency);
  add('Primary Mortgage Rate', 'mortgage_1_loan_interest_rate', percent);
  add('Primary Mortgage Type', 'mortgage_1_loan_type');
  add('Primary Financing Type', 'mortgage_1_financing_type');
  add('Primary Lender', 'mortgage_1_lender_name');
  add('Market Status', 'market_status');
  add('MLS Current Price', 'mls_current_listing_price', currency);
  add('MLS Days on Market', 'mls_days_on_market', numberText);
  add('Last Sale Price', 'last_sale_price', currency);
  add('Last Sale Date', 'last_sale_date');
  add('Annual Property Tax', 'tax_amount', currency);
  add('Tax Year', 'tax_year', numberText);
  add('Tax Delinquent Year', 'tax_delinquent_year', numberText);
  add('HOA Fee', 'hoa_1_fee_amount', currency);
  add('Active Liens', 'num_total_active_liens', numberText);
  add('Open Liens', 'num_total_open_liens', numberText);
  add('Preforeclosure Status', 'property_preforeclosure_status');
  add('Foreclosure Auction Date', 'foreclosure_auction_date');
  add('Foreclosure Past Due Amount', 'foreclosure_past_due_amount', currency);
  add('Flood Zone', 'flood_zone');
  add('Lot Size', 'lot_size_acres', acres);
  add('Zoning', 'zoning');
  add('Parcel / APN', 'parcel_number_raw');
  add('Subdivision', 'subdivision_name');
  add('Roof Type', 'roof_type');
  add('Roof Cover', 'roof_cover');
  add('Pool', 'pool');
  add('Garage', 'garage_type');
  add('Air Conditioning', 'air_conditioning');
  add('Heating', 'heating_type');
  add('Sewer', 'sewer');
  add('Water', 'water');

  if (!lines.length) return null;
  return ['DealMachine Property Data (provider-sourced):', ...lines].join('\n');
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textValue(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() ? value.trim().slice(0, 500) : null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return null;
}

function numeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value.replace(/[$,%\s,]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function numberText(value: unknown): string | null {
  const number = numeric(value);
  return number === null ? null : number.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function currency(value: unknown): string | null {
  const number = numeric(value);
  return number === null ? null : `$${Math.round(number).toLocaleString('en-US')}`;
}

function percent(value: unknown): string | null {
  const number = numeric(value);
  return number === null ? null : `${number.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

function squareFeet(value: unknown): string | null {
  const number = numeric(value);
  return number === null ? null : `${Math.round(number).toLocaleString('en-US')} sqft`;
}

function acres(value: unknown): string | null {
  const number = numeric(value);
  return number === null ? null : `${number.toLocaleString('en-US', { maximumFractionDigits: 3 })} acres`;
}
