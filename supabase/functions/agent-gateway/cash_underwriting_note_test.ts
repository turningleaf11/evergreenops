import { formatCashUnderwritingNote } from './cash_underwriting_note.ts';

Deno.test('Cash underwriting note includes every selected sold comp and acquisition rehab', () => {
  const note = formatCashUnderwritingNote({
    cash_value: {
      subject: { address: '2627 NW 25th Ave, Miami, FL 33142' },
      comp_source: 'dealmachine',
      cash_value: {
        cash_value: 523000,
        confidence: 'low',
        supported_range: { low: 466000, high: 579000 },
        selected_comps: [
          {
            address: '2642 NW 24TH AVE',
            sale_price: 540000,
            sale_date: '2026-06-10',
            sqft: 1008,
            beds: 2,
            baths: 2,
            distance_miles: 0.1,
            price_per_sqft: 535.71,
            implied_subject_value: 579000,
          },
          {
            address: '2931 NW 26TH ST',
            sale_price: 410000,
            sale_date: '2026-04-20',
            sqft: 950,
            beds: 2,
            baths: 2,
            distance_miles: 0.31,
            price_per_sqft: 431.58,
            implied_subject_value: 466000,
          },
        ],
      },
    },
    rehab: {
      classification: {
        label: 'Light Rehab',
        rehab_class: 'light',
        confidence: 'low',
        basis: 'Cosmetic refresh candidate',
      },
      confidence: 'low',
      total: { low: 22000, base: 23760, high: 29700 },
      modeled_rehab: 23760,
      modeled_rehab_basis: 'base',
      known_adders: [],
    },
    mao: {
      standard_mao: 316190,
      stretch_ceiling: 331880,
    },
  });

  assertIncludes(note, 'CashValue: $523,000');
  assertIncludes(note, '2642 NW 24TH AVE');
  assertIncludes(note, 'Sold $540,000 on 2026-06-10');
  assertIncludes(note, 'Implied subject value: $579,000');
  assertIncludes(note, '2931 NW 26TH ST');
  assertIncludes(note, 'Light Rehab');
  assertIncludes(note, 'Modeled Rehab: $23,760');
  assertIncludes(note, 'Standard MAO: $316,190');
});

function assertIncludes(value: string, expected: string): void {
  if (!value.includes(expected)) throw new Error(`Expected note to include: ${expected}\n${value}`);
}
