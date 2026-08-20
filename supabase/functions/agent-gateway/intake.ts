import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import {
  createGhlContact,
  createGhlContactNote,
  createGhlOpportunity,
  getGhlContact,
  getGhlOpportunity,
  listGhlContactNotes,
  searchGhlContacts,
  searchGhlOpportunities,
  updateGhlOpportunity,
  type GhlContext,
} from '../_shared/ghl.ts';

const SFR_PIPELINE_ID = 'w3OtDJjCdN840Hwb1fpt';
const SFR_STAGE_ID = 'a4842558-034c-4ba7-acf3-ed000673f7d6';
const PORTFOLIO_PIPELINE_ID = 'K6YsnZw6qhYLvXSvuixD';
const PORTFOLIO_STAGE_ID = '4513320f-0972-4b4a-9e37-dee4d71e1843';

/**
 * Existing HighLevel opportunity fields only. Ema must never create new CRM
 * fields or new dropdown values during intake.
 */
const FIELD_IDS = {
  property_type: '36WeaPwncmXLzUQhbGHd',
  full_address: 'hH02pevCKOTpmDYfOTnu',
  deal_type: 'SLOZCx6t83950AfnuPqO',
  deal_details: '01yCBq5RVjHvCuAFCFVY',
  photos_zillow: 'kgMWUBZEmTutUT9neFN9',
  criteria_met: 'ZiBig9Dpp37wCsr2hL9G',
  listed: '650RG6IFagUe3STMpFYu',
  condition: 'mDmONnuCOpGGzdYTHodv',
  motivation: '7gob9JukkaLf8DCYCZSE',
  asking_price: 'hVo62cSBHESpSpJQ2QoX',
  timeline: 'BTXkC4oHbvE7cczlZnaP',
  occupancy: '24s6rwssx0W3093tEo2h',
  hoa: 'PR32yVuxmSeYGiAbaCkv',
  hoa_amount: 'BFNjLczMo7vYEnHlSbck',
  hoa_duration: 'ejOAWgQ2iduRGGJfBSDL',
  hoa_restrictions: 'o8OJwL6sL5cp3e8yOlHG',
  mortgage_status: '611ub7w9MMhUqwbe2bj0',
  mortgage_balance: 'WfVQ5inw4CoaFYQ5PsAW',
  piti: 'mtYnZP37vV0uOTkPfceQ',
  arrears: 'dsOJSTUvwgUgqYMtrO2m',
  flood_utilities: 'Xjbfg8zqPgLmC2iyugTC',
  source_documents: 'smOq4IoCpUby2DBlb21G',
} as const;

export const PROPERTY_TYPE_OPTIONS = [
  'Single Family Residence',
  'Multi-family 2-4 Units',
  'Multi-family 5+',
  'Townhouse',
  'Condo',
  'Mobile Home',
  'Mobile Home Park',
  'RV Park',
  'Land',
  'Commercial',
  'Portfolio',
  'Attached',
] as const;

type PropertyTypeOption = typeof PROPERTY_TYPE_OPTIONS[number];

const SUBJECT_LIKE_ADDRESS = /\b(new lead|price drop|property info request|properties available|business for sale|off market opportunity)\b/i;

const DEDICATED_FACT_KEYS = new Set([
  'property_type', 'propertyType', 'asset_class', 'assetClass', 'type',
  'asking_price', 'askingPrice', 'price',
  'occupancy', 'occupancy_status',
  'mortgage_status', 'mortgageStatus',
  'mortgage_balance', 'mortgageBalance',
  'back_payments', 'arrears', 'backPayments',
  'piti', 'PITI',
  'timeline', 'seller_timeline',
  'motivation', 'seller_motivation',
  'condition', 'property_condition',
  'hoa', 'has_hoa', 'hoa_exists',
  'hoa_amount', 'hoaAmount',
  'hoa_restrictions', 'hoaRestrictions',
  'hoa_frequency', 'hoa_duration', 'hoaFrequency',
  'listed_with_realtor', 'listed', 'listing_status',
  'flood_and_utilities_info', 'flood_utilities',
  'deal_type', 'dealType',
  'photos_zillow', 'photos_url', 'zillow_url', 'deal_room_url',
  'criteria_met', 'criteriaMet',
]);

