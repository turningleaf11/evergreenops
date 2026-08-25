import {
  DealIntakeError,
  PROPERTY_TYPE_OPTIONS,
  buildDealDetails,
  deriveRoute,
  isEmaCrmIntakeEligible,
  looksLikeResolvedAddress,
} from './intake.ts';
import { getCachedCandidatePropertyEnrichment } from './property_enrichment.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`);
}

Deno.test('requires a resolved property address instead of subject-like text', () => {
  assert(looksLikeResolvedAddress('2627 NW 25th Ave, Miami, FL 33142'));
  assert(!looksLikeResolvedAddress('Miami SFR - 7777 Palm Ave'));
  assert(!looksLikeResolvedAddress('Broward County SFR - New Lead'));
  assert(!looksLikeResolvedAddress('Laundromat Business for Sale'));
});

Deno.test('uses only the acquisitions team Property Type dropdown options', () => {
  assertEquals(PROPERTY_TYPE_OPTIONS, [
    'Single Family Residence',
    'Multi-family 2-4 Units',
    'Multi-family 5+',
    'Townhouse',
    'Condo',
    'Mobile Home',
    'Mobile Home Park',
    'RV Park',
    'Land',
    'Commercial',
    'Portfolio',
    'Attached',
  ]);
});

Deno.test('routes SFR and 2-4 unit assets only to the SFR intake stage', () => {
  assertEquals(deriveRoute({ property_type: 'SFR' }), {
    propertyType: 'Single Family Residence',
    pipelineId: 'w3OtDJjCdN840Hwb1fpt',
    stageId: 'a4842558-034c-4ba7-acf3-ed000673f7d6',
  });
  assertEquals(deriveRoute({ property_type: 'Duplex', units: 2 }), {
    propertyType: 'Multi-family 2-4 Units',
    pipelineId: 'w3OtDJjCdN840Hwb1fpt',
    stageId: 'a4842558-034c-4ba7-acf3-ed000673f7d6',
  });
  assertEquals(deriveRoute({ property_type: 'Condo' }).propertyType, 'Condo');
  assertEquals(deriveRoute({ property_type: 'Manufactured Home' }).propertyType, 'Mobile Home');
});

Deno.test('routes portfolio assets only to the portfolio New Deal stage', () => {
  assertEquals(deriveRoute({ property_type: 'Multifamily', units: 24 }), {
    propertyType: 'Multi-family 5+',
    pipelineId: 'K6YsnZw6qhYLvXSvuixD',
    stageId: '4513320f-0972-4b4a-9e37-dee4d71e1843',
  });
  assertEquals(deriveRoute({ property_type: 'RV Park' }).propertyType, 'RV Park');
  assertEquals(deriveRoute({ property_type: 'Retail Strip Center' }).propertyType, 'Commercial');
  assertEquals(deriveRoute({ property_type: 'Vacant Land' }).propertyType, 'Land');
  assertEquals(deriveRoute({ property_type: 'Portfolio' }).propertyType, 'Portfolio');
});

Deno.test('refuses property types outside the fixed dropdown vocabulary', () => {
  try {
    deriveRoute({ property_type: 'Hotel' });
    throw new Error('Expected property type to be rejected');
  } catch (error) {
    assert(error instanceof DealIntakeError);
    assertEquals(error.code, 'property_type_unresolved');
  }
});

Deno.test('unmapped PDF facts and source discrepancies flow into Deal Details', () => {
  const details = buildDealDetails({
    property_type: 'SFR',
    asking_price: 325000,
    occupancy: 'Tenant',
    condition: 'Cosmetic refresh candidate',
    hoa: 'No HOA',
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1143,
    lot_size_sqft: 6400,
    year_built: 1941,
    tenant_rent_monthly: 3000,
    arv: 545000,
    arv_range_low: 540000,
    arv_range_high: 550000,
    email_asking_price: 315000,
    email_arv: 550000,
  }, {
    source_conflict: {
      asking_price: 'Email says $315,000; PDF says $325,000.',
    },
  });

  assert(details?.includes('Bedrooms: 3'));
  assert(details?.includes('Bathrooms: 2'));
  assert(details?.includes('Square Feet: 1,143'));
  assert(details?.includes('Lot Size: 6,400'));
  assert(details?.includes('Year Built: 1,941'));
  assert(details?.includes('Tenant Rent / Month: $3,000'));
  assert(details?.includes('Estimated ARV: $545,000'));
  assert(details?.includes('ARV Range: $540,000 - $550,000'));
  assert(details?.includes('Email Asking Price: $315,000'));
  assert(details?.includes('Source Discrepancies:'));
  assert(!details?.includes('Condition: Cosmetic refresh candidate'));
  assert(!details?.includes('Occupancy: Tenant'));
});

Deno.test('CRM intake defers DealMachine when no fresh snapshot already exists', async () => {
  const chain = {
    select() { return this; },
    eq() { return this; },
    gte() { return this; },
    order() { return this; },
    limit() { return this; },
    async maybeSingle() { return { data: null, error: null }; },
  };
  const admin = {
    from(table: string) {
      assertEquals(table, 'property_enrichment_snapshots');
      return chain;
    },
  } as never;

  const result = await getCachedCandidatePropertyEnrichment(
    admin,
    'workspace-1',
    'candidate-1',
  );

  assertEquals(result.status, 'skipped');
  assertEquals(result.error_code, 'dealmachine_deferred_until_underwriting');
  assertEquals(result.credits_used, 0);
  assertEquals(result.snapshot_id, null);
});

Deno.test('fit and needs-info Ema results may enter CRM initial review', () => {
  assert(isEmaCrmIntakeEligible('fit'));
  assert(isEmaCrmIntakeEligible('needs_info'));
  assert(!isEmaCrmIntakeEligible('not_fit'));
  assert(!isEmaCrmIntakeEligible('not_checked'));
});
