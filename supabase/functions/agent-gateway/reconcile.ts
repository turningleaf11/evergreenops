import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { createGhlContactNote, resolveGhlContext } from '../_shared/ghl.ts';
import { deriveAssetClass } from './buy_box.ts';
import { isPortfolioAssetClass, summarizePortfolioDocuments, type PortfolioDocumentType } from './portfolio_documents.ts';

export class DealReconcileError extends Error {
  constructor(public status:number, public code:string) { super(code); this.name='DealReconcileError'; }
}

type FactValue = string | number | boolean | null;
interface CandidateRow {
  id:string; workspace_id:string; ema_message_id:string; normalized_address:string|null;
  extracted_facts:Record<string,unknown>; evidence:Record<string,unknown>;
  portfolio_document_inventory:Record<string,unknown>; ghl_contact_id:string|null;
  ghl_opportunity_id:string|null; is_test:boolean;
}
interface SourceMessage {
  id:string; thread_id:string; internal_date?:string|null; headers?:Record<string,string>;
  body_text?:string; body_html?:string; attachments?:Array<Record<string,unknown>>;
}
interface DocumentInput { attachment_id:string; document_type:PortfolioDocumentType }
interface ReconcileInput { candidate_id?:string|null; fact_updates:Record<string,FactValue>; documents:DocumentInput[] }
interface CandidateMatch { id:string; normalized_address:string|null; relation_type:'thread_reply'|'address_match' }

const BUY_BOX_RELEVANT_RECONCILE_FACTS=new Set([
  'property_type','units','sites','pads','bedrooms','bathrooms','sqft','occupancy',
  'condition','renovation_level','hoa','post_possession','fire_damage',
  'structural_issues','flood_zone',
]);

export function requiresBuyBoxRerun(factKeys:string[]):boolean {
  return factKeys.some(key=>BUY_BOX_RELEVANT_RECONCILE_FACTS.has(key));
}

export async function reconcileEmailUpdate(
  admin:SupabaseClient,
  workspaceId:string,
  gmailAccount:string,
  source:SourceMessage,
  input:ReconcileInput,
):Promise<Record<string,unknown>> {
  if (!source.id || !source.thread_id) throw new DealReconcileError(400,'gmail_message_invalid');
  const matched = await resolveCandidateMatch(admin, workspaceId, source, input.candidate_id ?? null);
  const candidate = await loadCandidate(admin, workspaceId, matched.id);
  if (candidate.is_test) throw new DealReconcileError(409,'test_candidate_not_permitted');

  const nextFacts = { ...candidate.extracted_facts, ...input.fact_updates };
  const assetClass = safeAssetClass(nextFacts);
  if (input.documents.length && !isPortfolioAssetClass(assetClass)) {
    throw new DealReconcileError(409,'portfolio_documents_not_applicable');
  }

  const sourceMessageId = await persistSourceMessage(
    admin, workspaceId, gmailAccount, candidate.ema_message_id, source, matched.relation_type,
  );

  const existingSource = await getCandidateSource(admin, candidate.id, sourceMessageId);
  const mergedFactUpdates = {
    ...(existingSource?.fact_updates ?? {}),
    ...input.fact_updates,
  };

  await upsertCandidateSource(admin, {
    workspaceId,
    candidateId:candidate.id,
    sourceMessageId,
    relationType:matched.relation_type,
    factUpdates:mergedFactUpdates,
    metadata:{ gmail_message_id:source.id, gmail_thread_id:source.thread_id },
  });

  const verifiedDocuments = verifyDocumentClassifications(source, input.documents);
  for (const document of verifiedDocuments) {
    const { error } = await admin.from('ema_candidate_documents').upsert({
      workspace_id:workspaceId,
      ema_candidate_id:candidate.id,
      ema_message_id:sourceMessageId,
      gmail_attachment_id:document.attachment_id,
      filename:document.filename,
      mime_type:document.mime_type,
      document_type:document.document_type,
    }, { onConflict:'ema_candidate_id,ema_message_id,gmail_attachment_id' });
    if (error) throw new DealReconcileError(500,'candidate_document_persist_failed');
  }

  const inventory = await buildDocumentInventory(admin, workspaceId, candidate.id);
  const documentSummary = summarizePortfolioDocuments(assetClass, inventory);
  const evidence = mergeEvidence(candidate.evidence, source, mergedFactUpdates, verifiedDocuments, matched.relation_type);
  const update:Record<string,unknown> = {
    extracted_facts:nextFacts,
    evidence,
  };
  if (isPortfolioAssetClass(assetClass)) {
    update.portfolio_document_status = documentSummary.status;
    update.portfolio_document_inventory = inventory;
    update.portfolio_missing_documents = documentSummary.missing_documents;
    update.portfolio_document_checked_at = new Date().toISOString();
  }
  const { error:updateError } = await admin.from('ema_candidates').update(update)
    .eq('id',candidate.id).eq('workspace_id',workspaceId);
  if (updateError) throw new DealReconcileError(500,'candidate_update_failed');

  const factKeys=Object.keys(input.fact_updates);
  const rerunBuyBoxRequired=requiresBuyBoxRerun(factKeys);
  let crmNote:Record<string,unknown>|null = null;
  if (candidate.ghl_contact_id && candidate.ghl_opportunity_id) {
    crmNote = await ensureCrmUpdateNote(admin, candidate, source, matched.relation_type,
      factKeys, verifiedDocuments, documentSummary);
  }

  return {
    candidate_id:candidate.id,
    disposition:existingSource ? 'updated_existing_source' : 'reconciled',
    matched_by:matched.relation_type,
    gmail_message_id:source.id,
    fact_keys_updated:factKeys,
    documents_received:verifiedDocuments.map(d=>({
      document_type:d.document_type, filename:d.filename, attachment_id:d.attachment_id,
    })),
    portfolio_documents:documentSummary,
    crm_note:crmNote,
    rerun_buy_box_required:rerunBuyBoxRequired,
  };
}