export class DealIntakeError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
    this.name = 'DealIntakeError';
  }
}

interface CandidateRow {
  id: string;
  workspace_id: string;
  ema_message_id: string;
  normalized_address: string | null;
  extracted_facts: Record<string, unknown>;
  evidence: Record<string, unknown>;
  source_type: string | null;
  intake_result: string | null;
  cash_screen_result: string;
  buy_box_fit_result: string;
  buy_box_fit_details: Record<string, unknown>;
  ghl_readiness: string;
  ghl_contact_id: string | null;
  ghl_opportunity_id: string | null;
  processing_status: string;
  is_test: boolean;
}

interface MessageRow {
  id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  sender_email: string | null;
  sender_name: string | null;
  subject: string | null;
  raw_metadata: Record<string, unknown>;
}

interface Route {
  propertyType: PropertyTypeOption;
  pipelineId: string;
  stageId: string;
}

interface OperationRow {
  id: string;
  operation_status: string;
  external_id: string | null;
}

export async function intakeCandidateToCrm(
  admin: SupabaseClient,
  ghl: GhlContext,
  workspaceId: string,
  candidateId: string,
): Promise<Record<string, unknown>> {
  const candidate = await loadCandidate(admin, workspaceId, candidateId);
  const message = await loadMessage(admin, workspaceId, candidate.ema_message_id);
  validateCandidate(candidate);

  const address = candidate.normalized_address!.trim();
  const route = deriveRoute(candidate.extracted_facts);
  const customFields = buildOpportunityCustomFields(candidate, address, route);

  await admin.from('ema_candidates').update({
    processing_status: 'ghl_pending',
    last_evaluated_at: new Date().toISOString(),
  }).eq('id', candidate.id).eq('workspace_id', workspaceId);

  const contact = await resolveContact(admin, ghl, candidate, message);
  const opportunity = await resolveOpportunity(
    admin,
    ghl,
    candidate,
    address,
    route,
    contact.id,
    customFields,
  );
  const note = await ensureIntakeNote(
    admin,
    ghl,
    candidate,
    message,
    address,
    contact.id,
    opportunity.id,
    opportunity.created,
  );

  const { error } = await admin.from('ema_candidates').update({
    ghl_contact_id: contact.id,
    ghl_opportunity_id: opportunity.id,
    ghl_readiness: 'ready',
    processing_status: 'completed',
    last_evaluated_at: new Date().toISOString(),
  }).eq('id', candidate.id).eq('workspace_id', workspaceId);
  if (error) throw new DealIntakeError(500, 'candidate_persist_failed');

  const qualificationSource = isEmaCrmIntakeEligible(candidate.buy_box_fit_result)
    ? 'ema_buy_box_fit'
    : 'cash_screen';

  return {
    candidate_id: candidate.id,
    qualification: {
      source: qualificationSource,
      buy_box_fit_result: candidate.buy_box_fit_result,
      verification_status: recordString(candidate.buy_box_fit_details, 'verification_status'),
      cash_verdict: candidate.cash_screen_result,
    },
    contact: { id: contact.id, disposition: contact.disposition },
    opportunity: {
      id: opportunity.id,
      disposition: opportunity.created ? 'created' : 'matched',
      pipeline_id: opportunity.pipelineId,
      stage_id: opportunity.stageId,
      property_type: route.propertyType,
    },
    note: {
      id: note.id,
      target: 'contact',
      opportunity_id: opportunity.id,
      disposition: note.disposition,
    },
  };
}

async function loadCandidate(admin: SupabaseClient, w: string, id: string): Promise<CandidateRow> {
  const { data, error } = await admin.from('ema_candidates').select(
    'id, workspace_id, ema_message_id, normalized_address, extracted_facts, evidence, source_type, intake_result, cash_screen_result, buy_box_fit_result, buy_box_fit_details, ghl_readiness, ghl_contact_id, ghl_opportunity_id, processing_status, is_test',
  ).eq('id', id).eq('workspace_id', w).maybeSingle();
  if (error) throw new DealIntakeError(500, 'candidate_lookup_failed');
  if (!data) throw new DealIntakeError(404, 'candidate_not_found');
  return data as CandidateRow;
}

