import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { enrichCandidateProperty } from './property_enrichment.ts';
import {
  resolvePublicPropertyType,
  type PublicPropertyTypeResolution,
} from './public_property_type.ts';

export class BuyBoxFitError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
    this.name = 'BuyBoxFitError';
  }
}

type FitResult = 'fit' | 'not_fit' | 'needs_info';
type RuleStatus = 'pass' | 'fail' | 'unknown';

interface CandidateRow {
  id: string;
  workspace_id: string;
  normalized_address: string | null;
  extracted_facts: Record<string, unknown>;
  intake_result: string | null;
  is_test: boolean;
}

interface CriterionRow {
  id: string;
  workspace_id: string | null;
  asset_class: string;
  field: string;
  operator: string;
  value: unknown;
  hardness: string;
  label: string;
  notes: string | null;
  rule_type: string;
}

interface ExceptionRow {
  id: string;
  workspace_id: string | null;
  asset_class: string;
  triggers_on: string | null;
  exception_type: string;
  condition: string;
  adjustment: string | null;
  requires_human: boolean;
  label: string;
}

interface RuleEvaluation {
  criterion_id: string;
  field: string;
  label: string;
  hardness: string;
  operator: string;
  status: RuleStatus;
  observed_value: unknown;
  required_value: unknown;
}

interface ScreenEvaluation {
  asset_class: string;
  result: FitResult;
  verification_status: 'verified' | 'provisional' | 'not_qualified';
  passed: RuleEvaluation[];
  failed: RuleEvaluation[];
  unknown: RuleEvaluation[];
  hard_failed: RuleEvaluation[];
  hard_unknown: RuleEvaluation[];
  soft_failed: RuleEvaluation[];
  uncovered_hard_failures: RuleEvaluation[];
  exceptions_available: Array<Record<string, unknown>>;
}

interface PropertyEnrichmentMetadata {
  provider: 'dealmachine';
  status: string;
  snapshot_id: string | null;
  provider_property_id: string | null;
  fetched_at: string | null;
  credits_used: number;
  error_code: string | null;
  filled_candidate_fields: string[];
}

export interface ProviderFactMergeResult {
  facts: Record<string, unknown>;
  filled_fields: string[];
}

// Ema should only pay to resolve facts required for asset/property-type routing.
// Beds, baths, sqft, and HOA remain useful screening facts, but missing values are
// human-review items rather than a reason to consume a DealMachine property call.
const DEALMACHINE_REQUIRED_SCREEN_FIELDS = new Set([
  'property_type',
  'is_condo',
]);

/**
 * Fill only missing physical-property facts from the cached/fetched DealMachine
 * subject record. Source-stated facts always win. Deliberately excluded here:
 * ARV/estimated value, HOA, repairs, occupancy, and other facts where a provider
 * value would either change the evidence class or create an unsafe assumption.
 */
export function mergeMissingDealMachineFacts(
  sourceFacts: Record<string, unknown>,
  providerFacts: Record<string, unknown>,
): ProviderFactMergeResult {
  const facts = { ...sourceFacts };
  const filledFields: string[] = [];
  const mappings: Array<{ target: string; aliases: string[]; provider: string }> = [
    { target: 'property_type', aliases: ['property_type', 'propertyType', 'type'], provider: 'property_type' },
    { target: 'units', aliases: ['units', 'unit_count', 'unitCount'], provider: 'num_units' },
    { target: 'bedrooms', aliases: ['beds', 'bedrooms'], provider: 'num_bedrooms' },
    { target: 'bathrooms', aliases: ['baths', 'bathrooms'], provider: 'num_bathrooms' },
    { target: 'sqft', aliases: ['sqft', 'square_feet', 'squareFeet'], provider: 'living_area_sqft' },
    { target: 'year_built', aliases: ['year_built', 'yearBuilt'], provider: 'year_built' },
    { target: 'city', aliases: ['city', 'property_city'], provider: 'city' },
    { target: 'state', aliases: ['state', 'property_state'], provider: 'state' },
    { target: 'zip', aliases: ['zip', 'postal_code', 'property_zip'], provider: 'zip' },
  ];

  for (const mapping of mappings) {
    if (hasAnyFact(sourceFacts, mapping.aliases)) continue;
    const value = providerFacts[mapping.provider];
    if (value === undefined || value === null || value === '') continue;
    facts[mapping.target] = value;
    filledFields.push(mapping.target);
  }

  return { facts, filled_fields: filledFields };
}

