import {
  buildDealCheckAddUrl,
  mergeDealCheckLocation,
  parseNormalizedUsAddress,
  prepareDealCheckHandoff,
  type DealCheckFlipScenario,
} from './dealcheck.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`);
}

const standard: DealCheckFlipScenario = {
  purchase_price: 275000,
  rehab_total: 50000,
  hold_months: 6,
  monthly_carrying_costs: { total: 1500 },
  acquisition_closing_costs: 5500,
  sale_price: 500000,
  sale_costs: 35000,
  total_project_cost: 339500,
  net_profit: 125500,
  return_on_cost_pct: 36.97,
  profit_margin_on_sale_pct: 25.1,
  break_even_sale_price: 365053.76,
  requires_human_approval: false,
};

const stretch: DealCheckFlipScenario = {
  ...standard,
  purchase_price: 290000,
  acquisition_closing_costs: 5800,
  total_project_cost: 354800,
  net_profit: 110200,
  return_on_cost_pct: 31.06,
  profit_margin_on_sale_pct: 22.04,
  break_even_sale_price: 381505.38,
  requires_human_approval: true,
};

Deno.test('DealCheck handoff prepares only the standard scenario and never claims sync', () => {
  const result = prepareDealCheckHandoff({
    location: { street: '9510 Ashley Dr', city: 'Miramar', state: 'FL', zip: '33025' },
    standard,
    stretch,
  });

  assertEquals(result.status, 'prepared_not_synced');
  assertEquals(result.primary_scenario, 'standard_mao');
  assert(result.launch_url?.includes('street=9510+Ashley+Dr'));
  assert(result.launch_url?.includes('strategy=flip'));
  assertEquals(result.entry_packet, {
    purchase_price: 275000,
    after_repair_value: 500000,
    rehab_costs: 50000,
    purchase_costs_pct: 2,
    holding_period_months: 6,
    holding_costs_monthly: 1500,
    selling_costs_pct: 7,
    financing_enabled: false,
  });
  assertEquals(result.external_record, {
    record_id: null,
    record_url: null,
    sync_status: 'not_synced',
    readback_status: 'not_performed',
  });
  assertEquals(result.stretch_reference?.requires_human_approval, true);
});

Deno.test('official dynamic link contains only supported address and strategy fields', () => {
  const url = new URL(buildDealCheckAddUrl({
    street: '825 Edgewood Dr',
    city: 'Lake Saint Louis',
    state: 'MO',
    zip: '63367',
  }));
  assertEquals(url.origin + url.pathname, 'https://dealcheck.io/add/p');
  assertEquals(url.searchParams.get('street'), '825 Edgewood Dr');
  assertEquals(url.searchParams.get('city'), 'Lake Saint Louis');
  assertEquals(url.searchParams.get('state'), 'MO');
  assertEquals(url.searchParams.get('zip'), '63367');
  assertEquals(url.searchParams.get('strategy'), 'flip');
  assertEquals([...url.searchParams.keys()].sort(), ['city', 'state', 'strategy', 'street', 'zip']);
});

Deno.test('normalized US address parser supports common street city state ZIP format', () => {
  assertEquals(parseNormalizedUsAddress('9510 Ashley Dr, Miramar, FL 33025'), {
    street: '9510 Ashley Dr',
    city: 'Miramar',
    state: 'FL',
    zip: '33025',
  });
});

Deno.test('source-backed candidate fields override parsed location pieces', () => {
  const parsed = parseNormalizedUsAddress('9510 Ashley Dr, Miramar, FL 33025');
  assertEquals(mergeDealCheckLocation(parsed, { city: 'Miramar', state: 'FL', zip: '33025' }), parsed);
});

Deno.test('DealCheck prep remains needs_info when address cannot be located', () => {
  const result = prepareDealCheckHandoff({
    location: { street: '9510 Ashley Dr', city: null, state: null, zip: null },
    standard,
    stretch,
  });
  assertEquals(result.status, 'needs_info');
  assertEquals(result.launch_url, null);
  assert(result.missing_fields.includes('zip_or_city_and_state'));
  assertEquals(result.external_record.readback_status, 'not_performed');
});

Deno.test('stretch scenario must retain explicit human approval boundary', () => {
  try {
    prepareDealCheckHandoff({
      location: { street: '9510 Ashley Dr', city: 'Miramar', state: 'FL', zip: '33025' },
      standard,
      stretch: { ...stretch, requires_human_approval: false },
    });
    throw new Error('Expected rejection');
  } catch (error) {
    assert(error instanceof Error);
    assert(error.message === 'stretch_human_approval_flag_required');
  }
});

Deno.test('standard scenario must never be mislabeled as stretch-approved', () => {
  try {
    prepareDealCheckHandoff({
      location: { street: '9510 Ashley Dr', city: 'Miramar', state: 'FL', zip: '33025' },
      standard: { ...standard, requires_human_approval: true },
      stretch,
    });
    throw new Error('Expected rejection');
  } catch (error) {
    assert(error instanceof Error);
    assert(error.message === 'standard_scenario_must_not_require_stretch_approval');
  }
});
