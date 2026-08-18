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

const FIELD_IDS = {
  property_type: '36WeaPwncmXLzUQhbGHd',
  asking_price: 'hVo62cSBHESpSpJQ2QoX',
  full_address: 'hH02pevCKOTpmDYfOTnu',
  zip: 'BXGXMg5dA8kfSVEsYjwI',
  state: 'TNuP3h0jHhlwLWUSNK2x',
  county: 'tsyE3j0AnrAmac5aTaeb',
  occupancy: '24s6rwssx0W3093tEo2h',
  mortgage_status: '611ub7w9MMhUqwbe2bj0',
  mortgage_balance: 'WfVQ5inw4CoaFYQ5PsAW',
  arrears: 'dsOJSTUvwgUgqYMtrO2m',
  piti: 'mtYnZP37vV0uOTkPfceQ',
  timeline: 'BTXkC4oHbvE7cczlZnaP',
  motivation: '7gob9JukkaLf8DCYCZSE',
  condition: 'mDmONnuCOpGGzdYTHodv',
  hoa: 'PR32yVuxmSeYGiAbaCkv',
  hoa_amount: 'BFNjLczMo7vYEnHlSbck',
  hoa_restrictions: 'o8OJwL6sL5cp3e8yOlHG',
  hoa_duration: 'ejOAWgQ2iduRGGJfBSDL',
  listed: '650RG6IFagUe3STMpFYu',
  flood_utilities: 'Xjbfg8zqPgLmC2iyugTC',
  deal_details: '01yCBq5RVjHvCuAFCFVY',
  deal_type: 'SLOZCx6t83950AfnuPqO',
  photos_zillow: 'kgMWUBZEmTutUT9neFN9',
} as const;

const SUBJECT_LIKE_ADDRESS = /\b(new lead|price drop|property info request|properties available|business for sale|off market opportunity)\b/i;

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
  propertyType: string;
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

  const { error: candidateUpdateError } = await admin.from('ema_candidates').update({
    ghl_contact_id: contact.id,
    ghl_opportunity_id: opportunity.id,
    ghl_readiness: 'ready',
    processing_status: 'completed',
    last_evaluated_at: new Date().toISOString(),
  }).eq('id', candidate.id).eq('workspace_id', workspaceId);
  if (candidateUpdateError) {
    throw new DealIntakeError(500, 'candidate_persist_failed');
  }

  return {
    candidate_id: candidate.id,
    cash_verdict: candidate.cash_screen_result,
    contact: { id: contact.id, disposition: contact.disposition },
    opportunity: {
      id: opportunity.id,
      disposition: opportunity.created ? 'created' : 'matched',
      pipeline_id: opportunity.pipelineId,
      stage_id: opportunity.stageId,
    },
    note: {
      id: note.id,
      target: 'contact',
      opportunity_id: opportunity.id,
      disposition: note.disposition,
    },
  };
}

async function loadCandidate(
  admin: SupabaseClient,
  workspaceId: string,
  candidateId: string,
): Promise<CandidateRow> {
  const { data, error } = await admin.from('ema_candidates').select(
    'id, workspace_id, ema_message_id, normalized_address, extracted_facts, evidence, source_type, intake_result, cash_screen_result, ghl_readiness, ghl_contact_id, ghl_opportunity_id, processing_status, is_test',
  ).eq('id', candidateId).eq('workspace_id', workspaceId).maybeSingle();
  if (error) throw new DealIntakeError(500, 'candidate_lookup_failed');
  if (!data) throw new DealIntakeError(404, 'candidate_not_found');
  return data as CandidateRow;
}

async function loadMessage(
  admin: SupabaseClient,
  workspaceId: string,
  messageId: string,
): Promise<MessageRow> {
  const { data, error } = await admin.from('ema_messages').select(
    'id, gmail_message_id, gmail_thread_id, sender_email, sender_name, subject, raw_metadata',
  ).eq('id', messageId).eq('workspace_id', workspaceId).maybeSingle();
  if (error) throw new DealIntakeError(500, 'ema_message_lookup_failed');
  if (!data) throw new DealIntakeError(409, 'ema_message_missing');
  return data as MessageRow;
}