async function resolveCandidateMatch(
  admin:SupabaseClient, workspaceId:string, source:SourceMessage, requestedCandidateId:string|null,
):Promise<CandidateMatch> {
  const { data:threadMessages, error:threadError } = await admin.from('ema_messages')
    .select('id').eq('workspace_id',workspaceId).eq('gmail_thread_id',source.thread_id);
  if (threadError) throw new DealReconcileError(500,'candidate_match_lookup_failed');
  const messageIds=(threadMessages??[]).map(r=>String(r.id));
  let threadCandidateIds:string[]=[];
  if (messageIds.length) {
    const { data:sources, error } = await admin.from('ema_candidate_sources')
      .select('ema_candidate_id').eq('workspace_id',workspaceId).in('ema_message_id',messageIds);
    if (error) throw new DealReconcileError(500,'candidate_match_lookup_failed');
    threadCandidateIds=[...new Set((sources??[]).map(r=>String(r.ema_candidate_id)))];
  }

  if (threadCandidateIds.length) {
    const candidates=await loadMatchCandidates(admin,workspaceId,threadCandidateIds);
    const selected=selectCandidateFromMatches(candidates, source, requestedCandidateId);
    if (selected) return { id:selected.id, normalized_address:selected.normalized_address, relation_type:'thread_reply' };
    throw new DealReconcileError(409,'candidate_match_ambiguous');
  }

  const { data:rows, error } = await admin.from('ema_candidates')
    .select('id, normalized_address').eq('workspace_id',workspaceId).eq('is_test',false)
    .not('normalized_address','is',null).limit(2000);
  if (error) throw new DealReconcileError(500,'candidate_match_lookup_failed');
  const candidates=(rows??[]).map(r=>({id:String(r.id),normalized_address:typeof r.normalized_address==='string'?r.normalized_address:null}));
  const addressMatches=candidates.filter(c=>messageMentionsAddress(source,c.normalized_address));
  const selected=selectCandidateFromMatches(addressMatches, source, requestedCandidateId, false);
  if (selected) return { id:selected.id, normalized_address:selected.normalized_address, relation_type:'address_match' };
  if (addressMatches.length>1) throw new DealReconcileError(409,'candidate_match_ambiguous');
  throw new DealReconcileError(404,'existing_candidate_not_found');
}