async function loadMessage(admin: SupabaseClient, w: string, id: string): Promise<MessageRow> {
  const { data, error } = await admin.from('ema_messages').select(
    'id, gmail_message_id, gmail_thread_id, sender_email, sender_name, subject, raw_metadata',
  ).eq('id', id).eq('workspace_id', w).maybeSingle();
  if (error) throw new DealIntakeError(500, 'ema_message_lookup_failed');
  if (!data) throw new DealIntakeError(409, 'ema_message_missing');
  return data as MessageRow;
}

function validateCandidate(c: CandidateRow): void {
  if (c.is_test) throw new DealIntakeError(409, 'test_candidate_not_permitted');
  const emaCrmEligible = isEmaCrmIntakeEligible(c.buy_box_fit_result);
  const cashQualified = ['pass', 'marginal'].includes(c.cash_screen_result);
  if (!emaCrmEligible && !cashQualified) {
    throw new DealIntakeError(409, 'deal_qualification_required');
  }
  if (['excluded', 'needs_classification', 'needs_info'].includes(c.intake_result ?? '') || c.ghl_readiness === 'excluded') {
    throw new DealIntakeError(409, 'candidate_not_intake_eligible');
  }
  if (!looksLikeResolvedAddress(c.normalized_address?.trim() ?? '')) {
    throw new DealIntakeError(409, 'normalized_address_required');
  }
}

export function isEmaCrmIntakeEligible(result: string): boolean {
  return result === 'fit' || result === 'needs_info';
}

export function looksLikeResolvedAddress(a: string): boolean {
  if (a.length < 8 || a.length > 300 || SUBJECT_LIKE_ADDRESS.test(a)) return false;
  return /^\s*\d{1,8}\s+[A-Za-z0-9]/.test(a);
}

/**
 * Converts Ema's normalized property vocabulary into the exact pre-existing
 * HighLevel Property Type dropdown values supplied by the acquisitions team.
 */
export function deriveRoute(f: Record<string, unknown>): Route {
  const raw = cleanString(
    firstValue(f, ['property_type', 'propertyType', 'asset_class', 'assetClass', 'type']),
    120,
  )?.toLowerCase() ?? '';
  const units = numberValue(firstValue(f, [
    'units', 'unit_count', 'unitCount', 'number_of_units', 'site_count', 'pad_count',
  ]));

  if (/\brv\s*park\b|recreational vehicle park/.test(raw)) {
    return portfolioRoute('RV Park');
  }
  if (/mobile\s*home\s*park|\bmhp\b/.test(raw)) {
    return portfolioRoute('Mobile Home Park');
  }
  if (/town\s*house|townhome/.test(raw)) {
    return sfrRoute('Townhouse');
  }
  if (/\bcondo(minium)?\b/.test(raw)) {
    return sfrRoute('Condo');
  }
  if (/\bmobile\s*home\b|manufactured\s*home/.test(raw)) {
    return sfrRoute('Mobile Home');
  }
  if (/attached/.test(raw) && !/multi/.test(raw)) {
    return sfrRoute('Attached');
  }
  if (/duplex|triplex|fourplex|2\s*[-–]\s*4|multi[- ]?family\s*2/.test(raw) ||
      (units !== null && units >= 2 && units <= 4)) {
    return sfrRoute('Multi-family 2-4 Units');
  }
  if (/multi[- ]?family|apartment/.test(raw) && (units === null || units >= 5)) {
    return portfolioRoute('Multi-family 5+');
  }
  if (/\bland\b|vacant\s*lot|development\s*site/.test(raw)) {
    return portfolioRoute('Land');
  }
  if (/commercial|retail|office|industrial|strip\s*center/.test(raw)) {
    return portfolioRoute('Commercial');
  }
  if (/portfolio|package|bulk\s*(sale|deal)/.test(raw)) {
    return portfolioRoute('Portfolio');
  }
  if (/single[- ]?family|\bsfr\b|detached/.test(raw) || units === 1) {
    return sfrRoute('Single Family Residence');
  }

  throw new DealIntakeError(409, 'property_type_unresolved');
}

