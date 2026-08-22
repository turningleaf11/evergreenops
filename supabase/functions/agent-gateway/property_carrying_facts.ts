import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';

const RENTCAST_BASE = 'https://api.rentcast.io/v1';

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
    rentcast: 'used' | 'not_configured' | 'failed';
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

export async function resolveSubjectCarryingFacts(
  admin: SupabaseClient,
  address: string,
  candidateFacts: Record<string, unknown> = {},
  fetchImpl: typeof fetch = fetch,
): Promise<SubjectCarryingFacts> {
  const candidate = extractCandidateCarryingFacts(candidateFacts);
  const rentcastKey = await resolveRentCastKey(admin);
  if (!rentcastKey) {
    return {
      ...candidate,
      provider: { rentcast: 'not_configured', error_code: null },
      notes: [
        'RentCast is not configured for property-specific carrying facts.',
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
    return {
      property_taxes: prefer(publicFacts.property_taxes, candidate.property_taxes),
      insurance: candidate.insurance,
      hoa: prefer(publicFacts.hoa, candidate.hoa),
      provider: { rentcast: 'used', error_code: null },
      notes: [
        'Property tax and HOA facts use RentCast public-record data when available; candidate source claims are retained only when public-record data is unavailable.',
        'Insurance is not supplied by RentCast property records and remains a deal-specific source/assumption input.',
      ],
    };
  } catch (error) {
    const code = error instanceof PropertyCarryingFactsError ? error.code : 'rentcast_carrying_facts_failed';
    return {
      ...candidate,
      provider: { rentcast: 'failed', error_code: code },
      notes: [
        `RentCast could not provide carrying facts (${code}).`,
        'No fallback property-tax, insurance, or HOA dollar amount was invented.',
      ],
    };
  }
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
  if (rawHoa === false || rawHoa === 'false' || rawHoa === 'No' || rawHoa === 'no') {
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

function nonNegativeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function integerValue(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