function validateCandidate(candidate: CandidateRow): void {
  if (candidate.is_test) throw new DealIntakeError(409, 'test_candidate_not_permitted');
  if (!['pass', 'marginal'].includes(candidate.cash_screen_result)) {
    throw new DealIntakeError(409, 'cash_approval_required');
  }
  if (['excluded', 'needs_classification', 'needs_info'].includes(candidate.intake_result ?? '')) {
    throw new DealIntakeError(409, 'candidate_not_intake_eligible');
  }
  if (candidate.ghl_readiness === 'excluded') {
    throw new DealIntakeError(409, 'candidate_not_intake_eligible');
  }
  const address = candidate.normalized_address?.trim() ?? '';
  if (!looksLikeResolvedAddress(address)) {
    throw new DealIntakeError(409, 'normalized_address_required');
  }
}

export function looksLikeResolvedAddress(address: string): boolean {
  if (address.length < 8 || address.length > 300) return false;
  if (!/\d/.test(address) || !/[A-Za-z]{2}/.test(address)) return false;
  return !SUBJECT_LIKE_ADDRESS.test(address);
}

export function deriveRoute(facts: Record<string, unknown>): Route {
  const rawType = cleanString(firstValue(facts, [
    'property_type', 'propertyType', 'asset_class', 'assetClass', 'type',
  ]), 120)?.toLowerCase() ?? '';
  const units = numberValue(firstValue(facts, [
    'units', 'unit_count', 'unitCount', 'number_of_units', 'site_count', 'pad_count',
  ]));

  if (/\brv\s*park\b|recreational vehicle park/.test(rawType)) {
    return { propertyType: 'RV Park', pipelineId: PORTFOLIO_PIPELINE_ID, stageId: PORTFOLIO_STAGE_ID };
  }
  if (/mobile\s*home\s*park|\bmhp\b/.test(rawType)) {
    return { propertyType: 'Mobile Home Park', pipelineId: PORTFOLIO_PIPELINE_ID, stageId: PORTFOLIO_STAGE_ID };
  }
  if (/town\s*house|townhome/.test(rawType)) {
    return { propertyType: 'Townhouse', pipelineId: SFR_PIPELINE_ID, stageId: SFR_STAGE_ID };
  }
  if (/attached/.test(rawType) && !/multi/.test(rawType)) {
    return { propertyType: 'Attached', pipelineId: SFR_PIPELINE_ID, stageId: SFR_STAGE_ID };
  }
  if (/duplex|triplex|fourplex|2\s*[-–]\s*4|multi[- ]?family\s*2/.test(rawType) || (units !== null && units >= 2 && units <= 4)) {
    return { propertyType: 'Multi-family 2-4', pipelineId: SFR_PIPELINE_ID, stageId: SFR_STAGE_ID };
  }
  if (/multi[- ]?family|apartment|multifamily/.test(rawType) && (units === null || units >= 5)) {
    return { propertyType: 'Multi-family 5+', pipelineId: PORTFOLIO_PIPELINE_ID, stageId: PORTFOLIO_STAGE_ID };
  }
  if (/single[- ]?family|\bsfr\b|detached/.test(rawType) || units === 1) {
    return { propertyType: 'SFR', pipelineId: SFR_PIPELINE_ID, stageId: SFR_STAGE_ID };
  }
  throw new DealIntakeError(409, 'property_type_unresolved');
}