function sfrRoute(propertyType: PropertyTypeOption): Route {
  return { propertyType, pipelineId: SFR_PIPELINE_ID, stageId: SFR_STAGE_ID };
}

function portfolioRoute(propertyType: PropertyTypeOption): Route {
  return { propertyType, pipelineId: PORTFOLIO_PIPELINE_ID, stageId: PORTFOLIO_STAGE_ID };
}

async function resolveContact(
  admin: SupabaseClient,
  ghl: GhlContext,
  c: CandidateRow,
  m: MessageRow,
): Promise<{ id: string; disposition: 'matched' | 'created' | 'persisted' }> {
  if (c.ghl_contact_id) {
    const x = await getGhlContact(ghl, c.ghl_contact_id);
    if (!x.id) throw new DealIntakeError(409, 'persisted_contact_invalid');
    return { id: x.id, disposition: 'persisted' };
  }

  const email = cleanString(m.sender_email, 320)?.toLowerCase() ?? null;
  if (!email) throw new DealIntakeError(409, 'sender_identity_required');

  const es = await searchGhlContacts(ghl, { query: email, page: 1, limit: 20 });
  const em = recordArray(es.contacts).filter((r) => cleanString(r.email, 320)?.toLowerCase() === email);
  if (em.length > 1) throw new DealIntakeError(409, 'contact_match_ambiguous');
  if (em.length === 1) return { id: requiredId(em[0].id), disposition: 'matched' };

  const phone = cleanString(firstValue(c.extracted_facts, ['sender_phone', 'phone', 'broker_phone']), 64);
  if (phone) {
    const ps = await searchGhlContacts(ghl, { query: phone, page: 1, limit: 20 });
    const normalized = normalizePhone(phone);
    const pm = recordArray(ps.contacts).filter((r) =>
      normalizePhone(cleanString(r.phone, 64) ?? '') === normalized
    );
    if (pm.length > 1) throw new DealIntakeError(409, 'contact_match_ambiguous');
    if (pm.length === 1) return { id: requiredId(pm[0].id), disposition: 'matched' };
  }

  const key = `ema:${c.id}:contact:v1`;
  const prior = await getOperation(admin, c.workspace_id, key);
  if (prior?.operation_status === 'succeeded' && prior.external_id) {
    return { id: prior.external_id, disposition: 'persisted' };
  }
  if (prior && ['executing', 'needs_reconciliation'].includes(prior.operation_status)) {
    throw new DealIntakeError(409, 'contact_create_requires_reconciliation');
  }

  const op = await beginOperation(admin, c, 'ghl_contact_upsert', key);
  try {
    const made = await createGhlContact(ghl, {
      firstName: firstName(m.sender_name),
      lastName: lastName(m.sender_name),
      name: cleanString(m.sender_name, 300),
      email,
      phone,
      companyName: cleanString(firstValue(c.extracted_facts, ['sender_company', 'company', 'broker_company']), 300),
      source: 'Ema Email Intake',
      tags: controlledContactTags(c),
    });
    const id = requiredId(made.id);
    await finishOperation(admin, op.id, id, { created: true });
    return { id, disposition: 'created' };
  } catch (e) {
    await markOperationUncertain(admin, op.id, e);
    throw e;
  }
}