async function loadMatchCandidates(admin:SupabaseClient, workspaceId:string, ids:string[]):Promise<Array<{id:string;normalized_address:string|null}>> {
  const { data,error }=await admin.from('ema_candidates').select('id, normalized_address')
    .eq('workspace_id',workspaceId).eq('is_test',false).in('id',ids);
  if(error)throw new DealReconcileError(500,'candidate_match_lookup_failed');
  return (data??[]).map(r=>({id:String(r.id),normalized_address:typeof r.normalized_address==='string'?r.normalized_address:null}));
}

export function selectCandidateFromMatches(
  candidates:Array<{id:string;normalized_address:string|null}>, source:SourceMessage,
  requestedCandidateId:string|null, requireAddressWhenMultiple=true,
):{id:string;normalized_address:string|null}|null {
  if (requestedCandidateId) {
    const requested=candidates.find(c=>c.id===requestedCandidateId);
    if (!requested) return null;
    if (candidates.length===1 || messageMentionsAddress(source,requested.normalized_address) || !requireAddressWhenMultiple) return requested;
    return null;
  }
  if (candidates.length===1) return candidates[0];
  const byAddress=candidates.filter(c=>messageMentionsAddress(source,c.normalized_address));
  return byAddress.length===1?byAddress[0]:null;
}

export function messageMentionsAddress(source:SourceMessage,address:string|null):boolean {
  if(!address)return false;
  const headers=source.headers??{};
  const text=canonical(`${headers.subject??''} ${source.body_text??''} ${stripHtml(source.body_html??'')}`);
  const full=canonical(address);
  if(full.length>=12&&text.includes(full))return true;
  const street=canonical(address.split(',')[0]??'');
  return street.length>=8&&text.includes(street);
}

async function loadCandidate(admin:SupabaseClient,w:string,id:string):Promise<CandidateRow>{
  const {data,error}=await admin.from('ema_candidates').select('id, workspace_id, ema_message_id, normalized_address, extracted_facts, evidence, portfolio_document_inventory, ghl_contact_id, ghl_opportunity_id, is_test').eq('workspace_id',w).eq('id',id).maybeSingle();
  if(error)throw new DealReconcileError(500,'candidate_lookup_failed');
  if(!data)throw new DealReconcileError(404,'existing_candidate_not_found');
  return data as CandidateRow;
}

async function persistSourceMessage(admin:SupabaseClient,w:string,account:string,originMessageId:string,source:SourceMessage,relationType:string):Promise<string>{
  const h=source.headers??{},receivedAt=parseInternalDate(source.internal_date),sender=parseMailbox(h.from??'');
  const row={workspace_id:w,gmail_account:account,gmail_message_id:source.id,gmail_thread_id:source.thread_id,supersedes_message_id:originMessageId,sender_email:sender.email,sender_name:sender.name,recipient_addresses:parseRecipients(`${h.to??''},${h.cc??''}`),subject:(h.subject??'').slice(0,1000)||null,received_at:receivedAt,processing_status:'completed',raw_metadata:{source:'agent_gateway_reconciliation',relation_type:relationType,gmail_header_message_id:h['message-id']??null},is_test:false,test_run_id:null};
  const {data,error}=await admin.from('ema_messages').upsert(row,{onConflict:'workspace_id,gmail_account,gmail_message_id'}).select('id').single();
  if(error||!data)throw new DealReconcileError(500,'ema_message_persist_failed');
  return String(data.id);
}

async function getCandidateSource(admin:SupabaseClient,candidateId:string,messageId:string):Promise<{fact_updates:Record<string,FactValue>}|null>{
  const {data,error}=await admin.from('ema_candidate_sources').select('fact_updates').eq('ema_candidate_id',candidateId).eq('ema_message_id',messageId).maybeSingle();
  if(error)throw new DealReconcileError(500,'candidate_source_lookup_failed');
  return data as {fact_updates:Record<string,FactValue>}|null;
}

async function upsertCandidateSource(admin:SupabaseClient,p:{workspaceId:string;candidateId:string;sourceMessageId:string;relationType:string;factUpdates:Record<string,FactValue>;metadata:Record<string,unknown>}){
  const {error}=await admin.from('ema_candidate_sources').upsert({workspace_id:p.workspaceId,ema_candidate_id:p.candidateId,ema_message_id:p.sourceMessageId,relation_type:p.relationType,fact_updates:p.factUpdates,reconciliation_metadata:p.metadata},{onConflict:'ema_candidate_id,ema_message_id'});
  if(error)throw new DealReconcileError(500,'candidate_source_persist_failed');
}