export function mergeMissingPublicPropertyTypeFact(
  sourceFacts: Record<string, unknown>,
  resolution: PublicPropertyTypeResolution,
): ProviderFactMergeResult {
  const facts = { ...sourceFacts };
  const filledFields: string[] = [];
  if (
    resolution.status === 'resolved' &&
    resolution.property_type &&
    !hasAnyFact(sourceFacts, ['property_type', 'propertyType', 'type'])
  ) {
    facts.property_type = resolution.property_type;
    filledFields.push('property_type');
  }
  return { facts, filled_fields: filledFields };
}

export async function checkCandidateBuyBoxFit(
  admin: SupabaseClient,
  workspaceId: string,
  candidateId: string,
): Promise<Record<string, unknown>> {
  const candidate = await loadCandidate(admin, workspaceId, candidateId);
  validateCandidate(candidate);

  let evaluationFacts = { ...candidate.extracted_facts };
  let publicResolution: PublicPropertyTypeResolution | null = null;
  const lookupPath: string[] = ['source'];

  // Stage 1: source-only pre-screen. Any known hard failure is enough to stop
  // paid enrichment. An exception-enabled hard failure remains needs_info for
  // human review; an uncovered hard failure remains not_fit.
  const sourceAssetClass = tryDeriveAssetClass(evaluationFacts);
  if (sourceAssetClass) {
    const sourceScreen = await evaluateScreen(admin, workspaceId, sourceAssetClass, evaluationFacts);
    if (sourceScreen.hard_failed.length > 0) {
      return persistScreenResult(
        admin,
        workspaceId,
        candidate,
        evaluationFacts,
        sourceScreen,
        skippedDealMachine('source_hard_gate'),
        publicResolution,
        lookupPath,
      );
    }
  }

  // Stage 2: if property type is still unresolved, try a bounded free public
  // record lookup before DealMachine. Public-record failure is non-blocking.
  if (!canonicalPropertyType(firstValue(evaluationFacts, ['property_type', 'propertyType', 'type']),
    numberValue(firstValue(evaluationFacts, ['units', 'unit_count', 'unitCount'])))) {
    publicResolution = await resolvePublicPropertyType(
      candidate.normalized_address!.trim(),
      evaluationFacts,
    );
    lookupPath.push('public_record');
    const publicMerge = mergeMissingPublicPropertyTypeFact(evaluationFacts, publicResolution);
    evaluationFacts = publicMerge.facts;
  }

  // Stage 3: source + free public records. Stop before DealMachine whenever a
  // known hard failure already requires rejection or human exception review.
  const publicAssetClass = tryDeriveAssetClass(evaluationFacts);
  if (publicAssetClass) {
    const publicScreen = await evaluateScreen(admin, workspaceId, publicAssetClass, evaluationFacts);
    if (publicScreen.hard_failed.length > 0) {
      return persistScreenResult(
        admin,
        workspaceId,
        candidate,
        evaluationFacts,
        publicScreen,
        skippedDealMachine('public_record_hard_gate'),
        publicResolution,
        lookupPath,
      );
    }

    // Missing beds/baths/sqft/HOA are not paid-resolution triggers. They stay
    // visible to the reviewer. DealMachine is justified here only when a routing
    // fact such as property type / condo status is still a hard unknown.
    if (!hasDealMachineResolvableHardUnknown(publicScreen)) {
      return persistScreenResult(
        admin,
        workspaceId,
        candidate,
        evaluationFacts,
        publicScreen,
        skippedDealMachine('screen_decidable_without_dealmachine'),
        publicResolution,
        lookupPath,
      );
    }
  }

  // Stage 4: paid fallback only when asset routing remains unresolved or a
  // property-type/condo routing fact remains unknown. Once justified, request
  // and persist the comprehensive subject snapshot for downstream reuse.
  lookupPath.push('dealmachine');
  const propertyEnrichment = await enrichCandidateProperty(
    admin,
    workspaceId,
    candidate.id,
    candidate.normalized_address!.trim(),
  );
  const mergedFacts = mergeMissingDealMachineFacts(
    evaluationFacts,
    propertyEnrichment.facts,
  );
  evaluationFacts = mergedFacts.facts;

  const assetClass = deriveAssetClass(evaluationFacts);
  const finalScreen = await evaluateScreen(admin, workspaceId, assetClass, evaluationFacts);
  const metadata: PropertyEnrichmentMetadata = {
    provider: propertyEnrichment.provider,
    status: propertyEnrichment.status,
    snapshot_id: propertyEnrichment.snapshot_id,
    provider_property_id: propertyEnrichment.provider_property_id,
    fetched_at: propertyEnrichment.fetched_at,
    credits_used: propertyEnrichment.credits_used,
    error_code: propertyEnrichment.error_code,
    filled_candidate_fields: mergedFacts.filled_fields,
  };

  return persistScreenResult(
    admin,
    workspaceId,
    candidate,
    evaluationFacts,
    finalScreen,
    metadata,
    publicResolution,
    lookupPath,
  );
}