async function resolveOpportunity(
  admin: SupabaseClient,
  ghl: GhlContext,
  c: CandidateRow,
  address: string,
  route: Route,
  contactId: string,
  customFields: Array<Record<string, unknown>>,
): Promise<{ id: string; created: boolean; pipelineId: string; stageId: string }> {
  if (c.ghl_opportunity_id) {
    const x = await getGhlOpportunity(ghl, c.ghl_opportunity_id);
    const id = requiredId(x.id);
    const existingContact = cleanString(x.contact_id, 128);
    if (existingContact && existingContact !== contactId) {
      throw new DealIntakeError(409, 'persisted_opportunity_contact_mismatch');
    }
    if (customFields.length) await updateExistingOpportunityFields(admin, ghl, c, id, customFields);
    return {
      id,
      created: false,
      pipelineId: requiredId(x.pipeline_id),
      stageId: requiredId(x.stage_id),
    };
  }

  const search = await searchGhlOpportunities(ghl, { query: address, page: 1, limit: 50 });
  const exact = recordArray(search.opportunities).filter((r) =>
    canonicalAddress(cleanString(r.name, 500) ?? '') === canonicalAddress(address)
  );
  if (exact.length > 1) throw new DealIntakeError(409, 'opportunity_match_ambiguous');
  if (exact.length === 1) {
    const r = exact[0];
    const id = requiredId(r.id);
    const foundContact = cleanString(r.contact_id, 128);
    if (foundContact && foundContact !== contactId) {
      throw new DealIntakeError(409, 'opportunity_contact_mismatch');
    }
    if (customFields.length) await updateExistingOpportunityFields(admin, ghl, c, id, customFields);
    return {
      id,
      created: false,
      pipelineId: requiredId(r.pipeline_id),
      stageId: requiredId(r.stage_id),
    };
  }

  const key = `ema:${c.id}:opportunity:v1`;
  const prior = await getOperation(admin, c.workspace_id, key);
  if (prior?.operation_status === 'succeeded' && prior.external_id) {
    const x = await getGhlOpportunity(ghl, prior.external_id);
    return {
      id: prior.external_id,
      created: false,
      pipelineId: requiredId(x.pipeline_id),
      stageId: requiredId(x.stage_id),
    };
  }
  if (prior && ['executing', 'needs_reconciliation'].includes(prior.operation_status)) {
    throw new DealIntakeError(409, 'opportunity_create_requires_reconciliation');
  }

  const op = await beginOperation(admin, c, 'ghl_opportunity_create', key);
  try {
    const made = await createGhlOpportunity(ghl, {
      pipelineId: route.pipelineId,
      pipelineStageId: route.stageId,
      name: address,
      status: 'open',
      contactId,
      customFields,
    });
    const id = requiredId(made.id);
    await finishOperation(admin, op.id, id, {
      pipeline_id: route.pipelineId,
      stage_id: route.stageId,
    });
    return {
      id,
      created: true,
      pipelineId: route.pipelineId,
      stageId: route.stageId,
    };
  } catch (e) {
    await markOperationUncertain(admin, op.id, e);
    throw e;
  }
}

async function updateExistingOpportunityFields(
  admin: SupabaseClient,
  ghl: GhlContext,
  c: CandidateRow,
  id: string,
  fields: Array<Record<string, unknown>>,
): Promise<void> {
  // v2 intentionally refreshes opportunities created before CRM fidelity rules.
  const key = `ema:${c.id}:opportunity-fields:v2`;
  const prior = await getOperation(admin, c.workspace_id, key);
  if (prior?.operation_status === 'succeeded') return;
  if (prior && ['executing', 'needs_reconciliation'].includes(prior.operation_status)) {
    throw new DealIntakeError(409, 'opportunity_update_requires_reconciliation');
  }

  const op = await beginOperation(admin, c, 'ghl_opportunity_update', key);
  try {
    await updateGhlOpportunity(ghl, id, { customFields: fields });
    await finishOperation(admin, op.id, id, { fields_updated: fields.length, contract: 'crm_fidelity_v2' });
  } catch (e) {
    await markOperationUncertain(admin, op.id, e);
    throw e;
  }
}