function verifyDocumentClassifications(source:SourceMessage,documents:DocumentInput[]):Array<DocumentInput&{filename:string;mime_type:string|null}>{
  const attachments=Array.isArray(source.attachments)?source.attachments:[];
  const seen=new Set<string>();
  return documents.map(document=>{
    if(seen.has(document.attachment_id))throw new DealReconcileError(400,'duplicate_attachment_classification');
    seen.add(document.attachment_id);
    const attachment=attachments.find(a=>String(a.attachment_id??'')===document.attachment_id);
    if(!attachment)throw new DealReconcileError(409,'attachment_not_in_source_message');
    const filename=typeof attachment.filename==='string'?attachment.filename.trim():'';
    if(!filename)throw new DealReconcileError(409,'attachment_filename_missing');
    return {...document,filename:filename.slice(0,500),mime_type:typeof attachment.mime_type==='string'?attachment.mime_type.slice(0,200):null};
  });
}

async function buildDocumentInventory(admin:SupabaseClient,w:string,candidateId:string):Promise<Record<string,unknown>>{
  const {data,error}=await admin.from('ema_candidate_documents').select('document_type, filename, ema_message_id, gmail_attachment_id').eq('workspace_id',w).eq('ema_candidate_id',candidateId).order('created_at',{ascending:true});
  if(error)throw new DealReconcileError(500,'candidate_document_lookup_failed');
  const inventory:Record<string,unknown>={};
  for(const row of data??[]){
    const type=String(row.document_type) as PortfolioDocumentType;
    const current=(inventory[type]&&typeof inventory[type]==='object'&&!Array.isArray(inventory[type]))?inventory[type] as Record<string,unknown>:{};
    inventory[type]={status:'received',source_message_ids:uniqueStrings([...(Array.isArray(current.source_message_ids)?current.source_message_ids:[]),String(row.ema_message_id)]),filenames:uniqueStrings([...(Array.isArray(current.filenames)?current.filenames:[]),String(row.filename)]),attachment_ids:uniqueStrings([...(Array.isArray(current.attachment_ids)?current.attachment_ids:[]),String(row.gmail_attachment_id)])};
  }
  return inventory;
}

function mergeEvidence(current:Record<string,unknown>,source:SourceMessage,facts:Record<string,FactValue>,docs:Array<DocumentInput&{filename:string;mime_type:string|null}>,relation:string):Record<string,unknown>{
  const evidence={...current};
  const sourceUpdates=(evidence.source_updates&&typeof evidence.source_updates==='object'&&!Array.isArray(evidence.source_updates))?{...(evidence.source_updates as Record<string,unknown>)}:{};
  sourceUpdates[source.id]={gmail_thread_id:source.thread_id,relation_type:relation,received_at:parseInternalDate(source.internal_date),fact_updates:facts,documents:docs.map(d=>({document_type:d.document_type,filename:d.filename,attachment_id:d.attachment_id}))};
  evidence.source_updates=sourceUpdates;
  return evidence;
}

async function ensureCrmUpdateNote(admin:SupabaseClient,c:CandidateRow,source:SourceMessage,relation:string,factKeys:string[],docs:Array<DocumentInput&{filename:string;mime_type:string|null}>,summary:ReturnType<typeof summarizePortfolioDocuments>):Promise<Record<string,unknown>>{
  const key=`ema:update:${c.id}:${source.id}:note:v1`;
  const {data:prior,error:lookupError}=await admin.from('ema_operations').select('id, operation_status, external_id').eq('workspace_id',c.workspace_id).eq('operating_mode','autonomous').eq('idempotency_key',key).maybeSingle();
  if(lookupError)throw new DealReconcileError(500,'ema_operation_lookup_failed');
  if(prior?.operation_status==='succeeded'&&prior.external_id)return{id:prior.external_id,disposition:'persisted'};
  if(prior&&['executing','needs_reconciliation'].includes(prior.operation_status))throw new DealReconcileError(409,'crm_update_requires_reconciliation');

  const {data:op,error:opError}=await admin.from('ema_operations').insert({workspace_id:c.workspace_id,ema_message_id:null,ema_candidate_id:c.id,operating_mode:'autonomous',operation_type:'ghl_opportunity_note_create',idempotency_key:key,operation_status:'executing',request_metadata:{source:'agent_gateway',contract:'deal.reconcile_email_update.v1',gmail_message_id:source.id},attempt_count:1,is_test:false}).select('id').single();
  if(opError||!op)throw new DealReconcileError(500,'ema_operation_create_failed');
  try{
    const ghl=await resolveGhlContext(admin);
    const note=await createGhlContactNote(ghl,c.ghl_contact_id!,buildCrmNote(c,source,relation,factKeys,docs,summary));
    const noteId=requiredExternalId(note.id);
    const {error}=await admin.from('ema_operations').update({operation_status:'succeeded',external_id:noteId,result_metadata:{target:'contact',opportunity_id:c.ghl_opportunity_id,gmail_message_id:source.id},last_error:null}).eq('id',op.id);
    if(error)throw new DealReconcileError(500,'ema_operation_update_failed');
    return{id:noteId,disposition:'created'};
  }catch(error){
    await admin.from('ema_operations').update({operation_status:'needs_reconciliation',last_error:error instanceof Error?error.name.slice(0,120):'upstream_error'}).eq('id',op.id);
    throw error;
  }
}

