import type { RehabEvidenceClass, RehabScopeItem } from './rehab.ts';

export const ACQUISITION_REHAB_CLASSES = [
  'lipstick',
  'light',
  'medium',
  'heavy',
  'full_reno',
] as const;

export const ACQUISITION_REHAB_ADDER_TYPES = [
  'roof',
  'hvac',
  'water_heater',
  'plumbing',
  'electrical_panel',
  'non_impact_windows',
  'impact_windows',
  'foundation',
] as const;

export type AcquisitionRehabClass = typeof ACQUISITION_REHAB_CLASSES[number];
export type AcquisitionRehabAdderType = typeof ACQUISITION_REHAB_ADDER_TYPES[number];
export type AcquisitionRehabConfidence = 'high' | 'medium' | 'low';

export interface AcquisitionRehabClassRate {
  rehab_class: AcquisitionRehabClass;
  per_sqft_low: number;
  per_sqft_base: number;
  per_sqft_high: number;
  minimum_rehab: number;
  notes: string | null;
  source_reference: string | null;
}

export interface AcquisitionRehabAdderRate {
  adder_type: AcquisitionRehabAdderType;
  unit: 'allowance' | 'each';
  unit_cost_low: number;
  unit_cost_base: number;
  unit_cost_high: number;
  included_in_heavy_full: boolean;
  notes: string | null;
  source_reference: string | null;
}

export interface AcquisitionRehabPolicy {
  id: string;
  name: string;
  market: string;
  version: number;
  default_contingency_pct: number;
  class_rates: AcquisitionRehabClassRate[];
  adders: AcquisitionRehabAdderRate[];
}

export interface AcquisitionRehabClassification {
  rehab_class: AcquisitionRehabClass;
  label: string;
  confidence: AcquisitionRehabConfidence;
  mode: 'source_backed' | 'default_unknown';
  basis: string;
  source_ref: string | null;
  evidence_class: RehabEvidenceClass | 'policy_default';
}

export interface AcquisitionRehabAdderResult {
  adder_type: AcquisitionRehabAdderType;
  description: string;
  quantity: number;
  unit: 'allowance' | 'each';
  cost_low: number;
  cost_base: number;
  cost_high: number;
  source_ref: string;
  cost_source_reference: string | null;
}

export interface AcquisitionRehabSkippedAdder {
  adder_type: AcquisitionRehabAdderType;
  description: string;
  reason: 'included_in_rehab_class';
  source_ref: string;
}

export interface AcquisitionRehabUnresolvedAdder {
  description: string;
  source_ref: string;
  reason: 'adder_rate_missing' | 'quantity_required' | 'window_type_required';
  adder_type: AcquisitionRehabAdderType | null;
}

export interface AcquisitionRehabEstimate {
  contract: 'acquisition_rehab_v1';
  status: 'estimated' | 'needs_info';
  policy: {
    id: string | null;
    name: string | null;
    market: string | null;
    version: number | null;
  };
  subject_sqft: number | null;
  classification: AcquisitionRehabClassification;
  class_rate: {
    low_per_sqft: number | null;
    base_per_sqft: number | null;
    high_per_sqft: number | null;
    minimum_rehab: number | null;
    source_reference: string | null;
  };
  class_allowance: { low: number; base: number; high: number } | null;
  known_adders: AcquisitionRehabAdderResult[];
  skipped_adders: AcquisitionRehabSkippedAdder[];
  unresolved_adders: AcquisitionRehabUnresolvedAdder[];
  subtotal: { low: number; base: number; high: number } | null;
  contingency_pct: number | null;
  contingency: { low: number; base: number; high: number } | null;
  range_total: { low: number; base: number; high: number } | null;
  total: { low: number; base: number; high: number } | null;
  modeled_rehab: number | null;
  modeled_rehab_basis: 'base' | 'high_due_to_unknown_condition' | null;
  confidence: AcquisitionRehabConfidence;
  notes: string[];
}

const CLASS_LABELS: Record<AcquisitionRehabClass, string> = {
  lipstick: 'Lipstick',
  light: 'Light Rehab',
  medium: 'Medium Rehab',
  heavy: 'Heavy Rehab',
  full_reno: 'Full Reno',
};

const CLASS_RANK: Record<AcquisitionRehabClass, number> = {
  lipstick: 0,
  light: 1,
  medium: 2,
  heavy: 3,
  full_reno: 4,
};