export function shouldCallDealMachineForScreen(params: {
  hard_failed_fields: string[];
  hard_unknown_fields: string[];
}): boolean {
  if (params.hard_failed_fields.length > 0) return false;
  return params.hard_unknown_fields.some((field) =>
    DEALMACHINE_REQUIRED_SCREEN_FIELDS.has(field)
  );
}

function hasDealMachineResolvableHardUnknown(screen: ScreenEvaluation): boolean {
  return shouldCallDealMachineForScreen({
    hard_failed_fields: screen.hard_failed.map((row) => row.field),
    hard_unknown_fields: screen.hard_unknown.map((row) => row.field),
  });
}

function tryDeriveAssetClass(facts: Record<string, unknown>): string | null {
  try {
    return deriveAssetClass(facts);
  } catch (error) {
    if (error instanceof BuyBoxFitError && error.code === 'asset_class_unresolved') return null;
    throw error;
  }
}

async function evaluateScreen(
  admin: SupabaseClient,
  workspaceId: string,
  assetClass: string,
  facts: Record<string, unknown>,
): Promise<ScreenEvaluation> {
  const criteria = await loadCriteria(admin, workspaceId, assetClass);
  if (!criteria.length) throw new BuyBoxFitError(409, 'buy_box_not_configured');
  const exceptions = await loadExceptions(admin, workspaceId, assetClass);

  const evaluations = criteria
    .filter((criterion) => criterion.rule_type === 'screen')
    .map((criterion) => evaluateCriterion(criterion, facts));
  if (!evaluations.length) throw new BuyBoxFitError(409, 'buy_box_screen_not_configured');

  const failed = evaluations.filter((row) => row.status === 'fail');
  const unknown = evaluations.filter((row) => row.status === 'unknown');
  const passed = evaluations.filter((row) => row.status === 'pass');
  const hardFailed = failed.filter((row) => row.hardness === 'hard');
  const hardUnknown = unknown.filter((row) => row.hardness === 'hard');
  const softFailed = failed.filter((row) => row.hardness !== 'hard');

  const exceptionCandidates = failed.flatMap((evaluation) =>
    exceptions
      .filter((exception) => exception.triggers_on === evaluation.field)
      .map((exception) => ({
        criterion_id: evaluation.criterion_id,
        field: evaluation.field,
        exception_id: exception.id,
        exception_type: exception.exception_type,
        label: exception.label,
        condition: exception.condition,
        adjustment: exception.adjustment,
        requires_human: exception.requires_human,
      }))
  );

  const hardFailureFieldsWithException = new Set(
    exceptionCandidates
      .filter((exception) => hardFailed.some((failure) => failure.field === exception.field))
      .map((exception) => String(exception.field)),
  );
  const uncoveredHardFailures = hardFailed.filter(
    (failure) => !hardFailureFieldsWithException.has(failure.field),
  );

  const result = classifyBuyBoxResult({
    uncoveredHardFailureCount: uncoveredHardFailures.length,
    hardFailureCount: hardFailed.length,
    hardUnknownCount: hardUnknown.length,
  });
  const verificationStatus = result === 'fit'
    ? (unknown.length ? 'provisional' : 'verified')
    : 'not_qualified';

  return {
    asset_class: assetClass,
    result,
    verification_status: verificationStatus,
    passed,
    failed,
    unknown,
    hard_failed: hardFailed,
    hard_unknown: hardUnknown,
    soft_failed: softFailed,
    uncovered_hard_failures: uncoveredHardFailures,
    exceptions_available: exceptionCandidates,
  };
}