async function resolveContact(
  admin: SupabaseClient,
  ghl: GhlContext,
  candidate: CandidateRow,
  message: MessageRow,
): Promise<{ id: string; disposition: 'matched' | 'created' | 'persisted' }> {
  if (candidate.ghl_contact_id) {
    const existing = await getGhlContact(ghl, candidate.ghl_contact_id);
    if (!existing.id) throw new DealIntakeError(409, 'persisted_contact_invalid');
    return { id: existing.id, disposition: 'persisted' };
  }

  const email = cleanString(message.sender_email, 320)?.toLowerCase() ?? null;
  if (!email) throw new DealIntakeError(409, 'sender_identity_required');

  const emailSearch = await searchGhlContacts(ghl, { query: email, page: 1, limit: 20 });
  const emailMatches = recordArray(emailSearch.contacts).filter((row) =>
    cleanString(row.email, 320)?.toLowerCase() === email
  );
  if (emailMatches.length > 1) throw new DealIntakeError(409, 'contact_match_ambiguous');
  if (emailMatches.length === 1) return { id: requiredId(emailMatches[0].id), disposition: 'matched' };

  const phone = cleanString(firstValue(candidate.extracted_facts, ['sender_phone', 'phone', 'broker_phone']), 64);
  if (phone) {
    const phoneSearch = await searchGhlContacts(ghl, { query: phone, page: 1, limit: 20 });
    const normalized = normalizePhone(phone);
    const phoneMatches = recordArray(phoneSearch.contacts).filter((row) =>
      normalizePhone(cleanString(row.phone, 64) ?? '') === normalized
    );
    if (phoneMatches.length > 1) throw new DealIntakeError(409, 'contact_match_ambiguous');
    if (phoneMatches.length === 1) return { id: requiredId(phoneMatches[0].id), disposition: 'matched' };
  }

  const operationKey = `ema:${candidate.id}:contact:v1`;
  const prior = await getOperation(admin, candidate.workspace_id, operationKey);
  if (prior?.operation_status === 'succeeded' && prior.external_id) {
    return { id: prior.external_id, disposition: 'persisted' };
  }
  if (prior && ['executing', 'needs_reconciliation'].includes(prior.operation_status)) {
    throw new DealIntakeError(409, 'contact_create_requires_reconciliation');
  }

  const operation = await beginOperation(admin, candidate, 'ghl_contact_upsert', operationKey);
  try {
    const created = await createGhlContact(ghl, {
      firstName: firstName(message.sender_name),
      lastName: lastName(message.sender_name),
      name: cleanString(message.sender_name, 300),
      email,
      phone,
      companyName: cleanString(firstValue(candidate.extracted_facts, ['sender_company', 'company', 'broker_company']), 300),
      source: 'Ema Email Intake',
      tags: controlledContactTags(candidate),
    });
    const id = requiredId(created.id);
    await finishOperation(admin, operation.id, id, { created: true });
    return { id, disposition: 'created' };
  } catch (error) {
    await markOperationUncertain(admin, operation.id, error);
    throw error;
  }
}

async function resolveOpportunity(
  admin: SupabaseClient,
  ghl: GhlContext,
  candidate: CandidateRow,
  address: string,
  route: Route,
  contactId: string,
  customFields: Array<Record<string, unknown>>,
): Promise<{ id: string; created: boolean; pipelineId: string; stageId: string }> {
  if (candidate.ghl_opportunity_id) {
    const existing = await getGhlOpportunity(ghl, candidate.ghl_opportunity_id);
    const id = requiredId(existing.id);
    const existingContactId = cleanString(existing.contact_id, 128);
    if (existingContactId && existingContactId !== contactId) {
      throw new DealIntakeError(409, 'persisted_opportunity_contact_mismatch');
    }
    if (customFields.length) {
      await updateExistingOpportunityFields(admin, ghl, candidate, id, customFields);
    }
    return {
      id,
      created: false,
      pipelineId: requiredId(existing.pipeline_id),
      stageId: requiredId(existing.stage_id),
    };
  }

  const searched = await searchGhlOpportunities(ghl, { query: address, page: 1, limit: 50 });
  const exact = recordArray(searched.opportunities).filter((row) =>
    canonicalAddress(cleanString(row.name, 500) ?? '') === canonicalAddress(address)
  );
  if (exact.length > 1) throw new DealIntakeError(409, 'opportunity_match_ambiguous');
  if (exact.length === 1) {
    const row = exact[0];
    const id = requiredId(row.id);
    const foundContactId = cleanString(row.contact_id, 128);
    if (foundContactId && foundContactId !== contactId) {
      throw new DealIntakeError(409, 'opportunity_contact_mismatch');
    }
    if (customFields.length) {
      await updateExistingOpportunityFields(admin, ghl, candidate, id, customFields);
    }
    return {
      id,
      created: false,
      pipelineId: requiredId(row.pipeline_id),
      stageId: requiredId(row.stage_id),
    };
  }

  const operationKey = `ema:${candidate.id}:opportunity:v1`;
  const prior = await getOperation(admin, candidate.workspace_id, operationKey);
  if (prior?.operation_status === 'succeeded' && prior.external_id) {
    const existing = await getGhlOpportunity(ghl, prior.external_id);
    return {
      id: prior.external_id,
      created: false,
      pipelineId: requiredId(existing.pipeline_id),
      stageId: requiredId(existing.stage_id),
    };
  }
  if (prior && ['executing', 'needs_reconciliation'].includes(prior.operation_status)) {
    throw new DealIntakeError(409, 'opportunity_create_requires_reconciliation');
  }

  const operation = await beginOperation(admin, candidate, 'ghl_opportunity_create', operationKey);
  try {
    const created = await createGhlOpportunity(ghl, {
      pipelineId: route.pipelineId,
      pipelineStageId: route.stageId,
      name: address,
      status: 'open',
      contactId,
      source: 'Ema Email Intake',
      customFields,
    });
    const id = requiredId(created.id);
    await finishOperation(admin, operation.id, id, {
      pipeline_id: route.pipelineId,
      stage_id: route.stageId,
    });
    return { id, created: true, pipelineId: route.pipelineId, stageId: route.stageId };
  } catch (error) {
    await markOperationUncertain(admin, operation.id, error);
    throw error;
  }
}

