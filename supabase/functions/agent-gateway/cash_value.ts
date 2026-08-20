export const CASH_VALUE_V1 = {
  propertyType: 'Single Family Residence',
  standard: { maxDistanceMiles: 1, maxSqftDifference: 250, maxYearDifference: 10, maxSaleAgeMonths: 6 },
  expanded: { maxDistanceMiles: 1, maxSqftDifference: 250, maxYearDifference: 20, maxSaleAgeMonths: 12 },
  minimumComps: 3,
  preferredComps: 5,
} as const;

export type CashValueConfidence = 'high' | 'medium' | 'low';
export type CashValueSearchPass = 'standard' | 'expanded' | 'insufficient';

export interface CashValueSubject {
  address?: string | null;
  property_type: string;
  sqft: number;
  year_built?: number | null;
  beds?: number | null;
  baths?: number | null;
  stories?: number | null;
  build_style?: string | null;
}

export interface CashValueComp {
  id?: string | null;
  address: string;
  property_type: string;
  sqft: number;
  year_built?: number | null;
  beds?: number | null;
  baths?: number | null;
  stories?: number | null;
  build_style?: string | null;
  condition?: string | null;
  sale_price: number;
  sale_date: string;
  distance_miles: number;
  source?: string | null;
}

export interface ScoredCashValueComp extends CashValueComp {
  score: number;
  implied_subject_value: number;
  price_per_sqft: number;
  sqft_difference: number;
  year_difference: number | null;
  sale_age_days: number;
  search_pass: 'standard' | 'expanded';
  score_breakdown: {
    distance: number;
    sqft: number;
    recency: number;
    year_built: number;
    beds_baths: number;
    condition_style: number;
  };
}

export interface CashValueResult {
  contract: 'cash_value_v1';
  status: 'valued' | 'insufficient_comps' | 'unsupported_subject';
  subject_property_type: string;
  search_pass: CashValueSearchPass;
  selected_comp_count: number;
  eligible_comp_count: number;
  rejected_comp_count: number;
  cash_value: number | null;
  supported_range: { low: number; high: number } | null;
  confidence: CashValueConfidence;
  average_comp_score: number | null;
  selected_comps: ScoredCashValueComp[];
  rejected_comps: Array<{ address: string; reasons: string[] }>;
  notes: string[];
}

export function calculateCashValue(
  subject: CashValueSubject,
  comps: CashValueComp[],
  valuationDate = new Date(),
): CashValueResult {
  const subjectType = normalizePropertyType(subject.property_type);
  if (subjectType !== CASH_VALUE_V1.propertyType) {
    return emptyResult('unsupported_subject', subjectType ?? subject.property_type, [
      'CashValue V1 currently supports Single Family Residence subjects only.',
    ]);
  }

  const standard: ScoredCashValueComp[] = [];
  const expandedOnly: ScoredCashValueComp[] = [];
  const rejected: Array<{ address: string; reasons: string[] }> = [];

  for (const comp of comps) {
    const baseReasons = hardRejectionReasons(subject, comp, valuationDate);
    if (baseReasons.length) {
      rejected.push({ address: comp.address, reasons: baseReasons });
      continue;
    }

    const standardReasons = passRejectionReasons(subject, comp, valuationDate, 'standard');
    if (!standardReasons.length) {
      standard.push(scoreComp(subject, comp, valuationDate, 'standard'));
      continue;
    }

    const expandedReasons = passRejectionReasons(subject, comp, valuationDate, 'expanded');
    if (!expandedReasons.length) {
      expandedOnly.push(scoreComp(subject, comp, valuationDate, 'expanded'));
      continue;
    }

    rejected.push({ address: comp.address, reasons: expandedReasons });
  }

  let searchPass: CashValueSearchPass = 'standard';
  let pool = standard;
  const notes: string[] = [];

  if (standard.length < CASH_VALUE_V1.minimumComps) {
    searchPass = 'expanded';
    pool = [...standard, ...expandedOnly];
    notes.push('Initial criteria produced fewer than 3 comps; recency expanded to 12 months and year-built tolerance expanded to ±20 years. Distance remains capped at 1 mile and sqft remains capped at ±250.');
  }

  if (pool.length < CASH_VALUE_V1.minimumComps) {
    return {
      contract: 'cash_value_v1',
      status: 'insufficient_comps',
      subject_property_type: subjectType,
      search_pass: 'insufficient',
      selected_comp_count: pool.length,
      eligible_comp_count: pool.length,
      rejected_comp_count: rejected.length,
      cash_value: null,
      supported_range: null,
      confidence: 'low',
      average_comp_score: pool.length ? round1(pool.reduce((s, c) => s + c.score, 0) / pool.length) : null,
      selected_comps: sortComps(pool).slice(0, CASH_VALUE_V1.preferredComps),
      rejected_comps: rejected,
      notes: [...notes, 'Fewer than 3 eligible comps remain. CashValue is intentionally withheld rather than manufacturing a valuation.'],
    };
  }

  const selected = sortComps(pool).slice(0, CASH_VALUE_V1.preferredComps);
  const impliedValues = selected.map((c) => c.implied_subject_value);
  const rawAverage = impliedValues.reduce((sum, value) => sum + value, 0) / impliedValues.length;
  const cashValue = roundToThousand(rawAverage);
  const low = roundToThousand(Math.min(...impliedValues));
  const high = roundToThousand(Math.max(...impliedValues));
  const averageScore = round1(selected.reduce((sum, c) => sum + c.score, 0) / selected.length);
  const spreadPct = cashValue > 0 ? (high - low) / cashValue : 1;
  const confidence = confidenceFor(searchPass, selected.length, averageScore, spreadPct);

  if (selected.length < CASH_VALUE_V1.preferredComps) notes.push(`CashValue used ${selected.length} comps; 5 are preferred when equally defensible sales are available.`);
  if (selected.some((c) => !known(c.stories))) notes.push('Story count was missing for one or more selected comps; stories/build style are optional V1 ranking signals, never hard filters.');
  notes.push('CashValue is the rounded average of each selected comp’s $/sqft-implied value for the subject, not an average of raw sale prices.');

  return {
    contract: 'cash_value_v1',
    status: 'valued',
    subject_property_type: subjectType,
    search_pass: searchPass,
    selected_comp_count: selected.length,
    eligible_comp_count: pool.length,
    rejected_comp_count: rejected.length,
    cash_value: cashValue,
    supported_range: { low, high },
    confidence,
    average_comp_score: averageScore,
    selected_comps: selected,
    rejected_comps: rejected,
    notes,
  };
}