async function persistScreenResult(
  admin: SupabaseClient,
  workspaceId: string,
  candidate: CandidateRow,
  evaluationFacts: Record<string, unknown>,
  screen: ScreenEvaluation,
  propertyEnrichment: PropertyEnrichmentMetadata,
  publicResolution: PublicPropertyTypeResolution | null,
  lookupPath: string[],
): Promise<Record<string, unknown>> {
  const details = {
    contract: 'deal.buy_box_fit.v1',
    candidate_id: candidate.id,
    asset_class: screen.asset_class,
    result: screen.result,
    crm_eligible: isCrmEligibleBuyBoxResult(screen.result),
    verification_status: screen.verification_status,
    lookup_policy: {
      path: lookupPath,
      dealmachine_called: lookupPath.includes('dealmachine'),
      free_public_record_attempted: lookupPath.includes('public_record'),
    },
    public_property_type: publicResolution
      ? {
        status: publicResolution.status,
        provider: publicResolution.provider,
        property_type: publicResolution.property_type,
        matched_address: publicResolution.matched_address,
        parcel_id: publicResolution.parcel_id,
        classification_code: publicResolution.classification_code,
        source_url: publicResolution.source_url,
        error_code: publicResolution.error_code,
      }
      : {
        status: 'not_needed',
        provider: 'none',
        property_type: null,
        matched_address: null,
        parcel_id: null,
        classification_code: null,
        source_url: null,
        error_code: null,
      },
    property_enrichment: propertyEnrichment,
    passed: screen.passed,
    failed: [...screen.uncovered_hard_failures, ...screen.soft_failed],
    unknown: screen.unknown,
    exceptions_available: screen.exceptions_available,
    summary: {
      passed_count: screen.passed.length,
      failed_count: screen.failed.length,
      unknown_count: screen.unknown.length,
      hard_failed_count: screen.hard_failed.length,
      hard_unknown_count: screen.hard_unknown.length,
      soft_failed_count: screen.soft_failed.length,
    },
  };

  const now = new Date().toISOString();
  const { error } = await admin.from('ema_candidates').update({
    // Source facts always win. Public/DealMachine fills are persisted only when
    // the corresponding fact was absent from the source, and provenance remains
    // visible in buy_box_fit_details / the DealMachine snapshot.
    extracted_facts: evaluationFacts,
    buy_box_fit_result: screen.result,
    buy_box_fit_details: details,
    buy_box_fit_checked_at: now,
    last_evaluated_at: now,
  }).eq('id', candidate.id).eq('workspace_id', workspaceId);
  if (error) throw new BuyBoxFitError(500, 'buy_box_fit_persist_failed');

  return details;
}

function skippedDealMachine(reason: string): PropertyEnrichmentMetadata {
  return {
    provider: 'dealmachine',
    status: 'skipped',
    snapshot_id: null,
    provider_property_id: null,
    fetched_at: null,
    credits_used: 0,
    error_code: reason,
    filled_candidate_fields: [],
  };
}

export function classifyBuyBoxResult(params: {
  uncoveredHardFailureCount: number;
  hardFailureCount: number;
  hardUnknownCount: number;
}): FitResult {
  if (params.uncoveredHardFailureCount > 0) return 'not_fit';
  if (params.hardFailureCount > 0 || params.hardUnknownCount > 0) {
    return 'needs_info';
  }
  return 'fit';
}

export function isCrmEligibleBuyBoxResult(result: string): boolean {
  return result === 'fit' || result === 'needs_info';
}

async function loadCandidate(
  admin: SupabaseClient,
  workspaceId: string,
  candidateId: string,
): Promise<CandidateRow> {
  const { data, error } = await admin.from('ema_candidates').select(
    'id, workspace_id, normalized_address, extracted_facts, intake_result, is_test',
  ).eq('id', candidateId).eq('workspace_id', workspaceId).maybeSingle();
  if (error) throw new BuyBoxFitError(500, 'candidate_lookup_failed');
  if (!data) throw new BuyBoxFitError(404, 'candidate_not_found');
  return data as CandidateRow;
}