async function updateExistingOpportunityFields(
  admin: SupabaseClient,
  ghl: GhlContext,
  candidate: CandidateRow,
  opportunityId: string,
  customFields: Array<Record<string, unknown>>,
): Promise<void> {
  const key = `ema:${candidate.id}:opportunity-fields:v1`;
  const prior = await getOperation(admin, candidate.workspace_id, key);
  if (prior?.operation_status === 'succeeded') return;
  if (prior && ['executing', 'needs_reconciliation'].includes(prior.operation_status)) {
    throw new DealIntakeError(409, 'opportunity_update_requires_reconciliation');
  }
  const op = await beginOperation(admin, candidate, 'ghl_opportunity_update', key);
  try {
    await updateGhlOpportunity(ghl, opportunityId, { customFields });
    await finishOperation(admin, op.id, opportunityId, { fields_updated: customFields.length });
  } catch (error) {
    await markOperationUncertain(admin, op.id, error);
    throw error;
  }
}

async function ensureIntakeNote(
  admin: SupabaseClient,
  ghl: GhlContext,
  candidate: CandidateRow,
  message: MessageRow,
  address: string,
  contactId: string,
  opportunityId: string,
  opportunityCreated: boolean,
): Promise<{ id: string; disposition: 'created' | 'reconciled' | 'persisted' }> {
  const event = opportunityCreated ? 'INITIAL REVIEW' : 'NEW INFORMATION';
  const noteBody = buildNoteBody(candidate, message, address, opportunityId, event);
  const key = `ema:${message.gmail_message_id}:${opportunityId}:note:v1`;
  const prior = await getOperation(admin, candidate.workspace_id, key);
  if (prior?.operation_status === 'succeeded' && prior.external_id) {
    return { id: prior.external_id, disposition: 'persisted' };
  }

  const notes = await listGhlContactNotes(ghl, contactId);
  const marker = `Intake Ref: ${candidate.id}`;
  const existing = recordArray(notes.notes).find((row) =>
    cleanString(row.body, 5000)?.includes(marker)
  );
  if (existing) {
    const id = requiredId(existing.id);
    if (prior) await finishOperation(admin, prior.id, id, { reconciled: true });
    return { id, disposition: 'reconciled' };
  }
  if (prior && ['executing', 'needs_reconciliation'].includes(prior.operation_status)) {
    throw new DealIntakeError(409, 'note_create_requires_reconciliation');
  }

  const op = await beginOperation(admin, candidate, 'ghl_opportunity_note_create', key);
  try {
    const created = await createGhlContactNote(ghl, contactId, noteBody);
    const id = requiredId(created.id);
    await finishOperation(admin, op.id, id, { target: 'contact', opportunity_id: opportunityId });
    return { id, disposition: 'created' };
  } catch (error) {
    await markOperationUncertain(admin, op.id, error);
    throw error;
  }
}

