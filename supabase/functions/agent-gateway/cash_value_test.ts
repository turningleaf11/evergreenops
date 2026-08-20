import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { calculateCashValue, normalizePropertyType, type CashValueComp, type CashValueSubject } from './cash_value.ts';

const valuationDate = new Date('2026-08-20T12:00:00Z');
const subject: CashValueSubject = {
  address: '9510 Ashley Dr, Miramar, FL 33025',
  property_type: 'Single Family Residence',
  sqft: 1700,
  year_built: 1990,
  beds: 3,
  baths: 2,
  stories: 1,
  build_style: 'ranch',
};

const standardComps: CashValueComp[] = [
  { address:'A',property_type:'Single Family Residence',sqft:1650,year_built:1992,beds:3,baths:2,stories:1,build_style:'ranch',condition:'renovated',sale_price:520000,sale_date:'2026-07-01',distance_miles:.20 },
  { address:'B',property_type:'SFR',sqft:1725,year_built:1988,beds:3,baths:2,stories:1,build_style:'ranch',condition:'retail',sale_price:525000,sale_date:'2026-06-15',distance_miles:.35 },
  { address:'C',property_type:'detached home',sqft:1800,year_built:1995,beds:4,baths:2,stories:1,build_style:'ranch',condition:'updated',sale_price:550000,sale_date:'2026-05-15',distance_miles:.50 },
  { address:'D',property_type:'single-family',sqft:1600,year_built:1985,beds:3,baths:2,stories:null,build_style:null,condition:'good',sale_price:500000,sale_date:'2026-04-01',distance_miles:.70 },
  { address:'E',property_type:'Single Family Residence',sqft:1750,year_built:1991,beds:3,baths:3,stories:2,build_style:'colonial',condition:'renovated',sale_price:540000,sale_date:'2026-03-10',distance_miles:.90 },
];

Deno.test('CashValue V1 selects up to five standard comps and averages implied subject values', () => {
  const result = calculateCashValue(subject, standardComps, valuationDate);
  assertEquals(result.status, 'valued');
  assertEquals(result.search_pass, 'standard');
  assertEquals(result.selected_comp_count, 5);
  assertEquals(result.cash_value, 526000);
  assertEquals(result.supported_range, { low: 517000, high: 536000 });
  assertEquals(result.confidence, 'high');
  assert(result.selected_comps.every((c) => c.property_type === 'Single Family Residence'));
  assert(result.notes.some((n) => n.includes('optional V1 ranking signals')));
});

Deno.test('stories and build style never reject an otherwise eligible comp', () => {
  const comps = standardComps.slice(0, 3).map((c, i) => ({ ...c, stories: i === 0 ? 2 : null, build_style: i === 0 ? 'two-story' : null }));
  const result = calculateCashValue(subject, comps, valuationDate);
  assertEquals(result.status, 'valued');
  assertEquals(result.selected_comp_count, 3);
});

Deno.test('hard V1 limits reject wrong type, over one mile, over 250 sqft, or bed/bath mismatch', () => {
  const bad: CashValueComp[] = [
    { ...standardComps[0], address:'wrong type', property_type:'Townhouse' },
    { ...standardComps[0], address:'too far', distance_miles:1.01 },
    { ...standardComps[0], address:'too large', sqft:1951 },
    { ...standardComps[0], address:'beds mismatch', beds:5 },
    { ...standardComps[0], address:'baths mismatch', baths:4 },
  ];
  const result = calculateCashValue(subject, bad, valuationDate);
  assertEquals(result.status, 'insufficient_comps');
  assertEquals(result.selected_comp_count, 0);
  assertEquals(result.cash_value, null);
  assertEquals(result.rejected_comp_count, 5);
  assert(result.rejected_comps.some((x) => x.reasons.includes('distance_over_1_mile')));
  assert(result.rejected_comps.some((x) => x.reasons.includes('sqft_difference_over_250')));
  assert(result.rejected_comps.some((x) => x.reasons.includes('property_type_mismatch')));
});

Deno.test('expanded pass keeps distance and sqft strict while extending recency and year built', () => {
  const comps: CashValueComp[] = [
    { ...standardComps[0], address:'old A', year_built:1975, sale_date:'2025-12-01' },
    { ...standardComps[1], address:'old B', year_built:2005, sale_date:'2025-11-15' },
    { ...standardComps[2], address:'old C', year_built:1972, sale_date:'2025-10-20' },
  ];
  const result = calculateCashValue(subject, comps, valuationDate);
  assertEquals(result.status, 'valued');
  assertEquals(result.search_pass, 'expanded');
  assertEquals(result.confidence === 'high', false);
  assert(result.notes[0].includes('recency expanded to 12 months'));
});

Deno.test('one or two defensible comps are still submitted with a low-confidence CashValue', () => {
  const result = calculateCashValue(subject, standardComps.slice(0, 2), valuationDate);
  assertEquals(result.status, 'thin_comp_set');
  assertEquals(result.selected_comp_count, 2);
  assertEquals(result.cash_value, 516000);
  assertEquals(result.supported_range, { low: 515000, high: 517000 });
  assertEquals(result.confidence, 'low');
  assert(result.selected_comps.length === 2);
  assert(result.notes.some((n) => n.includes('Cash must still submit')));
});

Deno.test('a single defensible comp is submitted rather than hidden', () => {
  const result = calculateCashValue(subject, standardComps.slice(0, 1), valuationDate);
  assertEquals(result.status, 'thin_comp_set');
  assertEquals(result.selected_comp_count, 1);
  assertEquals(result.cash_value, 536000);
  assertEquals(result.supported_range, { low: 536000, high: 536000 });
  assertEquals(result.confidence, 'low');
});

Deno.test('CashValue V1 only values Single Family Residence subjects', () => {
  const result = calculateCashValue({ ...subject, property_type:'Townhouse' }, standardComps, valuationDate);
  assertEquals(result.status, 'unsupported_subject');
  assertEquals(result.cash_value, null);
});

Deno.test('property type normalization reuses the canonical GHL Single Family Residence value', () => {
  assertEquals(normalizePropertyType('SFR'), 'Single Family Residence');
  assertEquals(normalizePropertyType('single-family home'), 'Single Family Residence');
  assertEquals(normalizePropertyType('Townhome'), 'Townhouse');
});
