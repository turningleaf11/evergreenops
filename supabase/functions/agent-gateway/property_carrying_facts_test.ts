import {
  extractCandidateCarryingFacts,
  extractRentCastCarryingFacts,
} from './property_carrying_facts.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`);
}

Deno.test('RentCast carrying facts use latest annual property tax and monthly HOA', () => {
  const result = extractRentCastCarryingFacts({
    propertyTaxes: {
      '2023': { year: 2023, total: 5400 },
      '2025': { year: 2025, total: 6600 },
      '2024': { year: 2024, total: 6000 },
    },
    hoa: { fee: 175 },
  });

  assertEquals(result.property_taxes.monthly, 550);
  assertEquals(result.property_taxes.annual, 6600);
  assertEquals(result.property_taxes.as_of_year, 2025);
  assertEquals(result.property_taxes.evidence_class, 'verified_public_record');
  assertEquals(result.hoa.monthly, 175);
  assertEquals(result.hoa.evidence_class, 'verified_public_record');
});

Deno.test('missing RentCast tax or HOA fields remain unknown instead of becoming zero', () => {
  const result = extractRentCastCarryingFacts({});
  assertEquals(result.property_taxes.monthly, null);
  assertEquals(result.property_taxes.evidence_class, 'unknown');
  assertEquals(result.hoa.monthly, null);
  assertEquals(result.hoa.evidence_class, 'unknown');
});

Deno.test('candidate no-HOA fact becomes explicit zero but boolean true without fee stays unknown', () => {
  const none = extractCandidateCarryingFacts({ hoa: false });
  assertEquals(none.hoa.monthly, 0);
  assertEquals(none.hoa.evidence_class, 'verified_none');

  const unknown = extractCandidateCarryingFacts({ hoa: true });
  assertEquals(unknown.hoa.monthly, null);
  assertEquals(unknown.hoa.evidence_class, 'unknown');
});

Deno.test('boolean tax and insurance values stay unknown instead of coercing to money', () => {
  const result = extractCandidateCarryingFacts({
    property_taxes_annual: true,
    insurance_monthly: false,
  });
  assertEquals(result.property_taxes.monthly, null);
  assertEquals(result.property_taxes.evidence_class, 'unknown');
  assertEquals(result.insurance.monthly, null);
  assertEquals(result.insurance.evidence_class, 'unknown');
});

Deno.test('candidate annual tax and insurance claims are normalized monthly and remain source claims', () => {
  const result = extractCandidateCarryingFacts({
    property_taxes_annual: 7200,
    insurance_annual: 4800,
  });
  assertEquals(result.property_taxes.monthly, 600);
  assertEquals(result.property_taxes.evidence_class, 'source_claim');
  assertEquals(result.insurance.monthly, 400);
  assertEquals(result.insurance.evidence_class, 'source_claim');
  assert(result.insurance.source_ref?.includes('insurance'));
});