function buildOpportunityCustomFields(
  candidate: CandidateRow,
  address: string,
  route: Route,
): Array<Record<string, unknown>> {
  const facts = candidate.extracted_facts;
  const fields: Array<Record<string, unknown>> = [];
  addField(fields, FIELD_IDS.property_type, route.propertyType);
  addField(fields, FIELD_IDS.full_address, address);
  addField(fields, FIELD_IDS.asking_price, firstValue(facts, ['asking_price', 'askingPrice', 'price']));
  addField(fields, FIELD_IDS.zip, firstValue(facts, ['zip', 'zipcode', 'postal_code', 'postalCode']));
  addField(fields, FIELD_IDS.state, firstValue(facts, ['state', 'property_state']));
  addField(fields, FIELD_IDS.county, firstValue(facts, ['county', 'property_county']));
  addField(fields, FIELD_IDS.occupancy, firstValue(facts, ['occupancy', 'occupancy_status']));
  addField(fields, FIELD_IDS.mortgage_status, firstValue(facts, ['mortgage_status', 'mortgageStatus']));
  addField(fields, FIELD_IDS.mortgage_balance, firstValue(facts, ['mortgage_balance', 'mortgageBalance']));
  addField(fields, FIELD_IDS.arrears, firstValue(facts, ['back_payments', 'arrears', 'backPayments']));
  addField(fields, FIELD_IDS.piti, firstValue(facts, ['piti', 'PITI']));
  addField(fields, FIELD_IDS.timeline, firstValue(facts, ['timeline', 'seller_timeline']));
  addField(fields, FIELD_IDS.motivation, firstValue(facts, ['motivation', 'seller_motivation']));
  addField(fields, FIELD_IDS.condition, firstValue(facts, ['condition', 'property_condition']));
  addField(fields, FIELD_IDS.hoa, firstValue(facts, ['hoa', 'has_hoa', 'hoa_exists']));
  addField(fields, FIELD_IDS.hoa_amount, firstValue(facts, ['hoa_amount', 'hoaAmount']));
  addField(fields, FIELD_IDS.hoa_restrictions, firstValue(facts, ['hoa_restrictions', 'hoaRestrictions']));
  addField(fields, FIELD_IDS.hoa_duration, firstValue(facts, ['hoa_frequency', 'hoa_duration', 'hoaFrequency']));
  addField(fields, FIELD_IDS.listed, firstValue(facts, ['listed_with_realtor', 'listed', 'listing_status']));
  addField(fields, FIELD_IDS.flood_utilities, firstValue(facts, ['flood_and_utilities_info', 'flood_utilities']));
  addField(fields, FIELD_IDS.deal_type, firstValue(facts, ['deal_type', 'dealType']));
  addField(fields, FIELD_IDS.photos_zillow, firstValue(facts, ['photos_zillow', 'photos_url', 'zillow_url', 'deal_room_url']));

  const details = buildDealDetails(facts);
  if (details) addField(fields, FIELD_IDS.deal_details, details);
  return fields;
}

function buildDealDetails(facts: Record<string, unknown>): string | null {
  const pairs: Array<[string, unknown]> = [
    ['Units', firstValue(facts, ['units', 'unit_count', 'unitCount'])],
    ['Occupancy', firstValue(facts, ['occupancy', 'occupancy_status'])],
    ['Condition', firstValue(facts, ['condition', 'property_condition'])],
    ['Timeline', firstValue(facts, ['timeline', 'seller_timeline'])],
    ['Deal Type', firstValue(facts, ['deal_type', 'dealType'])],
  ];
  const lines = pairs.flatMap(([label, value]) => {
    const safe = scalarString(value, 300);
    return safe ? [`${label}: ${safe}`] : [];
  });
  return lines.length ? lines.join('\n').slice(0, 3000) : null;
}

