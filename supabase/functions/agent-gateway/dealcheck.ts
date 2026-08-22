export interface DealCheckLocation {
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

export interface DealCheckFlipScenario {
  purchase_price: number;
  rehab_total: number;
  hold_months: number;
  monthly_carrying_costs: { total: number };
  acquisition_closing_costs: number;
  sale_price: number;
  sale_costs: number;
  total_project_cost: number;
  net_profit: number;
  return_on_cost_pct: number;
  profit_margin_on_sale_pct: number;
  break_even_sale_price: number;
  requires_human_approval: boolean;
}

export interface DealCheckPrepInputs {
  location: DealCheckLocation;
  standard: DealCheckFlipScenario;
  stretch: DealCheckFlipScenario;
}

export interface DealCheckPrepResult {
  contract: 'dealcheck_prep_v1';
  status: 'prepared_not_synced' | 'needs_info';
  strategy: 'flip';
  primary_scenario: 'standard_mao';
  property: DealCheckLocation;
  launch_url: string | null;
  missing_fields: string[];
  entry_packet: {
    purchase_price: number;
    after_repair_value: number;
    rehab_costs: number;
    purchase_costs_pct: number;
    holding_period_months: number;
    holding_costs_monthly: number;
    selling_costs_pct: number;
    financing_enabled: false;
  } | null;
  cash_expected_metrics: {
    total_project_cost: number;
    net_profit: number;
    return_on_cost_pct: number;
    profit_margin_on_sale_pct: number;
    break_even_sale_price: number;
  } | null;
  stretch_reference: {
    purchase_price: number;
    requires_human_approval: true;
    expected_net_profit: number;
    expected_return_on_cost_pct: number;
  } | null;
  external_record: {
    record_id: null;
    record_url: null;
    sync_status: 'not_synced';
    readback_status: 'not_performed';
  };
  notes: string[];
}

export class DealCheckPrepError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = 'DealCheckPrepError';
  }
}

export function prepareDealCheckHandoff(inputs: DealCheckPrepInputs): DealCheckPrepResult {
  validateScenario(inputs.standard, false);
  validateScenario(inputs.stretch, true);
  if (inputs.stretch.purchase_price < inputs.standard.purchase_price) {
    throw new DealCheckPrepError('stretch_purchase_below_standard');
  }

  const location = normalizeLocation(inputs.location);
  const missing = missingLocationFields(location);
  const externalRecord: DealCheckPrepResult['external_record'] = {
    record_id: null,
    record_url: null,
    sync_status: 'not_synced',
    readback_status: 'not_performed',
  };

  if (missing.length > 0) {
    return {
      contract: 'dealcheck_prep_v1',
      status: 'needs_info',
      strategy: 'flip',
      primary_scenario: 'standard_mao',
      property: location,
      launch_url: null,
      missing_fields: missing,
      entry_packet: null,
      cash_expected_metrics: null,
      stretch_reference: null,
      external_record: externalRecord,
      notes: [
        'DealCheck handoff requires a street address plus either ZIP or city and state.',
        'No DealCheck validation has occurred.',
      ],
    };
  }

  const launchUrl = buildDealCheckAddUrl(location);
  const purchaseCostsPct = percentOf(
    inputs.standard.acquisition_closing_costs,
    inputs.standard.purchase_price,
  );
  const sellingCostsPct = percentOf(
    inputs.standard.sale_costs,
    inputs.standard.sale_price,
  );

  return {
    contract: 'dealcheck_prep_v1',
    status: 'prepared_not_synced',
    strategy: 'flip',
    primary_scenario: 'standard_mao',
    property: location,
    launch_url: launchUrl,
    missing_fields: [],
    entry_packet: {
      purchase_price: inputs.standard.purchase_price,
      after_repair_value: inputs.standard.sale_price,
      rehab_costs: inputs.standard.rehab_total,
      purchase_costs_pct: purchaseCostsPct,
      holding_period_months: inputs.standard.hold_months,
      holding_costs_monthly: inputs.standard.monthly_carrying_costs.total,
      selling_costs_pct: sellingCostsPct,
      financing_enabled: false,
    },
    cash_expected_metrics: {
      total_project_cost: inputs.standard.total_project_cost,
      net_profit: inputs.standard.net_profit,
      return_on_cost_pct: inputs.standard.return_on_cost_pct,
      profit_margin_on_sale_pct: inputs.standard.profit_margin_on_sale_pct,
      break_even_sale_price: inputs.standard.break_even_sale_price,
    },
    stretch_reference: {
      purchase_price: inputs.stretch.purchase_price,
      requires_human_approval: true,
      expected_net_profit: inputs.stretch.net_profit,
      expected_return_on_cost_pct: inputs.stretch.return_on_cost_pct,
    },
    external_record: externalRecord,
    notes: [
      'This packet prepares the standard Evergreen MAO scenario for DealCheck entry; it does not create a DealCheck property or claim validation.',
      'The dynamic DealCheck link can prefill only the property address and flip strategy. Economic fields remain an explicit entry/readback step.',
      'Cash remains authoritative until an actual DealCheck record is created and its analysis is read back for comparison.',
      'The 68% stretch scenario is included only as a human-review reference and is not the primary DealCheck scenario.',
    ],
  };
}