export function calculateAcquisitionRehabEstimate(params: {
  subjectSqft: number | null;
  candidateFacts: Record<string, unknown>;
  scopeItems: RehabScopeItem[];
  policy: AcquisitionRehabPolicy | null;
}): AcquisitionRehabEstimate {
  const classification = classifyAcquisitionRehab(params.candidateFacts, params.scopeItems);
  if (!params.policy) {
    return needsInfo(
      classification,
      params.subjectSqft,
      'No active Evergreen Acquisition Rehab policy is configured for this workspace.',
    );
  }
  if (params.subjectSqft === null || !Number.isFinite(params.subjectSqft) || params.subjectSqft <= 0) {
    return needsInfo(
      classification,
      null,
      'A source-backed subject square footage is required to calculate the acquisition rehab allowance.',
      params.policy,
    );
  }

  const classRate = params.policy.class_rates.find((rate) => rate.rehab_class === classification.rehab_class);
  if (!classRate) {
    return needsInfo(
      classification,
      params.subjectSqft,
      `The active Acquisition Rehab policy does not contain a ${classification.label} class rate.`,
      params.policy,
    );
  }

  const classAllowance = {
    low: roundMoney(Math.max(classRate.minimum_rehab, params.subjectSqft * classRate.per_sqft_low)),
    base: roundMoney(Math.max(classRate.minimum_rehab, params.subjectSqft * classRate.per_sqft_base)),
    high: roundMoney(Math.max(classRate.minimum_rehab, params.subjectSqft * classRate.per_sqft_high)),
  };

  const adderMap = new Map(params.policy.adders.map((adder) => [adder.adder_type, adder]));
  const knownAdders: AcquisitionRehabAdderResult[] = [];
  const skippedAdders: AcquisitionRehabSkippedAdder[] = [];
  const unresolvedAdders: AcquisitionRehabUnresolvedAdder[] = [];

  for (const item of params.scopeItems) {
    const detected = adderForScopeItem(item);
    if (detected.kind === 'not_adder') continue;
    if (detected.kind === 'window_type_required') {
      unresolvedAdders.push({
        description: item.description,
        source_ref: item.source_ref,
        reason: 'window_type_required',
        adder_type: null,
      });
      continue;
    }

    const adderType = detected.adder_type;
    const rate = adderMap.get(adderType);
    if (!rate) {
      unresolvedAdders.push({
        description: item.description,
        source_ref: item.source_ref,
        reason: 'adder_rate_missing',
        adder_type: adderType,
      });
      continue;
    }

    if (rate.included_in_heavy_full && CLASS_RANK[classification.rehab_class] >= CLASS_RANK.heavy) {
      skippedAdders.push({
        adder_type: adderType,
        description: item.description,
        reason: 'included_in_rehab_class',
        source_ref: item.source_ref,
      });
      continue;
    }

    const quantity = rate.unit === 'allowance' ? 1 : item.quantity;
    if (quantity === null || !Number.isFinite(quantity) || quantity <= 0) {
      unresolvedAdders.push({
        description: item.description,
        source_ref: item.source_ref,
        reason: 'quantity_required',
        adder_type: adderType,
      });
      continue;
    }

    knownAdders.push({
      adder_type: adderType,
      description: item.description,
      quantity,
      unit: rate.unit,
      cost_low: roundMoney(quantity * rate.unit_cost_low),
      cost_base: roundMoney(quantity * rate.unit_cost_base),
      cost_high: roundMoney(quantity * rate.unit_cost_high),
      source_ref: item.source_ref,
      cost_source_reference: rate.source_reference,
    });
  }

  const adderTotals = knownAdders.reduce(
    (sum, item) => ({
      low: roundMoney(sum.low + item.cost_low),
      base: roundMoney(sum.base + item.cost_base),
      high: roundMoney(sum.high + item.cost_high),
    }),
    { low: 0, base: 0, high: 0 },
  );
  const subtotal = {
    low: roundMoney(classAllowance.low + adderTotals.low),
    base: roundMoney(classAllowance.base + adderTotals.base),
    high: roundMoney(classAllowance.high + adderTotals.high),
  };

  const contingencyPct = validContingency(params.policy.default_contingency_pct)
    ? params.policy.default_contingency_pct
    : null;
  const contingency = contingencyPct === null
    ? null
    : {
      low: roundMoney(subtotal.low * contingencyPct / 100),
      base: roundMoney(subtotal.base * contingencyPct / 100),
      high: roundMoney(subtotal.high * contingencyPct / 100),
    };
  const rangeTotal = contingency === null
    ? null
    : {
      low: roundMoney(subtotal.low + contingency.low),
      base: roundMoney(subtotal.base + contingency.base),
      high: roundMoney(subtotal.high + contingency.high),
    };
  const modeledBasis: AcquisitionRehabEstimate['modeled_rehab_basis'] = rangeTotal === null
    ? null
    : classification.mode === 'default_unknown'
    ? 'high_due_to_unknown_condition'
    : 'base';
  const modeledRehab = rangeTotal === null
    ? null
    : modeledBasis === 'high_due_to_unknown_condition'
    ? rangeTotal.high
    : rangeTotal.base;
  const total = rangeTotal === null || modeledRehab === null
    ? null
    : { low: rangeTotal.low, base: modeledRehab, high: rangeTotal.high };
  const status: AcquisitionRehabEstimate['status'] =
    contingencyPct !== null && unresolvedAdders.length === 0 ? 'estimated' : 'needs_info';

  const notes = [
    'Acquisition Rehab is a whole-property allowance, not a contractor-grade scope.',
    'Known big-ticket systems are additive when specifically supported by source evidence and not already absorbed by Heavy/Full Reno policy.',
    `A ${params.policy.default_contingency_pct}% contingency is applied by policy.`,
  ];
  if (classification.mode === 'default_unknown') {
    notes.push('No usable condition description was available, so Evergreen defaults to Medium Rehab / Low confidence and uses the high side for MAO until better evidence arrives.');
  }
  if (skippedAdders.length) {
    notes.push('One or more known systems were not added separately because the selected Heavy/Full Reno class already assumes normal major-system replacement, preventing double counting.');
  }
  if (unresolvedAdders.length) {
    notes.push('One or more explicitly known big-ticket repairs could not be priced; the rehab phase remains needs_info rather than hiding that uncertainty.');
  }

  return {
    contract: 'acquisition_rehab_v1',
    status,
    policy: policySummary(params.policy),
    subject_sqft: roundMoney(params.subjectSqft),
    classification,
    class_rate: {
      low_per_sqft: classRate.per_sqft_low,
      base_per_sqft: classRate.per_sqft_base,
      high_per_sqft: classRate.per_sqft_high,
      minimum_rehab: classRate.minimum_rehab,
      source_reference: classRate.source_reference,
    },
    class_allowance: classAllowance,
    known_adders: knownAdders,
    skipped_adders: skippedAdders,
    unresolved_adders: unresolvedAdders,
    subtotal,
    contingency_pct: contingencyPct,
    contingency,
    range_total: rangeTotal,
    total,
    modeled_rehab: modeledRehab,
    modeled_rehab_basis: modeledBasis,
    confidence: classification.confidence,
    notes,
  };
}