export function normalizePropertyType(value: string): string | null {
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'single family residence' || /\bsfr\b|single[- ]?family|detached (home|house|residence)/.test(raw)) return 'Single Family Residence';
  if (/town\s*house|townhome/.test(raw)) return 'Townhouse';
  if (/\bcondo(minium)?\b/.test(raw)) return 'Condo';
  if (/duplex|triplex|fourplex|2\s*[-–]\s*4/.test(raw)) return 'Multi-family 2-4 Units';
  if (/mobile\s*home|manufactured\s*home/.test(raw)) return 'Mobile Home';
  return value.trim();
}

function hardRejectionReasons(subject: CashValueSubject, comp: CashValueComp, valuationDate: Date): string[] {
  const reasons: string[] = [];
  if (normalizePropertyType(comp.property_type) !== CASH_VALUE_V1.propertyType) reasons.push('property_type_mismatch');
  if (!(comp.sale_price > 0)) reasons.push('sale_price_invalid');
  if (!(comp.sqft > 0)) reasons.push('sqft_invalid');
  if (!(comp.distance_miles >= 0) || comp.distance_miles > CASH_VALUE_V1.standard.maxDistanceMiles) reasons.push('distance_over_1_mile');
  if (subject.sqft > 0 && comp.sqft > 0 && Math.abs(comp.sqft - subject.sqft) > CASH_VALUE_V1.standard.maxSqftDifference) reasons.push('sqft_difference_over_250');
  const saleDate = parseDate(comp.sale_date);
  if (!saleDate) reasons.push('sale_date_invalid');
  else if (saleDate.getTime() > valuationDate.getTime()) reasons.push('sale_date_in_future');
  if (known(subject.beds) && known(comp.beds) && Math.abs(Number(comp.beds) - Number(subject.beds)) > 1) reasons.push('bedroom_difference_over_1');
  if (known(subject.baths) && known(comp.baths) && Math.abs(Number(comp.baths) - Number(subject.baths)) > 1) reasons.push('bathroom_difference_over_1');
  return reasons;
}

function passRejectionReasons(subject: CashValueSubject, comp: CashValueComp, valuationDate: Date, pass: 'standard' | 'expanded'): string[] {
  const policy = CASH_VALUE_V1[pass];
  const reasons: string[] = [];
  const saleDate = parseDate(comp.sale_date)!;
  if (saleDate < subtractMonths(valuationDate, policy.maxSaleAgeMonths)) reasons.push(`sale_older_than_${policy.maxSaleAgeMonths}_months`);
  if (known(subject.year_built) && known(comp.year_built) && Math.abs(Number(comp.year_built) - Number(subject.year_built)) > policy.maxYearDifference) reasons.push(`year_built_difference_over_${policy.maxYearDifference}`);
  return reasons;
}

