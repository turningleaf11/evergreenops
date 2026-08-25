import {
  BuyBoxFitError,
  classifyBuyBoxResult,
  deriveAssetClass,
  isCrmEligibleBuyBoxResult,
  isKnownStateOutsideAllowedGeographies,
  mergeMissingDealMachineFacts,
  mergeMissingPublicPropertyTypeFact,
  shouldCallDealMachineForScreen,
} from './buy_box.ts';

function assert(
  condition: unknown,
  message = 'Assertion failed',
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}

Deno.test('classifies source-backed SFR and portfolio property types', () => {
  assertEquals(deriveAssetClass({ property_type: 'SFR' }), 'fix_flip');
  assertEquals(
    deriveAssetClass({ property_type: 'Duplex', units: 2 }),
    'fix_flip',
  );
  assertEquals(
    deriveAssetClass({ property_type: 'Multifamily', units: 24 }),
    'multifamily',
  );
  assertEquals(deriveAssetClass({ property_type: 'RV Park' }), 'rv_park');
  assertEquals(
    deriveAssetClass({ property_type: 'Mobile Home Park' }),
    'mhp',
  );
});

Deno.test('routes known condo/manufactured residential types through fix-flip screen so they can be rejected cheaply', () => {
  assertEquals(deriveAssetClass({ property_type: 'Condo' }), 'fix_flip');
  assertEquals(deriveAssetClass({ property_type: 'Manufactured Home' }), 'fix_flip');
});

Deno.test('fills missing physical facts from DealMachine without overwriting source facts', () => {
  const merged = mergeMissingDealMachineFacts(
    {
      state: 'TX',
      asking_price: '$205,000',
      arv: '$350,000',
      bedrooms: 4,
    },
    {
      property_type: 'Single Family Residence',
      num_units: 1,
      num_bedrooms: 3,
      num_bathrooms: 2.5,
      living_area_sqft: 1816,
      year_built: 1982,
      estimated_value: 340000,
      hoa_1_fee_amount: 450,
    },
  );

  assertEquals(merged.facts.property_type, 'Single Family Residence');
  assertEquals(merged.facts.units, 1);
  assertEquals(merged.facts.bedrooms, 4);
  assertEquals(merged.facts.bathrooms, 2.5);
  assertEquals(merged.facts.sqft, 1816);
  assertEquals(merged.facts.year_built, 1982);
  assertEquals(merged.facts.arv, '$350,000');
  assertEquals(merged.facts.estimated_value, undefined);
  assertEquals(merged.facts.hoa, undefined);
  assertEquals(
    merged.filled_fields,
    ['property_type', 'units', 'bathrooms', 'sqft', 'year_built'],
  );
  assertEquals(deriveAssetClass(merged.facts), 'fix_flip');
});

Deno.test('free public record fills only missing property type and preserves source claims', () => {
  const merged = mergeMissingPublicPropertyTypeFact(
    { state: 'TX', asking_price: '$205,000', bedrooms: 4 },
    {
      status: 'resolved',
      provider: 'hcad_arcgis',
      property_type: 'Single Family Residence',
      matched_address: '3038 SKYPARK DR',
      parcel_id: '123',
      classification_code: 'A1',
      source_url: 'https://example.test',
      error_code: null,
    },
  );
  assertEquals(merged.facts.property_type, 'Single Family Residence');
  assertEquals(merged.facts.asking_price, '$205,000');
  assertEquals(merged.filled_fields, ['property_type']);
});

Deno.test('source property type wins over conflicting provider property type', () => {
  const merged = mergeMissingDealMachineFacts(
    { property_type: 'Condo', sqft: 1200 },
    { property_type: 'Single Family Residence', living_area_sqft: 1800 },
  );
  assertEquals(merged.facts.property_type, 'Condo');
  assertEquals(merged.facts.sqft, 1200);
  assertEquals(merged.filled_fields, []);
});

