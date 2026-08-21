export const REHAB_CATEGORIES = [
  'kitchen',
  'bathrooms',
  'flooring',
  'paint',
  'roof',
  'hvac',
  'electrical',
  'plumbing',
  'windows_doors',
  'landscaping',
  'permits',
  'misc',
] as const;

export const REHAB_SCOPE_LEVELS = ['light', 'medium', 'heavy', 'replace'] as const;
export const REHAB_UNITS = ['allowance', 'sqft', 'each', 'linear_ft'] as const;
export const REHAB_EVIDENCE_CLASSES = ['verified', 'observed', 'source_claim'] as const;
export const REHAB_SOURCE_TYPES = [
  'ghl_field',
  'email',
  'attachment',
  'inspection',
  'photo',
  'contractor_quote',
  'human_verified',
] as const;

export type RehabCategory = typeof REHAB_CATEGORIES[number];
export type RehabScopeLevel = typeof REHAB_SCOPE_LEVELS[number];
export type RehabUnit = typeof REHAB_UNITS[number];
export type RehabEvidenceClass = typeof REHAB_EVIDENCE_CLASSES[number];
export type RehabSourceType = typeof REHAB_SOURCE_TYPES[number];

export interface RehabScopeItem {
  category: RehabCategory;
  scope_level: RehabScopeLevel;
  description: string;
  evidence_class: RehabEvidenceClass;
  source_type: RehabSourceType;
  source_ref: string;
  quantity: number | null;
}

export interface RehabCostBookRate {
  category: RehabCategory;
  scope_level: RehabScopeLevel;
  unit: RehabUnit;
  unit_cost_low: number;
  unit_cost_base: number;
  unit_cost_high: number;
  notes?: string | null;
  source_reference?: string | null;
}

export interface RehabCostBook {
  id: string;
  name: string;
  market: string;
  version: number;
  default_contingency_pct: number;
  rates: RehabCostBookRate[];
}

export interface RehabLineItem {
  category: RehabCategory;
  scope_level: RehabScopeLevel;
  description: string;
  evidence_class: RehabEvidenceClass;
  source_type: RehabSourceType;
  source_ref: string;
  quantity: number;
  unit: RehabUnit;
  unit_cost_low: number;
  unit_cost_base: number;
  unit_cost_high: number;
  cost_low: number;
  cost_base: number;
  cost_high: number;
  cost_book_notes: string | null;
  cost_source_reference: string | null;
}

export interface RehabUnresolvedItem {
  category: RehabCategory;
  scope_level: RehabScopeLevel;
  description: string;
  source_ref: string;
  reason: 'cost_book_rate_missing' | 'quantity_required';
}

export interface RehabEstimateResult {
  contract: 'rehab_v1';
  status: 'estimated' | 'needs_info';
  cost_book: {
    id: string | null;
    name: string | null;
    market: string | null;
    version: number | null;
  };
  scope_item_count: number;
  priced_item_count: number;
  line_items: RehabLineItem[];
  unresolved_items: RehabUnresolvedItem[];
  subtotal: { low: number; base: number; high: number };
  contingency_pct: number | null;
  contingency: { low: number; base: number; high: number } | null;
  total: { low: number; base: number; high: number } | null;
  confidence: 'high' | 'medium' | 'low';
  notes: string[];
}