function validateCandidate(candidate: CandidateRow): void {
  if (candidate.is_test) throw new BuyBoxFitError(409, 'test_candidate_not_permitted');
  const address = candidate.normalized_address?.trim() ?? '';
  if (!/^\s*\d{1,8}\s+[A-Za-z0-9]/.test(address)) {
    throw new BuyBoxFitError(409, 'normalized_address_required');
  }
  if (candidate.intake_result === 'excluded') {
    throw new BuyBoxFitError(409, 'candidate_not_intake_eligible');
  }
}

async function loadCriteria(
  admin: SupabaseClient,
  workspaceId: string,
  assetClass: string,
): Promise<CriterionRow[]> {
  const { data, error } = await admin.from('buy_box_criteria').select(
    'id, workspace_id, asset_class, field, operator, value, hardness, label, notes, rule_type',
  ).eq('active', true).eq('asset_class', assetClass)
    .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`);
  if (error) throw new BuyBoxFitError(500, 'buy_box_lookup_failed');
  return effectiveRows((data ?? []) as CriterionRow[], workspaceId, (row) =>
    `${row.asset_class}:${row.rule_type}:${row.field}:${row.operator}`
  );
}

async function loadExceptions(
  admin: SupabaseClient,
  workspaceId: string,
  assetClass: string,
): Promise<ExceptionRow[]> {
  const { data, error } = await admin.from('buy_box_exceptions').select(
    'id, workspace_id, asset_class, triggers_on, exception_type, condition, adjustment, requires_human, label',
  ).eq('active', true).in('asset_class', [assetClass, 'all'])
    .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`);
  if (error) throw new BuyBoxFitError(500, 'buy_box_exception_lookup_failed');
  return effectiveRows((data ?? []) as ExceptionRow[], workspaceId, (row) =>
    `${row.asset_class}:${row.triggers_on ?? ''}:${row.exception_type}:${row.label}`
  );
}

function effectiveRows<T extends { workspace_id: string | null }>(
  rows: T[],
  workspaceId: string,
  keyFor: (row: T) => string,
): T[] {
  const selected = new Map<string, T>();
  for (const row of rows) {
    const key = keyFor(row);
    const existing = selected.get(key);
    if (!existing || row.workspace_id === workspaceId) selected.set(key, row);
  }
  return [...selected.values()];
}

export function deriveAssetClass(facts: Record<string, unknown>): string {
  const explicit = normalizedToken(firstValue(facts, ['asset_class', 'assetClass', 'strategy', 'deal_type', 'dealType']));
  if (explicit) {
    if (['fix flip', 'fix and flip', 'flip', 'fix_flip'].includes(explicit)) return 'fix_flip';
    if (['multifamily', 'multi family'].includes(explicit)) return 'multifamily';
    if (['rv park', 'rv_park'].includes(explicit)) return 'rv_park';
    if (['mhp', 'mobile home park', 'mobile_home_park'].includes(explicit)) return 'mhp';
    if (['business'].includes(explicit)) return 'business';
  }

  const propertyType = canonicalPropertyType(firstValue(facts, [
    'property_type', 'propertyType', 'type',
  ]), numberValue(firstValue(facts, ['units', 'unit_count', 'unitCount'])));
  if (['single_family', 'small_multifamily', 'condo', 'mobile_home'].includes(propertyType ?? '')) return 'fix_flip';
  if (propertyType === 'multifamily') return 'multifamily';
  if (propertyType === 'rv_park') return 'rv_park';
  if (propertyType === 'mhp') return 'mhp';
  throw new BuyBoxFitError(409, 'asset_class_unresolved');
}

