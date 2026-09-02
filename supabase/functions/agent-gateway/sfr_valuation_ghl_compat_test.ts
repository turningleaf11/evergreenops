import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  ghlOpportunityCompatFetch,
  normalizeGhlOpportunityRecord,
  subjectFromOpportunityRecord,
} from './sfr_valuation_ghl_compat.ts';

const live10470Shape = {
  id: 'zi5RRKWioTVioH0UckIB',
  name: '10470 SW 179th St, Miami, FL 33157',
  pipelineId: 'w3OtDJjCdN840Hwb1fpt',
  pipelineStageId: '56fb5ed0-6c4f-4963-a7d9-bb4e5e5919f1',
  status: 'abandoned',
  customFields: [
    { id: '36WeaPwncmXLzUQhbGHd', fieldValue: 'Single Family Residence' },
    { id: 'hH02pevCKOTpmDYfOTnu', fieldValue: '10470 SW 179th St, Miami, FL 33157' },
    { id: 'ZiBig9Dpp37wCsr2hL9G', fieldValue: ['NOT in a flood zone', 'NOT high crime'] },
  ],
};

Deno.test('normalizes HighLevel detail fieldValue keys without losing array fields', () => {
  const normalized = normalizeGhlOpportunityRecord(live10470Shape);
  const fields = normalized.customFields as Array<Record<string, unknown>>;
  assertEquals(fields[0].fieldValueString, 'Single Family Residence');
  assertEquals(fields[1].fieldValueString, '10470 SW 179th St, Miami, FL 33157');
  assertEquals(fields[2].fieldValueArray, ['NOT in a flood zone', 'NOT high crime']);
});

Deno.test('manual GHL SFR subject accepts the live opportunity-detail response shape', () => {
  const subject = subjectFromOpportunityRecord(live10470Shape);
  assertEquals(subject, {
    address: '10470 SW 179th St, Miami, FL 33157',
    property_type: 'Single Family Residence',
    sqft: 0,
    year_built: null,
    beds: null,
    baths: null,
    stories: null,
    build_style: null,
  });
});

Deno.test('compat fetch rewrites only opportunity JSON responses', async () => {
  const fakeFetch = (async () => new Response(JSON.stringify({
    opportunity: live10470Shape,
  }), { headers: { 'content-type': 'application/json' } })) as typeof fetch;
  const wrapped = ghlOpportunityCompatFetch(fakeFetch);

  const response = await wrapped('https://services.leadconnectorhq.com/opportunities/zi5RRKWioTVioH0UckIB');
  const payload = await response.json() as Record<string, unknown>;
  const opportunity = payload.opportunity as Record<string, unknown>;
  const fields = opportunity.customFields as Array<Record<string, unknown>>;
  assertEquals(fields[0].fieldValueString, 'Single Family Residence');
});