Deno.test('public property type also cannot overwrite source property type', () => {
  const merged = mergeMissingPublicPropertyTypeFact(
    { property_type: 'Condo' },
    {
      status: 'resolved',
      provider: 'bcpa_arcgis',
      property_type: 'Single Family Residence',
      matched_address: '1 OCEAN DR',
      parcel_id: '123',
      classification_code: '01',
      source_url: 'https://example.test',
      error_code: null,
    },
  );
  assertEquals(merged.facts.property_type, 'Condo');
  assertEquals(merged.filled_fields, []);
});

Deno.test('known out-of-state geography can fail without inventing a county', () => {
  const allowed = ['Miami-Dade, FL', 'Broward, FL'];
  assert(isKnownStateOutsideAllowedGeographies({ state: 'TX' }, allowed));
  assert(!isKnownStateOutsideAllowedGeographies({ state: 'FL' }, allowed));
  assert(!isKnownStateOutsideAllowedGeographies({}, allowed));
});

Deno.test('paid lookup is reserved for unresolved routing facts', () => {
  assert(shouldCallDealMachineForScreen({
    hard_failed_fields: [],
    hard_unknown_fields: ['property_type'],
  }));
  assert(shouldCallDealMachineForScreen({
    hard_failed_fields: [],
    hard_unknown_fields: ['is_condo'],
  }));
});

Deno.test('missing beds baths sqft or HOA do not justify DealMachine', () => {
  assert(!shouldCallDealMachineForScreen({
    hard_failed_fields: [],
    hard_unknown_fields: ['beds', 'baths', 'sqft', 'hoa'],
  }));
});

Deno.test('known hard failure stops paid enrichment even if another routing fact is unknown', () => {
  assert(!shouldCallDealMachineForScreen({
    hard_failed_fields: ['geography'],
    hard_unknown_fields: ['property_type'],
  }));
});

Deno.test('honors explicit deal strategy when present', () => {
  assertEquals(
    deriveAssetClass({ property_type: 'SFR', deal_type: 'Fix & Flip' }),
    'fix_flip',
  );
});

Deno.test('fails closed when asset class cannot be resolved', () => {
  try {
    deriveAssetClass({ property_type: 'Retail Strip Center' });
    throw new Error('Expected failure');
  } catch (error) {
    assert(error instanceof BuyBoxFitError);
    assertEquals(error.code, 'asset_class_unresolved');
  }
});

Deno.test('uncovered hard failure is not fit', () => {
  assertEquals(
    classifyBuyBoxResult({
      uncoveredHardFailureCount: 1,
      hardFailureCount: 1,
      hardUnknownCount: 0,
    }),
    'not_fit',
  );
});

Deno.test('hard failure with an exception path still requires information', () => {
  assertEquals(
    classifyBuyBoxResult({
      uncoveredHardFailureCount: 0,
      hardFailureCount: 1,
      hardUnknownCount: 0,
    }),
    'needs_info',
  );
});

Deno.test('unknown hard criterion blocks fit', () => {
  assertEquals(
    classifyBuyBoxResult({
      uncoveredHardFailureCount: 0,
      hardFailureCount: 0,
      hardUnknownCount: 1,
    }),
    'needs_info',
  );
});

Deno.test('no hard failure or hard unknown can qualify', () => {
  assertEquals(
    classifyBuyBoxResult({
      uncoveredHardFailureCount: 0,
      hardFailureCount: 0,
      hardUnknownCount: 0,
    }),
    'fit',
  );
});

Deno.test('fit and needs-info candidates are CRM eligible, not-fit is blocked', () => {
  assert(isCrmEligibleBuyBoxResult('fit'));
  assert(isCrmEligibleBuyBoxResult('needs_info'));
  assert(!isCrmEligibleBuyBoxResult('not_fit'));
  assert(!isCrmEligibleBuyBoxResult('not_checked'));
});