function evaluateCriterion(
  criterion: CriterionRow,
  facts: Record<string, unknown>,
): RuleEvaluation {
  const observed = observedValue(criterion.field, facts);
  if (observed === null || observed === undefined || observed === '') {
    // If county is missing but state is known and every allowed geography is in
    // another state, geography is definitively out-of-buy-box rather than unknown.
    if (
      criterion.field === 'geography' && criterion.operator === 'in' &&
      Array.isArray(criterion.value)
    ) {
      const state = stateValue(facts);
      const allowedStates = allowedGeographyStates(criterion.value);
      if (state && allowedStates.size > 0 && !allowedStates.has(state)) {
        return ruleResult(criterion, 'fail', state);
      }
    }
    return ruleResult(criterion, 'unknown', null);
  }

  let passed = false;
  switch (criterion.operator) {
    case 'min': {
      const actual = numberValue(observed);
      const minimum = numberValue(recordValue(criterion.value, 'min'));
      if (actual === null || minimum === null) return ruleResult(criterion, 'unknown', observed);
      passed = actual >= minimum;
      break;
    }
    case 'max': {
      const actual = numberValue(observed);
      const maximum = numberValue(recordValue(criterion.value, 'max'));
      if (actual === null || maximum === null) return ruleResult(criterion, 'unknown', observed);
      passed = actual <= maximum;
      break;
    }
    case 'range': {
      const actual = numberValue(observed);
      const minimum = numberValue(recordValue(criterion.value, 'min'));
      const maximum = numberValue(recordValue(criterion.value, 'max'));
      if (actual === null || minimum === null || maximum === null) {
        return ruleResult(criterion, 'unknown', observed);
      }
      passed = actual >= minimum && actual <= maximum;
      break;
    }
    case 'boolean': {
      const actual = booleanValue(observed);
      const mustBe = booleanValue(recordValue(criterion.value, 'must_be'));
      if (actual === null || mustBe === null) return ruleResult(criterion, 'unknown', observed);
      passed = actual === mustBe;
      break;
    }
    case 'in': {
      if (!Array.isArray(criterion.value)) return ruleResult(criterion, 'unknown', observed);
      const actual = comparisonToken(criterion.field, observed);
      const allowed = criterion.value.map((value) => comparisonToken(criterion.field, value));
      passed = Boolean(actual) && allowed.includes(actual);
      break;
    }
    default:
      return ruleResult(criterion, 'unknown', observed);
  }

  return ruleResult(criterion, passed ? 'pass' : 'fail', observed);
}

function ruleResult(
  criterion: CriterionRow,
  status: RuleStatus,
  observed: unknown,
): RuleEvaluation {
  return {
    criterion_id: criterion.id,
    field: criterion.field,
    label: criterion.label,
    hardness: criterion.hardness,
    operator: criterion.operator,
    status,
    observed_value: observed,
    required_value: criterion.value,
  };
}

function observedValue(field: string, facts: Record<string, unknown>): unknown {
  switch (field) {
    case 'beds': return firstValue(facts, ['beds', 'bedrooms']);
    case 'baths': return firstValue(facts, ['baths', 'bathrooms']);
    case 'sqft': return firstValue(facts, ['sqft', 'square_feet', 'squareFeet']);
    case 'purchase_price': return firstValue(facts, ['purchase_price', 'asking_price', 'askingPrice', 'price']);
    case 'arv': return firstValue(facts, ['arv', 'estimated_arv', 'estimatedArv']);
    case 'property_type':
      return canonicalPropertyType(
        firstValue(facts, ['property_type', 'propertyType', 'type']),
        numberValue(firstValue(facts, ['units', 'unit_count', 'unitCount'])),
      );
    case 'geography': return geographyValue(facts);
    case 'hoa': return booleanValue(firstValue(facts, ['has_hoa', 'hoa_exists', 'hoa']));
    case 'is_condo': {
      const explicit = firstValue(facts, ['is_condo', 'condo']);
      const parsed = booleanValue(explicit);
      if (parsed !== null) return parsed;
      const propertyType = canonicalPropertyType(firstValue(facts, ['property_type', 'propertyType', 'type']), null);
      if (propertyType === 'condo') return true;
      if (propertyType === 'single_family' || propertyType === 'small_multifamily') return false;
      return null;
    }
    case 'flood_zone': return booleanValue(firstValue(facts, ['flood_zone', 'in_flood_zone', 'is_flood_zone']));
    case 'fire_damage': return booleanValue(firstValue(facts, ['fire_damage', 'has_fire_damage']));
    case 'structural_issues': return booleanValue(firstValue(facts, ['structural_issues', 'foundation_issues', 'has_structural_issues']));
    case 'post_possession': return booleanValue(firstValue(facts, ['post_possession', 'seller_post_possession']));
    case 'renovation_level': return firstValue(facts, ['renovation_level', 'rehab_level']);
    case 'units': return firstValue(facts, ['units', 'unit_count', 'unitCount']);
    case 'pads': return firstValue(facts, ['pads', 'pad_count', 'padCount']);
    case 'sites': return firstValue(facts, ['sites', 'site_count', 'siteCount']);
    case 'occupancy': return firstValue(facts, ['occupancy_percent', 'occupancy_pct', 'occupancy']);
    case 'high_crime': return booleanValue(firstValue(facts, ['high_crime', 'is_high_crime']));
    case 'poverty_rate': return firstValue(facts, ['poverty_rate', 'povertyRate']);
    case 'asset_class_grade': return firstValue(facts, ['asset_class_grade', 'class_grade']);
    case 'home_ownership': return firstValue(facts, ['home_ownership', 'homeOwnership']);
    case 'metro_proximity_minutes': return firstValue(facts, ['metro_proximity_minutes', 'metro_minutes']);
    default: return firstValue(facts, [field]);
  }
}

