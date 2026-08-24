import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';

const RENTCAST_BASE = 'https://api.rentcast.io/v1';
const SNAPSHOT_FRESHNESS_DAYS = 30;

export type CarryingEvidenceClass = 'verified_public_record' | 'source_claim' | 'verified_none' | 'unknown';

export interface CarryingFact {
  monthly: number | null;
  annual: number | null;
  evidence_class: CarryingEvidenceClass;
  source_ref: string | null;
  as_of_year: number | null;
}

export interface SubjectCarryingFacts {
  property_taxes: CarryingFact;
  insurance: CarryingFact;
  hoa: CarryingFact;
  provider: {
    dealmachine: 'used' | 'not_available';
    rentcast: 'used' | 'not_configured' | 'failed' | 'skipped_subject_facts_sufficient';
    error_code: string | null;
  };
  notes: string[];
}

export class PropertyCarryingFactsError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = 'PropertyCarryingFactsError';
  }
}

interface CarryingFactContext {
  workspaceId?: string | null;
  candidateId?: string | null;
}

interface DealMachineSnapshot {
  provider_property_id: string;
  facts: Record<string, unknown>;
  fetched_at: string;
}

export async function resolveSubjectCarryingFacts(
  admin: SupabaseClient,
  address: string,
  candidateFacts: Record<string, unknown> = {},
  fetchImpl: typeof fetch = fetch,
  context: CarryingFactContext = {},
): Promise<SubjectCarryingFacts> {
  const candidate = extractCandidateCarryingFacts(candidateFacts);
  const snapshot = await loadFreshDealMachineSnapshot(admin, context.workspaceId ?? null, context.candidateId ?? null);
  const dealMachine = snapshot
    ? extractDealMachineCarryingFacts(snapshot.facts, snapshot.provider_property_id)
    : { property_taxes: unknownFact(), hoa: unknownFact() };

  let propertyTaxes = prefer(dealMachine.property_taxes, candidate.property_taxes);
  let hoa = candidate.hoa;
  const notes: string[] = [];
  const dealMachineHoaAmount = snapshot ? nonNegativeNumber(snapshot.facts.hoa_1_fee_amount) : null;

  if (snapshot) {
    if (dealMachine.property_taxes.monthly !== null) {
      notes.push('Property taxes use the fresh DealMachine property snapshot when an annual tax amount is available.');
    } else {
      notes.push('The fresh DealMachine property snapshot did not contain a usable annual property-tax amount.');
    }
    if (dealMachineHoaAmount !== null) {
      notes.push('DealMachine reported an HOA fee amount, but the published property-field contract does not expose the payment cadence; Cash does not convert that amount into a monthly carrying cost without a documented cadence.');
    }
  }

  const subjectFactsSufficient = propertyTaxes.monthly !== null && hoa.monthly !== null;
  if (subjectFactsSufficient) {
    return {
      property_taxes: propertyTaxes,
      insurance: candidate.insurance,
      hoa,
      provider: {
        dealmachine: snapshot ? 'used' : 'not_available',
        rentcast: 'skipped_subject_facts_sufficient',
        error_code: null,
      },
      notes: [
        ...notes,
        'Property-specific tax and HOA facts were already available, so no RentCast fallback request was needed.',
        'Insurance remains a deal-specific source/assumption input; no provider-wide insurance default is substituted.',
      ],
    };
  }

  const rentcastKey = await resolveRentCastKey(admin);
  if (!rentcastKey) {
    return {
      property_taxes: propertyTaxes,
      insurance: candidate.insurance,
      hoa,
      provider: {
        dealmachine: snapshot ? 'used' : 'not_available',
        rentcast: 'not_configured',
        error_code: null,
      },
      notes: [
        ...notes,
        'RentCast is not configured for property-specific carrying-fact fallback.',
        'Property taxes, insurance, and HOA remain deal-specific inputs; no market-wide defaults are substituted.',
      ],
    };
  }

  try {
    const response = await fetchImpl(
      `${RENTCAST_BASE}/properties?${new URLSearchParams({ address, limit: '1' }).toString()}`,
      {
        headers: { Accept: 'application/json', 'X-Api-Key': rentcastKey },
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok) throw new PropertyCarryingFactsError(`rentcast_${response.status}`);
    const payload = await response.json();
    const row = Array.isArray(payload) ? record(payload[0]) : record(payload);
    if (!Object.keys(row).length) throw new PropertyCarryingFactsError('rentcast_property_not_found');
    const publicFacts = extractRentCastCarryingFacts(row);
    propertyTaxes = prefer(dealMachine.property_taxes, prefer(publicFacts.property_taxes, candidate.property_taxes));
    hoa = prefer(publicFacts.hoa, candidate.hoa);
    return {
      property_taxes: propertyTaxes,
      insurance: candidate.insurance,
      hoa,
      provider: {
        dealmachine: snapshot ? 'used' : 'not_available',
        rentcast: 'used',
        error_code: null,
      },
      notes: [
        ...notes,
        'DealMachine remains first for annual property tax when a fresh snapshot contains it; RentCast public-record tax is fallback only.',
        'RentCast HOA is used only when a monthly HOA fee is explicitly available; candidate source claims remain fallback evidence.',
        'Insurance is not supplied by these property records and remains a deal-specific source/assumption input.',
      ],
    };
  } catch (error) {
    const code = error instanceof PropertyCarryingFactsError ? error.code : 'rentcast_carrying_facts_failed';
    return {
      property_taxes: propertyTaxes,
      insurance: candidate.insurance,
      hoa,
      provider: {
        dealmachine: snapshot ? 'used' : 'not_available',
        rentcast: 'failed',
        error_code: code,
      },
      notes: [
        ...notes,
        `RentCast could not provide carrying facts (${code}).`,
        'No fallback property-tax, insurance, or HOA dollar amount was invented.',
      ],
    };
  }
}

export function extractDealMachineCarryingFacts(
  facts: Record<string, unknown>,
  providerPropertyId = 'unknown',
): Pick<SubjectCarryingFacts, 'property_taxes' | 'hoa'> {
  const annualTax = nonNegativeNumber(facts.tax_amount);
  const taxYear = integerValue(facts.tax_year);
  return {
    property_taxes: annualTax !== null
      ? {
          monthly: roundMoney(annualTax / 12),
          annual: annualTax,
          evidence_class: 'verified_public_record',
          source_ref: `dealmachine:${providerPropertyId}:tax_amount`,
          as_of_year: taxYear,
        }
      : unknownFact(),
    // The current DealMachine property-field documentation exposes hoa_1_fee_amount but does not
    // expose a payment-frequency field. Do not guess a monthly cadence from an unlabeled amount.
    hoa: unknownFact(),
  };
}

export function extractRentCastCarryingFacts(row: Record<string, unknown>): Pick<SubjectCarryingFacts, 'property_taxes' | 'hoa'> {
  const taxes = record(row.propertyTaxes);
  const latestTax = Object.entries(taxes)
    .map(([key, value]) => {
      const tax = record(value);
      const year = integerValue(tax.year) ?? integerValue(key);
      const total = nonNegativeNumber(tax.total);
      return year !== null && total !== null ? { year, total } : null;
    })
    .filter((value): value is { year: number; total: number } => value !== null)
    .sort((a, b) => b.year - a.year)[0] ?? null;

  const hoaRecord = record(row.hoa);
  const hoaFee = nonNegativeNumber(hoaRecord.fee);

  return {
    property_taxes: latestTax
      ? {
          monthly: roundMoney(latestTax.total / 12),
          annual: latestTax.total,
          evidence_class: 'verified_public_record',
          source_ref: 'rentcast:propertyTaxes',
          as_of_year: latestTax.year,
        }
      : unknownFact(),
    hoa: hoaFee !== null
      ? {
          monthly: hoaFee,
          annual: roundMoney(hoaFee * 12),
          evidence_class: hoaFee === 0 ? 'verified_none' : 'verified_public_record',
          source_ref: 'rentcast:hoa.fee',
          as_of_year: null,
        }
      : unknownFact(),
  };
}

export function extractCandidateCarryingFacts(facts: Record<string, unknown>): Pick<SubjectCarryingFacts, 'property_taxes' | 'insurance' | 'hoa'> {
  const annualTaxes = firstNumber(facts, ['property_taxes_annual', 'annual_property_taxes', 'property_taxes', 'annual_taxes']);
  const monthlyTaxes = firstNumber(facts, ['property_taxes_monthly', 'monthly_property_taxes']);
  const annualInsurance = firstNumber(facts, ['insurance_annual', 'annual_insurance', 'property_insurance_annual']);
  const monthlyInsurance = firstNumber(facts, ['insurance_monthly', 'monthly_insurance', 'property_insurance_monthly']);
  const rawHoa = first(facts, ['hoa_monthly', 'monthly_hoa', 'hoa']);

  const propertyTaxes = monthlyTaxes !== null || annualTaxes !== null
    ? sourceClaim(monthlyTaxes ?? roundMoney((annualTaxes as number) / 12), annualTaxes ?? roundMoney((monthlyTaxes as number) * 12), 'ema_candidate:property_taxes')
    : unknownFact();

  const insurance = monthlyInsurance !== null || annualInsurance !== null
    ? sourceClaim(monthlyInsurance ?? roundMoney((annualInsurance as number) / 12), annualInsurance ?? roundMoney((monthlyInsurance as number) * 12), 'ema_candidate:insurance')
    : unknownFact();

  let hoa = unknownFact();
  if (isExplicitNoHoa(rawHoa)) {
    hoa = {
      monthly: 0,
      annual: 0,
      evidence_class: 'verified_none',
      source_ref: 'ema_candidate:hoa',
      as_of_year: null,
    };
  } else {
    const hoaAmount = nonNegativeNumber(rawHoa);
    if (hoaAmount !== null) hoa = sourceClaim(hoaAmount, roundMoney(hoaAmount * 12), 'ema_candidate:hoa');
  }

  return { property_taxes: propertyTaxes, insurance, hoa };
}

async function loadFreshDealMachineSnapshot(
  admin: SupabaseClient,
  workspaceId: string | null,
  candidateId: string | null,
): Promise<DealMachineSnapshot | null> {
  if (!workspaceId || !candidateId) return null;
  const cutoff = new Date(Date.now() - SNAPSHOT_FRESHNESS_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from('property_enrichment_snapshots')
    .select('provider_property_id, facts, fetched_at')
    .eq('workspace_id', workspaceId)
    .eq('candidate_id', candidateId)
    .eq('provider', 'dealmachine')
    .gte('fetched_at', cutoff)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new PropertyCarryingFactsError('dealmachine_snapshot_lookup_failed');
  if (!data || typeof data.provider_property_id !== 'string' || !data.provider_property_id.trim()) return null;
  return {
    provider_property_id: data.provider_property_id.trim(),
    facts: record(data.facts),
    fetched_at: typeof data.fetched_at === 'string' ? data.fetched_at : '',
  };
}

async function resolveRentCastKey(admin: SupabaseClient): Promise<string | null> {
  const { data, error } = await admin
    .from('app_settings')
    .select('value')
    .eq('key', 'RENTCAST_API_KEY')
    .maybeSingle();
  if (error) throw new PropertyCarryingFactsError('rentcast_configuration_lookup_failed');
  const value = typeof data?.value === 'string' ? data.value.trim() : '';
  return value || Deno.env.get('RENTCAST_API_KEY')?.trim() || null;
}

function prefer(primary: CarryingFact, fallback: CarryingFact): CarryingFact {
  return primary.monthly !== null ? primary : fallback;
}

function sourceClaim(monthly: number, annual: number, sourceRef: string): CarryingFact {
  return {
    monthly: roundMoney(monthly),
    annual: roundMoney(annual),
    evidence_class: 'source_claim',
    source_ref: sourceRef,
    as_of_year: null,
  };
}

function unknownFact(): CarryingFact {
  return { monthly: null, annual: null, evidence_class: 'unknown', source_ref: null, as_of_year: null };
}

function isExplicitNoHoa(value: unknown): boolean {
  if (value === false) return true;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  return normalized === 'false' || normalized === 'no' || normalized === 'none' || normalized === 'no hoa' || normalized === 'no homeowners association';
}

function first(recordValue: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) if (recordValue[key] !== null && recordValue[key] !== undefined) return recordValue[key];
  return null;
}

function firstNumber(recordValue: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = nonNegativeNumber(recordValue[key]);
    if (value !== null) return value;
  }
  return null;
}

function numericValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

function nonNegativeNumber(value: unknown): number | null {
  const number = numericValue(value);
  return number !== null && number >= 0 ? number : null;
}

function integerValue(value: unknown): number | null {
  const number = numericValue(value);
  return number !== null && Number.isInteger(number) ? number : null;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