function buildNoteBody(
  candidate: CandidateRow,
  message: MessageRow,
  address: string,
  opportunityId: string,
  event: string,
): string {
  const facts = candidate.extracted_facts;
  const lines = [
    `EMA | ${address} | ${event}`,
    '',
    `Cash Screen: ${candidate.cash_screen_result.toUpperCase()}`,
    `Source: Email`,
  ];
  if (message.sender_name) lines.push(`Sender: ${message.sender_name.slice(0, 200)}`);
  if (message.sender_email) lines.push(`Sender Email: ${message.sender_email.slice(0, 320)}`);
  const price = scalarString(firstValue(facts, ['asking_price', 'askingPrice', 'price']), 100);
  if (price) lines.push(`Asking Price: ${price}`);
  const propertyType = scalarString(firstValue(facts, ['property_type', 'propertyType', 'asset_class']), 120);
  if (propertyType) lines.push(`Property Type: ${propertyType}`);
  const occupancy = scalarString(firstValue(facts, ['occupancy', 'occupancy_status']), 160);
  if (occupancy) lines.push(`Occupancy: ${occupancy}`);
  lines.push('', `Opportunity ID: ${opportunityId}`);
  lines.push(`Gmail Message: ${message.gmail_message_id.slice(0, 300)}`);
  lines.push(`Intake Ref: ${candidate.id}`);
  return lines.join('\n').slice(0, 5000);
}

function controlledContactTags(candidate: CandidateRow): string[] {
  const tags = ['email-lead', candidate.cash_screen_result === 'pass' ? 'ema-qualified' : 'ema-marginal'];
  const source = candidate.source_type?.toLowerCase() ?? '';
  if (source.includes('broker')) tags.push('broker');
  else if (source.includes('wholesale')) tags.push('wholesaler');
  else if (source.includes('seller')) tags.push('direct-seller');
  else if (source.includes('agent')) tags.push('agent');
  else if (source.includes('lender')) tags.push('lender');
  return tags;
}

async function getOperation(
  admin: SupabaseClient,
  workspaceId: string,
  idempotencyKey: string,
): Promise<OperationRow | null> {
  const { data, error } = await admin.from('ema_operations').select(
    'id, operation_status, external_id',
  ).eq('workspace_id', workspaceId).eq('operating_mode', 'autonomous').eq(
    'idempotency_key', idempotencyKey,
  ).maybeSingle();
  if (error) throw new DealIntakeError(500, 'ema_operation_lookup_failed');
  return data as OperationRow | null;
}

async function beginOperation(
  admin: SupabaseClient,
  candidate: CandidateRow,
  operationType: string,
  idempotencyKey: string,
): Promise<OperationRow> {
  const { data, error } = await admin.from('ema_operations').insert({
    workspace_id: candidate.workspace_id,
    ema_message_id: candidate.ema_message_id,
    ema_candidate_id: candidate.id,
    operating_mode: 'autonomous',
    operation_type: operationType,
    idempotency_key: idempotencyKey,
    operation_status: 'executing',
    request_metadata: { source: 'agent_gateway', contract: 'deal.intake_to_crm.v1' },
    attempt_count: 1,
    is_test: false,
  }).select('id, operation_status, external_id').single();
  if (error || !data) throw new DealIntakeError(500, 'ema_operation_create_failed');
  return data as OperationRow;
}

async function finishOperation(
  admin: SupabaseClient,
  operationId: string,
  externalId: string,
  resultMetadata: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.from('ema_operations').update({
    operation_status: 'succeeded',
    external_id: externalId,
    result_metadata: resultMetadata,
    last_error: null,
  }).eq('id', operationId);
  if (error) throw new DealIntakeError(500, 'ema_operation_update_failed');
}

async function markOperationUncertain(
  admin: SupabaseClient,
  operationId: string,
  error: unknown,
): Promise<void> {
  await admin.from('ema_operations').update({
    operation_status: 'needs_reconciliation',
    last_error: error instanceof Error ? error.name.slice(0, 120) : 'upstream_error',
  }).eq('id', operationId);
}

function addField(
  fields: Array<Record<string, unknown>>,
  id: string,
  value: unknown,
): void {
  const safe = scalarString(value, 3000);
  if (safe !== null) fields.push({ id, fieldValue: safe });
}

function firstValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function scalarString(value: unknown, maximum: number): string | null {
  if (typeof value === 'string') {
    const result = value.trim();
    return result ? result.slice(0, maximum) : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).slice(0, maximum);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return null;
}

function cleanString(value: unknown, maximum: number): string | null {
  return scalarString(value, maximum);
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && !Array.isArray(item)
    )
    : [];
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