export function buildDealCheckAddUrl(location: DealCheckLocation): string {
  const normalized = normalizeLocation(location);
  const missing = missingLocationFields(normalized);
  if (missing.length > 0) throw new DealCheckPrepError('dealcheck_location_incomplete');

  const params = new URLSearchParams();
  params.set('street', normalized.street as string);
  if (normalized.city) params.set('city', normalized.city);
  if (normalized.state) params.set('state', normalized.state);
  if (normalized.zip) params.set('zip', normalized.zip);
  params.set('strategy', 'flip');
  return `https://dealcheck.io/add/p?${params.toString()}`;
}

export function parseNormalizedUsAddress(address: string | null): DealCheckLocation {
  const raw = address?.trim() ?? '';
  if (!raw) return { street: null, city: null, state: null, zip: null };
  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) return { street: raw, city: null, state: null, zip: null };

  const stateZip = parts[parts.length - 1];
  const match = stateZip.match(/^([A-Za-z]{2}|[A-Za-z][A-Za-z .'-]+?)\s+(\d{5}(?:-\d{4})?)$/);
  if (!match) {
    return {
      street: parts.slice(0, -2).join(', ') || null,
      city: parts[parts.length - 2] || null,
      state: stateZip || null,
      zip: null,
    };
  }

  return {
    street: parts.slice(0, -2).join(', ') || null,
    city: parts[parts.length - 2] || null,
    state: match[1].trim(),
    zip: match[2],
  };
}

export function mergeDealCheckLocation(
  parsed: DealCheckLocation,
  facts: Record<string, unknown>,
): DealCheckLocation {
  return normalizeLocation({
    street: stringValue(facts.street_address) ?? stringValue(facts.street) ?? parsed.street,
    city: stringValue(facts.city) ?? parsed.city,
    state: stringValue(facts.state) ?? parsed.state,
    zip: stringValue(facts.zip) ?? stringValue(facts.zip_code) ?? parsed.zip,
  });
}

function missingLocationFields(location: DealCheckLocation): string[] {
  const missing: string[] = [];
  if (!location.street) missing.push('street');
  if (!location.zip && !(location.city && location.state)) {
    missing.push('zip_or_city_and_state');
  }
  return missing;
}

function normalizeLocation(location: DealCheckLocation): DealCheckLocation {
  return {
    street: clean(location.street),
    city: clean(location.city),
    state: clean(location.state),
    zip: clean(location.zip),
  };
}

function validateScenario(scenario: DealCheckFlipScenario, stretch: boolean): void {
  for (const [field, value] of Object.entries({
    purchase_price: scenario.purchase_price,
    rehab_total: scenario.rehab_total,
    hold_months: scenario.hold_months,
    monthly_carrying_total: scenario.monthly_carrying_costs.total,
    acquisition_closing_costs: scenario.acquisition_closing_costs,
    sale_price: scenario.sale_price,
    sale_costs: scenario.sale_costs,
    total_project_cost: scenario.total_project_cost,
    break_even_sale_price: scenario.break_even_sale_price,
  })) {
    if (!Number.isFinite(value) || value < 0) throw new DealCheckPrepError(`invalid_${field}`);
  }
  if (!Number.isFinite(scenario.net_profit) || !Number.isFinite(scenario.return_on_cost_pct) ||
      !Number.isFinite(scenario.profit_margin_on_sale_pct)) {
    throw new DealCheckPrepError('invalid_flip_metrics');
  }
  if (!Number.isInteger(scenario.hold_months) || scenario.hold_months < 1) {
    throw new DealCheckPrepError('invalid_hold_months');
  }
  if (scenario.requires_human_approval !== stretch) {
    throw new DealCheckPrepError(stretch
      ? 'stretch_human_approval_flag_required'
      : 'standard_scenario_must_not_require_stretch_approval');
  }
}

function percentOf(amount: number, base: number): number {
  if (!(base > 0)) throw new DealCheckPrepError('dealcheck_percentage_base_required');
  return Math.round((amount / base * 100 + Number.EPSILON) * 10000) / 10000;
}

function clean(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed || null;
}

function stringValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}