function geographyValue(facts: Record<string, unknown>): string | null {
  const explicit = scalarString(firstValue(facts, ['geography', 'market']), 200);
  if (explicit) return explicit;
  const county = scalarString(firstValue(facts, ['county', 'property_county']), 160);
  const state = scalarString(firstValue(facts, ['state', 'property_state']), 20);
  if (!county || !state) return null;
  const normalizedCounty = county.replace(/\s+County$/i, '').trim();
  return `${normalizedCounty}, ${state.toUpperCase()}`;
}

function stateValue(facts: Record<string, unknown>): string | null {
  const state = scalarString(firstValue(facts, ['state', 'property_state']), 20);
  return state && /^[A-Za-z]{2}$/.test(state.trim()) ? state.trim().toUpperCase() : null;
}

export function isKnownStateOutsideAllowedGeographies(
  facts: Record<string, unknown>,
  allowedValues: unknown[],
): boolean {
  const state = stateValue(facts);
  const allowedStates = allowedGeographyStates(allowedValues);
  return Boolean(state && allowedStates.size > 0 && !allowedStates.has(state));
}

function allowedGeographyStates(values: unknown[]): Set<string> {
  const states = new Set<string>();
  for (const value of values) {
    const text = scalarString(value, 200);
    if (!text) continue;
    const match = text.match(/,\s*([A-Za-z]{2})\s*$/);
    if (match) states.add(match[1].toUpperCase());
  }
  return states;
}

function canonicalPropertyType(value: unknown, units: number | null): string | null {
  const raw = normalizedToken(value) ?? '';
  if (/rv park|recreational vehicle park/.test(raw)) return 'rv_park';
  if (/mobile home park|\bmhp\b/.test(raw)) return 'mhp';
  if (/condo|condominium/.test(raw)) return 'condo';
  if (/manufactured home|mobile home/.test(raw)) return 'mobile_home';
  if (/duplex|triplex|fourplex|2 4|small multifamily/.test(raw) || (units !== null && units >= 2 && units <= 4)) {
    return 'small_multifamily';
  }
  if (/multi family|multifamily|apartment/.test(raw) && (units === null || units >= 5)) return 'multifamily';
  if (/single family|\bsfr\b|detached|townhouse|townhome|attached/.test(raw) || units === 1) return 'single_family';
  return null;
}

function comparisonToken(field: string, value: unknown): string {
  if (field === 'property_type') return canonicalPropertyType(value, null) ?? '';
  if (field === 'geography') {
    return scalarString(value, 200)?.toLowerCase().replace(/\s+/g, ' ').trim() ?? '';
  }
  return normalizedToken(value) ?? '';
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 0) return false;
    if (value === 1) return true;
    return null;
  }
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (['false', 'no', 'none', 'n/a', 'no hoa', 'not applicable', '0'].includes(normalized)) return false;
  if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
  return null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,%\s,]/g, '');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function recordValue(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : null;
}

function firstValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function hasAnyFact(record: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => {
    const value = record[key];
    return value !== undefined && value !== null && value !== '';
  });
}

function normalizedToken(value: unknown): string | null {
  const scalar = scalarString(value, 200);
  return scalar
    ? scalar.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
    : null;
}

function scalarString(value: unknown, max: number): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, max) : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).slice(0, max);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