export function calculateRehabEstimate(
  scopeItems: RehabScopeItem[],
  costBook: RehabCostBook | null,
): RehabEstimateResult {
  if (scopeItems.length === 0) {
    return emptyNeedsInfo(costBook, 'No source-backed rehab scope items were supplied.');
  }

  if (!costBook) {
    return {
      ...emptyNeedsInfo(null, 'No active Evergreen Rehab Cost Book is configured for this workspace.'),
      scope_item_count: scopeItems.length,
      unresolved_items: scopeItems.map((item) => ({
        category: item.category,
        scope_level: item.scope_level,
        description: item.description,
        source_ref: item.source_ref,
        reason: 'cost_book_rate_missing' as const,
      })),
    };
  }

  const lineItems: RehabLineItem[] = [];
  const unresolved: RehabUnresolvedItem[] = [];
  const rateMap = new Map<string, RehabCostBookRate>();
  for (const rate of costBook.rates) {
    rateMap.set(rateKey(rate.category, rate.scope_level), rate);
  }

  for (const item of scopeItems) {
    const rate = rateMap.get(rateKey(item.category, item.scope_level));
    if (!rate) {
      unresolved.push({
        category: item.category,
        scope_level: item.scope_level,
        description: item.description,
        source_ref: item.source_ref,
        reason: 'cost_book_rate_missing',
      });
      continue;
    }

    const quantity = normalizedQuantity(item.quantity, rate.unit);
    if (quantity === null) {
      unresolved.push({
        category: item.category,
        scope_level: item.scope_level,
        description: item.description,
        source_ref: item.source_ref,
        reason: 'quantity_required',
      });
      continue;
    }

    lineItems.push({
      category: item.category,
      scope_level: item.scope_level,
      description: item.description,
      evidence_class: item.evidence_class,
      source_type: item.source_type,
      source_ref: item.source_ref,
      quantity,
      unit: rate.unit,
      unit_cost_low: roundMoney(rate.unit_cost_low),
      unit_cost_base: roundMoney(rate.unit_cost_base),
      unit_cost_high: roundMoney(rate.unit_cost_high),
      cost_low: roundMoney(quantity * rate.unit_cost_low),
      cost_base: roundMoney(quantity * rate.unit_cost_base),
      cost_high: roundMoney(quantity * rate.unit_cost_high),
      cost_book_notes: rate.notes ?? null,
      cost_source_reference: rate.source_reference ?? null,
    });
  }

  const subtotal = sumLineItems(lineItems);
  const contingencyPct = validContingency(costBook.default_contingency_pct)
    ? costBook.default_contingency_pct
    : null;
  const contingency = contingencyPct === null
    ? null
    : {
      low: roundMoney(subtotal.low * contingencyPct / 100),
      base: roundMoney(subtotal.base * contingencyPct / 100),
      high: roundMoney(subtotal.high * contingencyPct / 100),
    };
  const total = contingency
    ? {
      low: roundMoney(subtotal.low + contingency.low),
      base: roundMoney(subtotal.base + contingency.base),
      high: roundMoney(subtotal.high + contingency.high),
    }
    : null;

  const status: RehabEstimateResult['status'] =
    unresolved.length === 0 && lineItems.length > 0 && contingency !== null
      ? 'estimated'
      : 'needs_info';

  const notes: string[] = [];
  if (unresolved.some((item) => item.reason === 'cost_book_rate_missing')) {
    notes.push('One or more source-backed scope items do not have an active cost-book rate. Those items were not priced.');
  }
  if (unresolved.some((item) => item.reason === 'quantity_required')) {
    notes.push('One or more non-allowance cost-book items require a source-backed quantity before they can be priced.');
  }
  if (contingency === null) {
    notes.push('The active cost book does not have a valid default contingency percentage. No total rehab estimate was produced.');
  }
  notes.push('Cash cannot supply or override unit costs through this tool; all pricing comes from the active Evergreen Rehab Cost Book.');

  return {
    contract: 'rehab_v1',
    status,
    cost_book: {
      id: costBook.id,
      name: costBook.name,
      market: costBook.market,
      version: costBook.version,
    },
    scope_item_count: scopeItems.length,
    priced_item_count: lineItems.length,
    line_items: lineItems,
    unresolved_items: unresolved,
    subtotal,
    contingency_pct: contingencyPct,
    contingency,
    total,
    confidence: confidenceFor(scopeItems, unresolved, status),
    notes,
  };
}

function emptyNeedsInfo(costBook: RehabCostBook | null, note: string): RehabEstimateResult {
  return {
    contract: 'rehab_v1',
    status: 'needs_info',
    cost_book: {
      id: costBook?.id ?? null,
      name: costBook?.name ?? null,
      market: costBook?.market ?? null,
      version: costBook?.version ?? null,
    },
    scope_item_count: 0,
    priced_item_count: 0,
    line_items: [],
    unresolved_items: [],
    subtotal: { low: 0, base: 0, high: 0 },
    contingency_pct: costBook?.default_contingency_pct ?? null,
    contingency: null,
    total: null,
    confidence: 'low',
    notes: [note, 'Cash must not invent repair costs or scope quantities.'],
  };
}

function normalizedQuantity(quantity: number | null, unit: RehabUnit): number | null {
  if (unit === 'allowance') return quantity === null ? 1 : quantity;
  if (quantity === null || !Number.isFinite(quantity) || quantity <= 0) return null;
  return quantity;
}

function rateKey(category: RehabCategory, scopeLevel: RehabScopeLevel): string {
  return `${category}:${scopeLevel}`;
}

function sumLineItems(items: RehabLineItem[]): { low: number; base: number; high: number } {
  return items.reduce((sum, item) => ({
    low: roundMoney(sum.low + item.cost_low),
    base: roundMoney(sum.base + item.cost_base),
    high: roundMoney(sum.high + item.cost_high),
  }), { low: 0, base: 0, high: 0 });
}

function confidenceFor(
  scopeItems: RehabScopeItem[],
  unresolved: RehabUnresolvedItem[],
  status: RehabEstimateResult['status'],
): RehabEstimateResult['confidence'] {
  if (status !== 'estimated' || unresolved.length > 0) return 'low';
  if (scopeItems.some((item) => item.evidence_class === 'source_claim')) return 'low';
  if (scopeItems.some((item) => item.evidence_class === 'observed')) return 'medium';
  return 'high';
}

function validContingency(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 30;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
