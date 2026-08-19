import {
  DealIntakeError,
  deriveRoute,
  isEmaCrmIntakeEligible,
  looksLikeResolvedAddress,
} from './intake.ts';

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

Deno.test('routes SFR and 2-4 unit assets only to the SFR intake stage', () => {
  assertEquals(deriveRoute({ property_type: 'SFR' }), {
    propertyType: 'SFR',
    pipelineId: 'w3OtDJjCdN840Hwb1fpt',
    stageId: 'a4842558-034c-4ba7-acf3-ed000673f7d6',
  });
  assertEquals(deriveRoute({ property_type: 'Duplex', units: 2 }), {
    propertyType: 'Multi-family 2-4',
    pipelineId: 'w3OtDJjCdN840Hwb1fpt',
    stageId: 'a4842558-034c-4ba7-acf3-ed000673f7d6',
  });
});

Deno.test('routes portfolio assets only to the portfolio New Deal stage', () => {
  assertEquals(deriveRoute({ property_type: 'Multifamily', units: 24 }), {
    propertyType: 'Multi-family 5+',
    pipelineId: 'K6YsnZw6qhYLvXSvuixD',
    stageId: '4513320f-0972-4b4a-9e37-dee4d71e1843',
  });
  assertEquals(deriveRoute({ property_type: 'RV Park' }), {
    propertyType: 'RV Park',
    pipelineId: 'K6YsnZw6qhYLvXSvuixD',
    stageId: '4513320f-0972-4b4a-9e37-dee4d71e1843',
  });
});

Deno.test('refuses unresolved property types', () => {
  try {
    deriveRoute({ property_type: 'Retail Strip Center' });
    throw new Error('Expected property type to be rejected');
  } catch (error) {
    assert(error instanceof DealIntakeError);
    assertEquals(error.code, 'property_type_unresolved');
  }
});

Deno.test('fit and needs-info Ema results may enter CRM initial review', () => {
  assert(isEmaCrmIntakeEligible('fit'));
  assert(isEmaCrmIntakeEligible('needs_info'));
  assert(!isEmaCrmIntakeEligible('not_fit'));
  assert(!isEmaCrmIntakeEligible('not_checked'));
});