function scoreComp(subject: CashValueSubject, comp: CashValueComp, valuationDate: Date, pass: 'standard' | 'expanded'): ScoredCashValueComp {
  const sqftDifference = Math.abs(comp.sqft - subject.sqft);
  const yearDifference = known(subject.year_built) && known(comp.year_built) ? Math.abs(Number(comp.year_built) - Number(subject.year_built)) : null;
  const saleDate = parseDate(comp.sale_date)!;
  const saleAgeDays = Math.max(0, Math.floor((valuationDate.getTime() - saleDate.getTime()) / 86400000));
  const pricePerSqft = comp.sale_price / comp.sqft;
  const implied = pricePerSqft * subject.sqft;

  const scoreBreakdown = {
    distance: distanceScore(comp.distance_miles),
    sqft: sqftScore(sqftDifference),
    recency: recencyScore(saleAgeDays),
    year_built: yearScore(yearDifference),
    beds_baths: bedsBathsScore(subject, comp),
    condition_style: conditionStyleScore(subject, comp),
  };
  const score = Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0);

  return {
    ...comp,
    property_type: normalizePropertyType(comp.property_type) ?? comp.property_type,
    score,
    implied_subject_value: roundToThousand(implied),
    price_per_sqft: round2(pricePerSqft),
    sqft_difference: sqftDifference,
    year_difference: yearDifference,
    sale_age_days: saleAgeDays,
    search_pass: pass,
    score_breakdown: scoreBreakdown,
  };
}

function distanceScore(distance: number): number { if (distance <= .25) return 25; if (distance <= .5) return 22; if (distance <= .75) return 18; return 14; }
function sqftScore(diff: number): number { if (diff <= 50) return 25; if (diff <= 100) return 22; if (diff <= 150) return 19; if (diff <= 200) return 16; return 12; }
function recencyScore(days: number): number { if (days <= 60) return 20; if (days <= 90) return 18; if (days <= 120) return 16; if (days <= 183) return 13; if (days <= 274) return 10; return 6; }
function yearScore(diff: number | null): number { if (diff === null) return 7; if (diff <= 2) return 15; if (diff <= 5) return 12; if (diff <= 10) return 9; if (diff <= 15) return 6; return 3; }
function bedsBathsScore(subject: CashValueSubject, comp: CashValueComp): number {
  const bed = similarityScore(subject.beds, comp.beds);
  const bath = similarityScore(subject.baths, comp.baths);
  return bed + bath;
}
function similarityScore(subject: number | null | undefined, comp: number | null | undefined): number {
  if (!known(subject) || !known(comp)) return 2;
  const diff = Math.abs(Number(subject) - Number(comp));
  if (diff === 0) return 5;
  if (diff <= 1) return 3;
  return 0;
}
function conditionStyleScore(subject: CashValueSubject, comp: CashValueComp): number {
  let score = 0;
  const condition = (comp.condition ?? '').trim().toLowerCase();
  if (/renovat|remodel|retail|turnkey|excellent/.test(condition)) score += 3;
  else if (/good|updated/.test(condition)) score += 2;
  if (known(subject.stories) && known(comp.stories) && Number(subject.stories) === Number(comp.stories)) score += 1;
  if (subject.build_style && comp.build_style && subject.build_style.trim().toLowerCase() === comp.build_style.trim().toLowerCase()) score += 1;
  return score;
}
function confidenceFor(pass: CashValueSearchPass, count: number, averageScore: number, spreadPct: number): CashValueConfidence {
  if (count < CASH_VALUE_V1.minimumComps) return 'low';
  if (pass === 'standard' && averageScore >= 80 && spreadPct <= .10) return 'high';
  if (averageScore >= 65 && spreadPct <= .20) return 'medium';
  return 'low';
}
function sortComps(comps: ScoredCashValueComp[]): ScoredCashValueComp[] {
  return [...comps].sort((a, b) => b.score - a.score || a.distance_miles - b.distance_miles || a.sqft_difference - b.sqft_difference || a.sale_age_days - b.sale_age_days);
}
function subtractMonths(date: Date, months: number): Date { const result = new Date(date); result.setUTCMonth(result.getUTCMonth() - months); return result; }
function parseDate(value: string): Date | null { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; }
function known(value: unknown): boolean { return value !== null && value !== undefined && value !== ''; }
function roundToThousand(value: number): number { return Math.round(value / 1000) * 1000; }
function round1(value: number): number { return Math.round(value * 10) / 10; }
function round2(value: number): number { return Math.round(value * 100) / 100; }
function emptyResult(status: 'unsupported_subject', propertyType: string, notes: string[]): CashValueResult {
  return { contract:'cash_value_v1', status, subject_property_type:propertyType, search_pass:'insufficient', selected_comp_count:0, eligible_comp_count:0, rejected_comp_count:0, cash_value:null, supported_range:null, confidence:'low', average_comp_score:null, selected_comps:[], rejected_comps:[], notes };
}