async function ensureIntakeNote(
  admin: SupabaseClient,
  ghl: GhlContext,
  c: CandidateRow,
  m: MessageRow,
  address: string,
  contactId: string,
  oppId: string,
  created: boolean,
): Promise<{ id: string; disposition: 'created' | 'reconciled' | 'persisted' }> {
  const body = buildNoteBody(c, m, address, oppId, created ? 'INITIAL REVIEW' : 'NEW INFORMATION');
  const key = `ema:${m.gmail_message_id}:${oppId}:note:v1`;
  const prior = await getOperation(admin, c.workspace_id, key);
  if (prior?.operation_status === 'succeeded' && prior.external_id) {
    return { id: prior.external_id, disposition: 'persisted' };
  }

  const notes = await listGhlContactNotes(ghl, contactId);
  const marker = `Intake Ref: ${c.id}`;
  const existing = recordArray(notes.notes).find((r) => cleanString(r.body, 5000)?.includes(marker));
  if (existing) {
    const id = requiredId(existing.id);
    if (prior) await finishOperation(admin, prior.id, id, { reconciled: true });
    return { id, disposition: 'reconciled' };
  }
  if (prior && ['executing', 'needs_reconciliation'].includes(prior.operation_status)) {
    throw new DealIntakeError(409, 'note_create_requires_reconciliation');
  }

  const op = await beginOperation(admin, c, 'ghl_opportunity_note_create', key);
  try {
    const made = await createGhlContactNote(ghl, contactId, body);
    const id = requiredId(made.id);
    await finishOperation(admin, op.id, id, { target: 'contact', opportunity_id: oppId });
    return { id, disposition: 'created' };
  } catch (e) {
    await markOperationUncertain(admin, op.id, e);
    throw e;
  }
}

export function buildOpportunityCustomFields(
  c: Pick<CandidateRow, 'extracted_facts' | 'evidence'>,
  address: string,
  route: Route,
): Array<Record<string, unknown>> {
  const f = c.extracted_facts;
  const out: Array<Record<string, unknown>> = [];

  addField(out, FIELD_IDS.property_type, route.propertyType);
  addField(out, FIELD_IDS.full_address, address);

  const mappings: Array<[string, string[]]> = [
    [FIELD_IDS.deal_type, ['deal_type', 'dealType']],
    [FIELD_IDS.photos_zillow, ['photos_zillow', 'photos_url', 'zillow_url', 'deal_room_url']],
    [FIELD_IDS.listed, ['listed_with_realtor', 'listed', 'listing_status']],
    [FIELD_IDS.condition, ['condition', 'property_condition']],
    [FIELD_IDS.motivation, ['motivation', 'seller_motivation']],
    [FIELD_IDS.asking_price, ['asking_price', 'askingPrice', 'price']],
    [FIELD_IDS.timeline, ['timeline', 'seller_timeline']],
    [FIELD_IDS.occupancy, ['occupancy', 'occupancy_status']],
    [FIELD_IDS.hoa, ['hoa', 'has_hoa', 'hoa_exists']],
    [FIELD_IDS.hoa_amount, ['hoa_amount', 'hoaAmount']],
    [FIELD_IDS.hoa_duration, ['hoa_frequency', 'hoa_duration', 'hoaFrequency']],
    [FIELD_IDS.hoa_restrictions, ['hoa_restrictions', 'hoaRestrictions']],
    [FIELD_IDS.mortgage_status, ['mortgage_status', 'mortgageStatus']],
    [FIELD_IDS.mortgage_balance, ['mortgage_balance', 'mortgageBalance']],
    [FIELD_IDS.piti, ['piti', 'PITI']],
    [FIELD_IDS.arrears, ['back_payments', 'arrears', 'backPayments']],
    [FIELD_IDS.flood_utilities, ['flood_and_utilities_info', 'flood_utilities']],
  ];
  for (const [id, keys] of mappings) addField(out, id, firstValue(f, keys));

  const criteria = firstValue(f, ['criteria_met', 'criteriaMet']);
  if (Array.isArray(criteria) && criteria.every((item) => typeof item === 'string')) {
    out.push({ id: FIELD_IDS.criteria_met, fieldValue: criteria.slice(0, 20) });
  }

  const details = buildDealDetails(f, c.evidence);
  if (details) addField(out, FIELD_IDS.deal_details, details, 5000);
  return out;
}

/**
 * Any source-backed fact without a dedicated HighLevel field belongs in Deal
 * Details. This prevents extraction from being richer than the CRM record.
 */