export function classifyAcquisitionRehab(
  candidateFacts: Record<string, unknown>,
  scopeItems: RehabScopeItem[],
): AcquisitionRehabClassification {
  const factTexts = [
    candidateFacts.renovation_level,
    candidateFacts.condition,
    candidateFacts.repairs,
    candidateFacts.repair_notes,
    candidateFacts.rehab,
    candidateFacts.property_condition,
  ].flatMap((value) => typeof value === 'string' && value.trim() ? [value.trim()] : []);

  const scopeTextItems = scopeItems.filter((item) =>
    item.category === 'misc' || ['kitchen', 'bathrooms', 'flooring', 'paint', 'landscaping', 'permits'].includes(item.category)
  );

  for (const text of factTexts) {
    const rehabClass = classFromText(text);
    if (rehabClass) {
      return {
        rehab_class: rehabClass,
        label: CLASS_LABELS[rehabClass],
        confidence: 'low',
        mode: 'source_backed',
        basis: text,
        source_ref: 'ema_candidate.extracted_facts',
        evidence_class: 'source_claim',
      };
    }
  }

  for (const item of scopeTextItems) {
    const rehabClass = classFromText(item.description) ?? classFromLegacyScopeLevel(item.scope_level, item.description);
    if (rehabClass) {
      return {
        rehab_class: rehabClass,
        label: CLASS_LABELS[rehabClass],
        confidence: confidenceFromEvidence(item.evidence_class),
        mode: 'source_backed',
        basis: item.description,
        source_ref: item.source_ref,
        evidence_class: item.evidence_class,
      };
    }
  }

  return {
    rehab_class: 'medium',
    label: CLASS_LABELS.medium,
    confidence: 'low',
    mode: 'default_unknown',
    basis: 'No source-backed condition description, photos, inspection, or repair budget available.',
    source_ref: null,
    evidence_class: 'policy_default',
  };
}