function buildCrmNote(c:CandidateRow,source:SourceMessage,relation:string,factKeys:string[],docs:Array<DocumentInput&{filename:string;mime_type:string|null}>,summary:ReturnType<typeof summarizePortfolioDocuments>):string{
  const lines=[`EMA | ${c.normalized_address??'Existing Deal'} | NEW INFORMATION`,'',`Matched By: ${relation==='thread_reply'?'Gmail thread':'property address'}`,`Gmail Message: ${source.id}`];
  if(factKeys.length)lines.push(`Updated Source Facts: ${factKeys.join(', ')}`);
  if(docs.length)lines.push(`Documents Received: ${docs.map(d=>`${documentLabel(d.document_type)} (${d.filename})`).join('; ')}`);
  if(summary.status!=='not_applicable')lines.push(`Portfolio Document Status: ${summary.status.toUpperCase()}`,`Still Missing: ${summary.missing_documents.length?summary.missing_documents.map(documentLabel).join(', '):'None'}`);
  lines.push('',`Opportunity ID: ${c.ghl_opportunity_id}`,`Reconciliation Ref: ${c.id}:${source.id}`);
  return lines.join('\n').slice(0,5000);
}

function safeAssetClass(facts:Record<string,unknown>):string{try{return deriveAssetClass(facts)}catch{return'unknown'}}
function parseInternalDate(value:string|null|undefined):string|null{if(!value)return null;const ms=Number(value);if(Number.isFinite(ms)&&ms>0)return new Date(ms).toISOString();const d=new Date(value);return Number.isNaN(d.getTime())?null:d.toISOString()}
function parseMailbox(value:string):{email:string|null;name:string|null}{const email=value.match(/<([^>\s]+@[^>\s]+)>/)?.[1]??value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]??null;const name=value.replace(/<[^>]+>/g,'').replace(email??'','').replace(/^\s*["']|["']\s*$/g,'').trim()||null;return{email:email?.toLowerCase()??null,name:name?.slice(0,300)??null}}
function parseRecipients(value:string):string[]{return uniqueStrings((value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig)??[]).map(x=>x.toLowerCase())).slice(0,30)}
function uniqueStrings(values:unknown[]):string[]{return [...new Set(values.filter((v):v is string=>typeof v==='string'&&v.length>0))]}
function stripHtml(value:string):string{return value.replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ')}
function canonical(value:string):string{return value.toLowerCase().replace(/\b(street)\b/g,'st').replace(/\b(avenue)\b/g,'ave').replace(/\b(road)\b/g,'rd').replace(/\b(drive)\b/g,'dr').replace(/\b(lane)\b/g,'ln').replace(/\b(boulevard)\b/g,'blvd').replace(/[^a-z0-9]/g,'')}
function requiredExternalId(value:unknown):string{const id=typeof value==='string'?value:'';if(!id||!/^[A-Za-z0-9_-]+$/.test(id))throw new DealReconcileError(502,'invalid_ghl_identifier');return id}
function documentLabel(type:PortfolioDocumentType):string{return type==='om'?'OM':type==='rent_roll'?'Rent Roll':type==='t12'?'T12':'P&L'}