export function buildDealDetails(
  facts: Record<string, unknown>,
  evidence: Record<string, unknown> = {},
): string | null {
  const lines: string[] = [];
  const skipKeys = new Set(['arv_range_low', 'arv_range_high']);

  const arvLow = numberValue(firstValue(facts, ['arv_range_low', 'arv_low']));
  const arvHigh = numberValue(firstValue(facts, ['arv_range_high', 'arv_high']));

  for (const [key, value] of Object.entries(facts)) {
    if (DEDICATED_FACT_KEYS.has(key) || skipKeys.has(key)) continue;
    const rendered = formatDetailValue(key, value);
    if (rendered !== null) lines.push(`${humanizeKey(key)}: ${rendered}`);
  }

  if (arvLow !== null || arvHigh !== null) {
    const low = arvLow !== null ? formatCurrency(arvLow) : 'Unknown';
    const high = arvHigh !== null ? formatCurrency(arvHigh) : 'Unknown';
    lines.push(`ARV Range: ${low} - ${high}`);
  }

  const conflicts = recordAt(evidence, 'source_conflict');
  const conflictLines = Object.entries(conflicts).flatMap(([key, value]) => {
    const text = scalarString(value, 1000);
    return text ? [`${humanizeKey(key)}: ${text}`] : [];
  });
  if (conflictLines.length) {
    if (lines.length) lines.push('');
    lines.push('Source Discrepancies:');
    lines.push(...conflictLines);
  }

  if (!lines.length) return null;
  return lines.join('\n').slice(0, 5000);
}

function buildNoteBody(
  c: CandidateRow,
  m: MessageRow,
  address: string,
  oppId: string,
  event: string,
): string {
  const f = c.extracted_facts;
  const lines = [`EMA | ${address} | ${event}`, ''];

  if (c.buy_box_fit_result === 'fit') {
    const verification = recordString(c.buy_box_fit_details, 'verification_status') ?? 'provisional';
    lines.push(`Preliminary Buy-Box Fit: FIT (${verification.toUpperCase()})`);
  } else if (c.buy_box_fit_result === 'needs_info') {
    lines.push('Preliminary Buy-Box Fit: NEEDS INFO (TEAM REVIEW)');
    const missing = buyBoxUnknownFields(c.buy_box_fit_details);
    if (missing.length) lines.push(`Missing/Unknown: ${missing.join(', ')}`);
  } else if (['pass', 'marginal'].includes(c.cash_screen_result)) {
    lines.push(`Cash Screen: ${c.cash_screen_result.toUpperCase()}`);
  }

  lines.push('Source: Email');
  if (m.sender_name) lines.push(`Sender: ${m.sender_name.slice(0, 200)}`);
  if (m.sender_email) lines.push(`Sender Email: ${m.sender_email.slice(0, 320)}`);

  const summaryFields: Array<[string, string[]]> = [
    ['Asking Price', ['asking_price', 'askingPrice', 'price']],
    ['Property Type', ['property_type', 'propertyType', 'asset_class']],
    ['Occupancy', ['occupancy', 'occupancy_status']],
  ];
  for (const [label, keys] of summaryFields) {
    const value = scalarString(firstValue(f, keys), 160);
    if (value) lines.push(`${label}: ${value}`);
  }

  lines.push(
    '',
    `Opportunity ID: ${oppId}`,
    `Gmail Message: ${m.gmail_message_id.slice(0, 300)}`,
    `Intake Ref: ${c.id}`,
  );
  return lines.join('\n').slice(0, 5000);
}

function buyBoxUnknownFields(details: Record<string, unknown>): string[] {
  return recordArray(details.unknown).flatMap((r) => {
    const field = cleanString(r.field, 120);
    return field ? [field] : [];
  });
}

function controlledContactTags(c: CandidateRow): string[] {
  const status = c.buy_box_fit_result === 'needs_info'
    ? 'ema-needs-info'
    : (c.buy_box_fit_result === 'fit' || c.cash_screen_result === 'pass')
    ? 'ema-qualified'
    : 'ema-marginal';
  const tags = ['email-lead', status];
  const source = c.source_type?.toLowerCase() ?? '';
  if (source.includes('broker')) tags.push('broker');
  else if (source.includes('wholesale')) tags.push('wholesaler');
  else if (source.includes('seller')) tags.push('direct-seller');
  else if (source.includes('agent')) tags.push('agent');
  else if (source.includes('lender')) tags.push('lender');
  return tags;
}

