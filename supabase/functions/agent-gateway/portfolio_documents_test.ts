import {
  isPortfolioAssetClass,
  summarizePortfolioDocuments,
} from './portfolio_documents.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

Deno.test('portfolio classes are multifamily, rv park, and mhp', () => {
  assert(isPortfolioAssetClass('multifamily'));
  assert(isPortfolioAssetClass('rv_park'));
  assert(isPortfolioAssetClass('mhp'));
  assert(!isPortfolioAssetClass('fix_flip'));
});

Deno.test('SFR document status is not applicable', () => {
  assertEquals(summarizePortfolioDocuments('fix_flip', {}), {
    status: 'not_applicable',
    required_documents: [],
    received_documents: [],
    missing_documents: [],
  });
});

Deno.test('portfolio inventory reports the four required document classes', () => {
  assertEquals(
    summarizePortfolioDocuments('multifamily', {
      om: { status: 'received' },
      pnl: true,
    }),
    {
      status: 'incomplete',
      required_documents: ['om', 'rent_roll', 't12', 'pnl'],
      received_documents: ['om', 'pnl'],
      missing_documents: ['rent_roll', 't12'],
    },
  );
});

Deno.test('portfolio inventory is complete only when all four documents are received', () => {
  assertEquals(
    summarizePortfolioDocuments('rv_park', {
      om: { status: 'received' },
      rent_roll: { status: 'received' },
      t12: { status: 'received' },
      pnl: { status: 'received' },
    }).status,
    'complete',
  );
});
