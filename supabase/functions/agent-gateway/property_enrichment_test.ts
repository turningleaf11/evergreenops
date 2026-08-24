import {
  DEALMACHINE_PROPERTY_FIELDS,
  fetchDealMachinePropertyEnrichment,
} from '../_shared/dealmachine_enrichment.ts';
import { buildOpportunityCustomFields, deriveRoute } from './intake.ts';
import { formatDealMachinePropertyDetails, type PropertyEnrichmentResult } from './property_enrichment.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}
function assertEquals(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`);
}

Deno.test('DealMachine lead enrichment requests property-only fields and strips unrequested people data', async () => {
  let capturedBody: Record<string, unknown> = {};
  let capturedAuthorization: string | null = null;
  const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    capturedAuthorization = new Headers(init?.headers).get('authorization');
    return new Response(JSON.stringify({
      data: [{
        input: { full_address: '2627 NW 25th Ave, Miami, FL 33142' },
        matched: true,
        dm_property_id: 'dm-property-1',
        full_address: '2627 NW 25th Ave, Miami, FL 33142',
        property_type: 'Single Family Residence',
        num_bedrooms: 3,
        num_bathrooms: 2,
        living_area_sqft: 1432,
        year_built: 1952,
        estimated_value: 485000,
        tax_amount: 4120,
        flood_zone: 'X',
        owner_name: 'MUST NOT SURVIVE SANITIZATION',
      }],
      totals: { submitted: 1, matched: 1, unmatched: 0 },
      credits: { used: 1, properties: 1, people: 0, deduplicated: 0 },
    }), { headers: { 'X-Request-Id': 'dm-request-123' } });
  };

  const result = await fetchDealMachinePropertyEnrichment(
    'dm_sk_test_secret',
    '2627 NW 25th Ave, Miami, FL 33142',
    fetchImpl as typeof fetch,
  );

  assertEquals(capturedAuthorization, 'Bearer dm_sk_test_secret');
  assertEquals(capturedBody.contact_audience, 'none');
  assertEquals(capturedBody.data, [{ full_address: '2627 NW 25th Ave, Miami, FL 33142' }]);
  assertEquals(capturedBody.fields, [...DEALMACHINE_PROPERTY_FIELDS]);
  assert(!DEALMACHINE_PROPERTY_FIELDS.some((field) => /owner|email|phone|contact|person/i.test(field)));
  assertEquals(result.dm_property_id, 'dm-property-1');
  assertEquals(result.request_id, 'dm-request-123');
  assertEquals(result.credits.people, 0);
  assertEquals(result.facts.num_bedrooms, 3);
  assertEquals(result.facts.tax_amount, 4120);
  assert(!('owner_name' in result.facts));
});

Deno.test('DealMachine CRM detail formatter omits unknown HOA mortgage tax and lien conclusions', () => {
  const details = formatDealMachinePropertyDetails({
    property_type: 'Single Family Residence',
    num_bedrooms: 3,
    num_bathrooms: 2,
    living_area_sqft: 1432,
    estimated_value: 485000,
    flood_zone: 'X',
  });
  assert(details?.includes('DealMachine Property Data (provider-sourced):'));
  assert(details?.includes('Estimated Value: $485,000'));
  assert(details?.includes('Flood Zone: X'));
  assert(!details?.includes('HOA'));
  assert(!details?.includes('Mortgage'));
  assert(!details?.includes('Tax'));
  assert(!details?.includes('Liens'));
  assert(!details?.includes('No HOA'));
});

Deno.test('CRM enrichment appends DealMachine facts without overwriting source-claimed dedicated fields', () => {
  const enrichment: PropertyEnrichmentResult = {
    status: 'fetched',
    provider: 'dealmachine',
    snapshot_id: 'snapshot-1',
    provider_property_id: 'dm-property-1',
    fetched_at: '2026-08-24T17:55:00.000Z',
    facts: {
      property_type: 'Single Family Residence',
      num_bedrooms: 3,
      num_bathrooms: 2,
      living_area_sqft: 1432,
      hoa_1_fee_amount: 175,
      total_estimated_loan_balance: 221000,
      tax_amount: 4120,
    },
    credits_used: 1,
    error_code: null,
  };
  const route = deriveRoute({ property_type: 'SFR' });
  const fields = buildOpportunityCustomFields({
    extracted_facts: {
      property_type: 'SFR',
      hoa: 'Seller says no HOA',
      mortgage_balance: 250000,
      bedrooms: 3,
    },
    evidence: {},
  }, '2627 NW 25th Ave, Miami, FL 33142', route, enrichment);

  const byId = new Map(fields.map((field) => [String(field.id), field.fieldValue]));
  assertEquals(byId.get('PR32yVuxmSeYGiAbaCkv'), 'Seller says no HOA');
  assertEquals(byId.get('WfVQ5inw4CoaFYQ5PsAW'), '250000');
  const details = String(byId.get('01yCBq5RVjHvCuAFCFVY') ?? '');
  assert(details.includes('Bedrooms: 3'));
  assert(details.includes('DealMachine Property Data (provider-sourced):'));
  assert(details.includes('HOA Fee: $175'));
  assert(details.includes('Estimated Loan Balance: $221,000'));
  assert(details.includes('Annual Property Tax: $4,120'));
});
