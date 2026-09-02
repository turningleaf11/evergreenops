import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  CASH_SFR_PIPELINE_ID,
  CASH_SFR_UNDERWRITING_STAGE_ID,
  evaluateCashGhlOpportunity,
} from './cash_ghl_eligibility.ts';

const verifiedAt = '2026-09-02T18:30:00.000Z';

function opportunity(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'opp_123',
    name: '10470 SW 179th St, Miami, FL 33157',
    pipelineId: CASH_SFR_PIPELINE_ID,
    pipelineStageId: CASH_SFR_UNDERWRITING_STAGE_ID,
    status: 'open',
    source: 'FORM',
    lastStageChangeAt: '2026-09-02T17:00:00.000Z',
    customFields: [
      { id: '36WeaPwncmXLzUQhbGHd', fieldValue: 'Single Family Residence' },
      { id: 'hH02pevCKOTpmDYfOTnu', fieldValue: '10470 SW 179th St, Miami, FL 33157' },
      { id: 'hVo62cSBHESpSpJQ2QoX', fieldValue: '$468,000' },
      { id: 'mDmONnuCOpGGzdYTHodv', fieldValue: 'New Roof, New A/C' },
    ],
    ...overrides,
  };
}

Deno.test('live manual-GHL SFR with raw fieldValue is eligible', () => {
  const result = evaluateCashGhlOpportunity(opportunity(), verifiedAt);
  assertEquals(result.eligible, true);
  assertEquals(result.reason, null);
  assertEquals(result.snapshot.pipeline_id, CASH_SFR_PIPELINE_ID);
  assertEquals(result.snapshot.stage_id, CASH_SFR_UNDERWRITING_STAGE_ID);
  assertEquals(result.snapshot.status, 'open');
  assertEquals(result.snapshot.property_type, 'Single Family Residence');
  assertEquals(result.snapshot.address, '10470 SW 179th St, Miami, FL 33157');
  const fields = result.snapshot.fields as Record<string, unknown>;
  assertEquals(fields.asking_price, '$468,000');
  assertEquals(fields.condition, 'New Roof, New A/C');
});

Deno.test('dead or abandoned opportunity is never eligible', () => {
  const result = evaluateCashGhlOpportunity(opportunity({ status: 'abandoned' }), verifiedAt);
  assertEquals(result.eligible, false);
  assertEquals(result.reason, 'opportunity_not_open');
});

Deno.test('opportunity that left Underwriting is never eligible', () => {
  const result = evaluateCashGhlOpportunity(opportunity({ pipelineStageId: 'dead_stage' }), verifiedAt);
  assertEquals(result.eligible, false);
  assertEquals(result.reason, 'not_underwriting_stage');
});

Deno.test('manual GHL multifamily opportunity is never eligible', () => {
  const value = opportunity();
  value.customFields = [
    { id: '36WeaPwncmXLzUQhbGHd', fieldValue: 'Multi-family 2-4 Units' },
    { id: 'hH02pevCKOTpmDYfOTnu', fieldValue: '123 Duplex Ave' },
  ];
  const result = evaluateCashGhlOpportunity(value, verifiedAt);
  assertEquals(result.eligible, false);
  assertEquals(result.reason, 'not_single_family_residence');
});

Deno.test('typed HighLevel custom-field keys remain supported', () => {
  const value = opportunity();
  value.customFields = [
    { id: '36WeaPwncmXLzUQhbGHd', fieldValueString: 'Single Family Residence' },
    { id: 'hH02pevCKOTpmDYfOTnu', fieldValueString: '123 Main St' },
  ];
  const result = evaluateCashGhlOpportunity(value, verifiedAt);
  assertEquals(result.eligible, true);
  assertEquals(result.snapshot.address, '123 Main St');
});
