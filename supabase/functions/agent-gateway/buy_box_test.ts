import {
  BuyBoxFitError,
  classifyBuyBoxResult,
  deriveAssetClass,
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