function classFromText(value: string): AcquisitionRehabClass | null {
  const text = value.toLowerCase();
  if (/\b(full\s*(reno|renovation)|full\s*gut|gut\s*(reno|renovation)?|down\s*to\s*(the\s*)?studs|uninhabitable|complete\s*renovation|fire\s*damage)\b/.test(text)) return 'full_reno';
  if (/\b(heavy\s*rehab|major\s*rehab|major\s*repairs|poor\s*condition|significant\s*deferred\s*maintenance|extensive\s*rehab)\b/.test(text)) return 'heavy';
  if (/\b(medium\s*rehab|moderate\s*rehab|needs\s*(a\s*)?renovation|original\s*condition|needs\s*work)\b/.test(text)) return 'medium';
  if (/\b(light\s*rehab|cosmetic\s*refresh|cosmetic|dated|needs\s*updat(e|ing)|minor\s*rehab)\b/.test(text)) return 'light';
  if (/\b(lipstick|make[- ]?ready|touch[- ]?ups?|minor\s*tlc|clean[- ]?up|cleanup|turnkey\s*with\s*minor)\b/.test(text)) return 'lipstick';
  return null;
}

function classFromLegacyScopeLevel(level: string, description: string): AcquisitionRehabClass | null {
  const text = description.toLowerCase();
  if (level === 'replace') return 'full_reno';
  if (level === 'heavy') return 'heavy';
  if (level === 'medium') return 'medium';
  if (level === 'light') return /lipstick|make[- ]?ready|touch[- ]?up/.test(text) ? 'lipstick' : 'light';
  return null;
}

function adderForScopeItem(item: RehabScopeItem):
  | { kind: 'not_adder' }
  | { kind: 'window_type_required' }
  | { kind: 'adder'; adder_type: AcquisitionRehabAdderType } {
  const description = item.description.toLowerCase();
  switch (item.category) {
    case 'roof':
      return { kind: 'adder', adder_type: 'roof' };
    case 'hvac':
      return { kind: 'adder', adder_type: 'hvac' };
    case 'plumbing':
      return { kind: 'adder', adder_type: 'plumbing' };
    case 'electrical':
      return /panel|200[- ]?amp/.test(description)
        ? { kind: 'adder', adder_type: 'electrical_panel' }
        : { kind: 'not_adder' };
    case 'windows_doors': {
      if (!/window/.test(description)) return { kind: 'not_adder' };
      if (/non[- ]?impact/.test(description)) return { kind: 'adder', adder_type: 'non_impact_windows' };
      if (/impact|hurricane/.test(description)) return { kind: 'adder', adder_type: 'impact_windows' };
      return { kind: 'window_type_required' };
    }
    case 'misc':
      if (/water\s*heater/.test(description)) return { kind: 'adder', adder_type: 'water_heater' };
      if (/foundation/.test(description)) return { kind: 'adder', adder_type: 'foundation' };
      return { kind: 'not_adder' };
    default:
      return { kind: 'not_adder' };
  }
}

function confidenceFromEvidence(value: RehabEvidenceClass): AcquisitionRehabConfidence {
  if (value === 'verified') return 'high';
  if (value === 'observed') return 'medium';
  return 'low';
}

function needsInfo(
  classification: AcquisitionRehabClassification,
  subjectSqft: number | null,
  note: string,
  policy: AcquisitionRehabPolicy | null = null,
): AcquisitionRehabEstimate {
  return {
    contract: 'acquisition_rehab_v1',
    status: 'needs_info',
    policy: policySummary(policy),
    subject_sqft: subjectSqft,
    classification,
    class_rate: {
      low_per_sqft: null,
      base_per_sqft: null,
      high_per_sqft: null,
      minimum_rehab: null,
      source_reference: null,
    },
    class_allowance: null,
    known_adders: [],
    skipped_adders: [],
    unresolved_adders: [],
    subtotal: null,
    contingency_pct: policy?.default_contingency_pct ?? null,
    contingency: null,
    range_total: null,
    total: null,
    modeled_rehab: null,
    modeled_rehab_basis: null,
    confidence: classification.confidence,
    notes: [note],
  };
}

function policySummary(policy: AcquisitionRehabPolicy | null) {
  return {
    id: policy?.id ?? null,
    name: policy?.name ?? null,
    market: policy?.market ?? null,
    version: policy?.version ?? null,
  };
}

function validContingency(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 30;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