async function getOperation(admin: SupabaseClient, w: string, key: string): Promise<OperationRow | null> {
  const { data, error } = await admin.from('ema_operations').select(
    'id, operation_status, external_id',
  ).eq('workspace_id', w).eq('operating_mode', 'autonomous').eq('idempotency_key', key).maybeSingle();
  if (error) throw new DealIntakeError(500, 'ema_operation_lookup_failed');
  return data as OperationRow | null;
}

async function beginOperation(
  admin: SupabaseClient,
  c: CandidateRow,
  type: string,
  key: string,
): Promise<OperationRow> {
  const { data, error } = await admin.from('ema_operations').insert({
    workspace_id: c.workspace_id,
    ema_message_id: c.ema_message_id,
    ema_candidate_id: c.id,
    operating_mode: 'autonomous',
    operation_type: type,
    idempotency_key: key,
    operation_status: 'executing',
    request_metadata: { source: 'agent_gateway', contract: 'deal.intake_to_crm.v2' },
    attempt_count: 1,
    is_test: false,
  }).select('id, operation_status, external_id').single();
  if (error || !data) throw new DealIntakeError(500, 'ema_operation_create_failed');
  return data as OperationRow;
}

async function finishOperation(
  admin: SupabaseClient,
  id: string,
  externalId: string,
  meta: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.from('ema_operations').update({
    operation_status: 'succeeded',
    external_id: externalId,
    result_metadata: meta,
    last_error: null,
  }).eq('id', id);
  if (error) throw new DealIntakeError(500, 'ema_operation_update_failed');
}

async function markOperationUncertain(admin: SupabaseClient, id: string, e: unknown): Promise<void> {
  await admin.from('ema_operations').update({
    operation_status: 'needs_reconciliation',
    last_error: e instanceof Error ? e.name.slice(0, 120) : 'upstream_error',
  }).eq('id', id);
}

function addField(
  target: Array<Record<string, unknown>>,
  id: string,
  value: unknown,
  max = 3000,
): void {
  const rendered = scalarString(value, max);
  if (rendered !== null) target.push({ id, fieldValue: rendered });
}

function firstValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function scalarString(value: unknown, max: number): string | null {
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? text.slice(0, max) : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).slice(0, max);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return null;
}

function cleanString(value: unknown, max: number): string | null {
  return scalarString(value, max);
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatDetailValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (/(price|arv|rent|balance|piti|amount|repairs|noi|income|expense)/i.test(key)) {
      return formatCurrency(value);
    }
    return value.toLocaleString('en-US');
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value.trim().slice(0, 1000) || null;
  if (Array.isArray(value)) {
    const values = value.flatMap((item) => scalarString(item, 300) ? [scalarString(item, 300)!] : []);
    return values.length ? values.join(', ').slice(0, 1000) : null;
  }
  return null;
}

function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function humanizeKey(key: string): string {
  const known: Record<string, string> = {
    sqft: 'Square Feet',
    lot_size_sqft: 'Lot Size',
    year_built: 'Year Built',
    tenant_rent_monthly: 'Tenant Rent / Month',
    arv: 'Estimated ARV',
    email_arv: 'Email ARV',
    email_asking_price: 'Email Asking Price',
    bedrooms: 'Bedrooms',
    bathrooms: 'Bathrooms',
    units: 'Units',
    sites: 'Sites',
    pads: 'Pads',
    zip: 'ZIP',
  };
  if (known[key]) return known[key];
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x))
    : [];
}

function recordAt(value: Record<string, unknown>, key: string): Record<string, unknown> {
  const candidate = value[key];
  return candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : {};
}

function requiredId(value: unknown): string {
  const id = cleanString(value, 128);
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new DealIntakeError(502, 'invalid_ghl_identifier');
  }
  return id;
}

function canonicalAddress(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '').slice(-10);
}

function firstName(name: string | null): string | null {
  const clean = cleanString(name, 300);
  return clean ? clean.split(/\s+/)[0].slice(0, 100) : null;
}

function lastName(name: string | null): string | null {
  const clean = cleanString(name, 300);
  if (!clean) return null;
  const parts = clean.split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ').slice(0, 150) : null;
}

function recordString(value: Record<string, unknown>, key: string): string | null {
  return typeof value[key] === 'string' ? String(value[key]).slice(0, 160) : null;
}
