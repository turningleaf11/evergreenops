import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import {
  parseNormalizedAddressFacts,
  resolveFreeFloridaCounty,
  type PublicGeographyResolution,
} from './public_geography.ts';

export class EmailIntakeError extends Error {
  constructor(public status:number, public code:string) { super(code); this.name='EmailIntakeError'; }
}

type FactValue = string | number | boolean | null;
interface SourceMessage {
  id:string;
  thread_id:string;
  internal_date?:string|null;
  headers?:Record<string,string>;
  attachments?:Array<Record<string,unknown>>;
}
export interface CandidateInput {
  candidate_type?:string|null;
  normalized_address?:string|null;
  extracted_facts:Record<string,FactValue>;
  evidence:Record<string,unknown>;
  missing_information:string[];
  source_type:'email'|'attachment'|'mixed';
  intake_result:'supported'|'excluded'|'needs_classification'|'needs_info';
}
interface IntakeInput {
  message_disposition:'deal'|'excluded';
  exclusion_reason?:string|null;
  candidates:CandidateInput[];
}
interface ExistingCandidateRow {
  candidate_id:string;
  candidate_index:number;
  normalized_address:string|null;
  candidate_fingerprint:string|null;
  extracted_facts:Record<string,FactValue>;
  evidence:Record<string,unknown>;
  source_type:'email'|'attachment'|'mixed';
  intake_result:string|null;
  buy_box_fit_result:string|null;
  processing_status:string;
  ghl_opportunity_id:string|null;
}
interface CandidatePlan {
  candidate:CandidateInput;
  candidate_index:number;
}
interface CandidateSupplementResult {
  source_fields:string[];
  address_fields:string[];
  public_geography:PublicGeographyResolution|null;
}
interface AddressFactEnrichment {
  facts:Record<string,FactValue>;
  evidence:Record<string,unknown>;
  filled_fields:string[];
  public_geography:PublicGeographyResolution|null;
}

const BUY_BOX_RELEVANT_SUPPLEMENT_FIELDS=new Set([
  'property_type','propertyType','asset_class','assetClass','units','unit_count','unitCount',
  'beds','bedrooms','baths','bathrooms','sqft','square_feet','squareFeet','city','property_city',
  'state','property_state','zip','postal_code','property_zip','county','property_county','hoa','has_hoa',
  'hoa_exists','condition','renovation_level','rehab_level','is_condo','condo',
]);
const CORE_ATTACHMENT_FACT_FIELDS=new Set([
  'property_type','asset_class','units','bedrooms','bathrooms','sqft','asking_price','arv',
  'repair_estimate','occupancy','tenant_rent_monthly','condition','renovation_level','hoa',
  'year_built','lot_size_sqft',
]);

export async function persistEmailIntake(
  admin:SupabaseClient,
  workspaceId:string,
  gmailAccount:string,
  source:SourceMessage,
  input:IntakeInput,
):Promise<Record<string,unknown>> {
  if(!source.id||!source.thread_id)throw new EmailIntakeError(400,'gmail_message_invalid');

  const existing=await loadExistingMessage(admin,workspaceId,gmailAccount,source.id);
  if(existing){
    if(input.message_disposition==='deal'&&input.candidates.length){
      return reconcileExistingMessageCandidates(admin,workspaceId,source,existing,input.candidates);
    }
    const existingSummary=await summarizeExisting(admin,workspaceId,existing.id,existing.processing_status);
    return {message_id:existing.id,gmail_message_id:source.id,...existingSummary};
  }

  const existingThreadCandidates=await findThreadCandidates(admin,workspaceId,source.thread_id);
  if(existingThreadCandidates.length){
    return {
      disposition:'existing_thread',
      gmail_message_id:source.id,
      gmail_thread_id:source.thread_id,
      existing_candidate_ids:existingThreadCandidates,
      next_action:'reconcile_existing_deal',
    };
  }

  if(input.message_disposition==='excluded'){
    const messageId=await insertMessage(admin,workspaceId,gmailAccount,source,'excluded',{
      source:'agent_gateway_email_intake',
      message_disposition:'excluded',
      exclusion_reason:input.exclusion_reason??null,
      candidate_count:0,
    });
    return {disposition:'excluded',message_id:messageId,gmail_message_id:source.id,candidates:[]};
  }

  if(!input.candidates.length)throw new EmailIntakeError(400,'deal_candidates_required');
  const messageId=await insertMessage(admin,workspaceId,gmailAccount,source,'extracted',{
    source:'agent_gateway_email_intake',
    message_disposition:'deal',
    candidate_count:input.candidates.length,
  });
  const candidates=await persistCandidatePlans(
    admin,workspaceId,source,messageId,input.candidates.map((candidate,candidate_index)=>({candidate,candidate_index})),
  );
  return {disposition:'persisted',message_id:messageId,gmail_message_id:source.id,candidates};
}

async function reconcileExistingMessageCandidates(
  admin:SupabaseClient,
  workspaceId:string,
  source:SourceMessage,
  existing:{id:string;processing_status:string;raw_metadata:Record<string,unknown>},
  incoming:CandidateInput[],
):Promise<Record<string,unknown>> {
  const current=await loadExistingCandidateRows(admin,workspaceId,existing.id);
  const plan=planExistingMessageCandidates(source.id,current,incoming);
  const supplemented=plan.matched.length
    ? await supplementMatchedCandidateFacts(admin,workspaceId,existing.id,plan.matched,incoming)
    : new Map<string,CandidateSupplementResult>();
  const added=plan.additions.length
    ? await persistCandidatePlans(admin,workspaceId,source,existing.id,plan.additions)
    : [];
  if(added.length){
    await updateMessageCandidateCount(
      admin,workspaceId,existing.id,existing.raw_metadata,current.length+added.length,
    );
  }
  const matched=plan.matched.map(row=>{
    const supplement=supplemented.get(row.candidate_id)??{
      source_fields:[],address_fields:[],public_geography:null,
    };
    const allFilled=[...new Set([...supplement.source_fields,...supplement.address_fields])];
    return {
      candidate_id:row.candidate_id,candidate_index:row.candidate_index,
      normalized_address:row.normalized_address,intake_result:row.intake_result,
      buy_box_fit_result:row.buy_box_fit_result,processing_status:row.processing_status,
      has_crm_opportunity:Boolean(row.ghl_opportunity_id),disposition:'matched_existing',
      source_facts_supplemented:supplement.source_fields.length>0,
      filled_source_fact_fields:supplement.source_fields,
      filled_address_fact_fields:supplement.address_fields,
      public_geography:safePublicGeography(supplement.public_geography),
      source_fact_contract:buildSourceFactContract(
        row.extracted_facts,row.extracted_facts,row.source_type,row.intake_result,
      ),
      rerun_buy_box_required:allFilled.some(field=>BUY_BOX_RELEVANT_SUPPLEMENT_FIELDS.has(field)),
    };
  });
  return {
    disposition:added.length?'expanded':'already_persisted',
    processing_status:existing.processing_status,
    message_id:existing.id,
    gmail_message_id:source.id,
    added_candidate_count:added.length,
    supplemented_candidate_count:[...supplemented.values()].filter(value=>
      value.source_fields.length>0||value.address_fields.length>0
    ).length,
    candidates:[...matched,...added],
  };
}

export function planExistingMessageCandidates(
  gmailMessageId:string,
  existing:ExistingCandidateRow[],
  incoming:CandidateInput[],
):{matched:ExistingCandidateRow[];additions:CandidatePlan[]} {
  const byFingerprint=new Map<string,ExistingCandidateRow>();
  const byAddress=new Map<string,ExistingCandidateRow>();
  for(const row of existing){
    if(row.candidate_fingerprint)byFingerprint.set(row.candidate_fingerprint,row);
    const addressKey=canonicalAddress(row.normalized_address??'');
    if(addressKey)byAddress.set(addressKey,row);
  }
  const matched:ExistingCandidateRow[]=[];
  const additions:CandidatePlan[]=[];
  const matchedIds=new Set<string>();
  let nextIndex=existing.reduce((max,row)=>Math.max(max,row.candidate_index),-1)+1;

  for(const candidate of incoming){
    const address=cleanString(candidate.normalized_address,300);
    if(address){
      const fingerprint=candidateFingerprint(gmailMessageId,0,address);
      const found=byFingerprint.get(fingerprint)??byAddress.get(canonicalAddress(address));
      if(found){
        if(!matchedIds.has(found.candidate_id)){matched.push(found);matchedIds.add(found.candidate_id)}
        continue;
      }
      additions.push({candidate,candidate_index:nextIndex++});
      continue;
    }

    if(existing.length)throw new EmailIntakeError(409,'candidate_identity_required_for_incremental_email');
    additions.push({candidate,candidate_index:nextIndex++});
  }
  return{matched,additions};
}

export function mergeMissingSourceFacts(
  existing:Record<string,FactValue>,
  incoming:Record<string,FactValue>,
):{facts:Record<string,FactValue>;filled_fields:string[]} {
  const facts={...existing};
  const filled_fields:string[]=[];
  for(const [key,value] of Object.entries(incoming)){
    if(!isMissingFact(facts[key])||isMissingFact(value))continue;
    facts[key]=value;
    filled_fields.push(key);
  }
  return{facts,filled_fields};
}

export function buildSourceFactContract(
  sourceFacts:Record<string,FactValue>,
  persistedFacts:Record<string,FactValue>,
  sourceType:'email'|'attachment'|'mixed',
  intakeResult:string|null,
):Record<string,unknown> {
  const sourceFactKeys=nonMissingFactKeys(sourceFacts);
  const persistedFactKeys=nonMissingFactKeys(persistedFacts);
  const coreSourceFactKeys=sourceFactKeys.filter(key=>CORE_ATTACHMENT_FACT_FIELDS.has(key));
  const attachmentBased=sourceType==='attachment'||sourceType==='mixed';
  const reviewable=intakeResult==='supported'||intakeResult==='needs_info';
  const sparse=attachmentBased&&reviewable&&coreSourceFactKeys.length<2;
  return{
    status:sparse?'sparse':'ready',
    source_type:sourceType,
    source_fact_keys:sourceFactKeys,
    source_fact_count:sourceFactKeys.length,
    persisted_fact_keys:persistedFactKeys,
    persisted_fact_count:persistedFactKeys.length,
    core_source_fact_keys:coreSourceFactKeys,
    core_source_fact_count:coreSourceFactKeys.length,
    warning:sparse?'attachment_fact_bundle_suspiciously_sparse':null,
    next_action:sparse
      ? 'review_extracted_pdf_text_and_resubmit_same_candidate_address_with_all_source_backed_facts_before_buy_box'
      : null,
  };
}

async function supplementMatchedCandidateFacts(
  admin:SupabaseClient,
  workspaceId:string,
  messageId:string,
  matched:ExistingCandidateRow[],
  incoming:CandidateInput[],
):Promise<Map<string,CandidateSupplementResult>> {
  const result=new Map<string,CandidateSupplementResult>();
  const incomingByAddress=new Map<string,CandidateInput>();
  for(const candidate of incoming){
    const key=canonicalAddress(cleanString(candidate.normalized_address,300)??'');
    if(key)incomingByAddress.set(key,candidate);
  }
  for(const row of matched){
    const key=canonicalAddress(row.normalized_address??'');
    const candidate=incomingByAddress.get(key);
    if(!candidate){
      result.set(row.candidate_id,{source_fields:[],address_fields:[],public_geography:null});
      continue;
    }
    const sourceMerged=mergeMissingSourceFacts(row.extracted_facts,candidate.extracted_facts);
    const addressEnriched=await enrichCandidateAddressFacts(
      row.normalized_address,
      sourceMerged.facts,
      row.evidence,
    );
    result.set(row.candidate_id,{
      source_fields:sourceMerged.filled_fields,
      address_fields:addressEnriched.filled_fields,
      public_geography:addressEnriched.public_geography,
    });
    const changed=sourceMerged.filled_fields.length>0||addressEnriched.filled_fields.length>0||
      addressEnriched.evidence!==row.evidence;
    if(!changed)continue;
    const {error}=await admin.from('ema_candidates').update({
      extracted_facts:addressEnriched.facts,
      evidence:addressEnriched.evidence,
    }).eq('id',row.candidate_id).eq('workspace_id',workspaceId);
    if(error)throw new EmailIntakeError(500,'candidate_source_fact_supplement_failed');
    if(sourceMerged.filled_fields.length){
      await supplementOriginSourceFacts(
        admin,workspaceId,row.candidate_id,messageId,candidate.extracted_facts,candidate.source_type,
      );
    }
    row.extracted_facts=addressEnriched.facts;
    row.evidence=addressEnriched.evidence;
  }
  return result;
}

async function supplementOriginSourceFacts(
  admin:SupabaseClient,
  workspaceId:string,
  candidateId:string,
  messageId:string,
  incomingFacts:Record<string,FactValue>,
  sourceType:'email'|'attachment'|'mixed',
):Promise<void> {
  const {data,error}=await admin.from('ema_candidate_sources')
    .select('fact_updates, reconciliation_metadata')
    .eq('workspace_id',workspaceId).eq('ema_candidate_id',candidateId).eq('ema_message_id',messageId)
    .maybeSingle();
  if(error)throw new EmailIntakeError(500,'candidate_source_lookup_failed');
  const existingFacts=factRecord(data?.fact_updates);
  const merged=mergeMissingSourceFacts(existingFacts,incomingFacts).facts;
  const metadata=recordValue(data?.reconciliation_metadata);
  const {error:updateError}=await admin.from('ema_candidate_sources').upsert({
    workspace_id:workspaceId,
    ema_candidate_id:candidateId,
    ema_message_id:messageId,
    relation_type:'origin',
    fact_updates:merged,
    reconciliation_metadata:{
      ...metadata,
      source:'agent_gateway_email_intake',
      source_type:sourceType,
      source_fact_keys:nonMissingFactKeys(merged),
    },
  },{onConflict:'ema_candidate_id,ema_message_id'});
  if(updateError)throw new EmailIntakeError(500,'candidate_source_persist_failed');
}

async function enrichCandidateAddressFacts(
  address:string|null,
  facts:Record<string,FactValue>,
  evidence:Record<string,unknown>,
):Promise<AddressFactEnrichment> {
  if(!address)return{facts:{...facts},evidence,filled_fields:[],public_geography:null};

  const parsed=parseNormalizedAddressFacts(address);
  const localMerge=mergeMissingSourceFacts(facts,{
    city:parsed.city,
    state:parsed.state,
    zip:parsed.zip,
  });
  let nextFacts=localMerge.facts;
  let nextEvidence=evidence;
  let publicGeography:PublicGeographyResolution|null=null;
  const countyMissing=isMissingFact(nextFacts.county)&&isMissingFact(nextFacts.property_county);
  const state=cleanString(nextFacts.state,20)?.toUpperCase()??null;

  if(countyMissing&&state==='FL'){
    publicGeography=await resolveFreeFloridaCounty(address,nextFacts);
    if(publicGeography.status==='resolved'&&publicGeography.county){
      const geographyMerge=mergeMissingSourceFacts(nextFacts,{
        county:publicGeography.county,
        city:publicGeography.city,
        state:publicGeography.state,
        zip:publicGeography.zip,
      });
      nextFacts=geographyMerge.facts;
      localMerge.filled_fields.push(...geographyMerge.filled_fields);
    }
    nextEvidence={
      ...evidence,
      public_geography:{
        provider:publicGeography.provider,
        status:publicGeography.status,
        county:publicGeography.county,
        state:publicGeography.state,
        city:publicGeography.city,
        zip:publicGeography.zip,
        matched_address:publicGeography.matched_address,
        source_url:publicGeography.source_url,
        error_code:publicGeography.error_code,
      },
    };
  }

  return{
    facts:nextFacts,
    evidence:nextEvidence,
    filled_fields:[...new Set(localMerge.filled_fields)],
    public_geography:publicGeography,
  };
}

async function loadExistingMessage(
  admin:SupabaseClient,w:string,account:string,gmailMessageId:string,
):Promise<{id:string;processing_status:string;raw_metadata:Record<string,unknown>}|null>{
  const {data,error}=await admin.from('ema_messages').select('id, processing_status, raw_metadata')
    .eq('workspace_id',w).eq('gmail_account',account).eq('gmail_message_id',gmailMessageId).maybeSingle();
  if(error)throw new EmailIntakeError(500,'ema_message_lookup_failed');
  return data as {id:string;processing_status:string;raw_metadata:Record<string,unknown>}|null;
}

async function loadExistingCandidateRows(admin:SupabaseClient,w:string,messageId:string):Promise<ExistingCandidateRow[]>{
  const {data,error}=await admin.from('ema_candidates')
    .select('id, candidate_index, normalized_address, candidate_fingerprint, extracted_facts, evidence, source_type, intake_result, buy_box_fit_result, processing_status, ghl_opportunity_id')
    .eq('workspace_id',w).eq('ema_message_id',messageId).order('candidate_index',{ascending:true});
  if(error)throw new EmailIntakeError(500,'candidate_lookup_failed');
  return (data??[]).map(row=>({
    candidate_id:String(row.id),candidate_index:Number(row.candidate_index),normalized_address:row.normalized_address??null,
    candidate_fingerprint:row.candidate_fingerprint??null,
    extracted_facts:(row.extracted_facts&&typeof row.extracted_facts==='object'&&!Array.isArray(row.extracted_facts))
      ? row.extracted_facts as Record<string,FactValue>: {},
    evidence:(row.evidence&&typeof row.evidence==='object'&&!Array.isArray(row.evidence))
      ? row.evidence as Record<string,unknown>: {},
    source_type:row.source_type==='attachment'||row.source_type==='mixed'?'attachment'===row.source_type?'attachment':'mixed':'email',
    intake_result:row.intake_result??null,
    buy_box_fit_result:row.buy_box_fit_result??null,processing_status:String(row.processing_status),
    ghl_opportunity_id:row.ghl_opportunity_id??null,
  }));
}

async function summarizeExisting(admin:SupabaseClient,w:string,messageId:string,messageStatus:string){
  const rows=await loadExistingCandidateRows(admin,w,messageId);
  if(rows.length)return{disposition:'already_persisted',processing_status:messageStatus,candidates:rows.map(row=>({
    candidate_id:row.candidate_id,candidate_index:row.candidate_index,normalized_address:row.normalized_address,
    intake_result:row.intake_result,buy_box_fit_result:row.buy_box_fit_result,
    processing_status:row.processing_status,has_crm_opportunity:Boolean(row.ghl_opportunity_id),
    source_fact_contract:buildSourceFactContract(
      row.extracted_facts,row.extracted_facts,row.source_type,row.intake_result,
    ),
  }))};

  const {data:sources,error:sourceError}=await admin.from('ema_candidate_sources')
    .select('ema_candidate_id, relation_type').eq('workspace_id',w).eq('ema_message_id',messageId);
  if(sourceError)throw new EmailIntakeError(500,'candidate_source_lookup_failed');
  const linked=[...new Set((sources??[]).map(row=>String(row.ema_candidate_id)))];
  if(linked.length)return{disposition:'existing_update',processing_status:messageStatus,candidates:[],existing_candidate_ids:linked,next_action:'already_reconciled'};
  return{disposition:messageStatus==='excluded'?'already_excluded':'already_persisted',processing_status:messageStatus,candidates:[]};
}

async function findThreadCandidates(admin:SupabaseClient,w:string,threadId:string):Promise<string[]>{
  const {data:messages,error:messageError}=await admin.from('ema_messages').select('id')
    .eq('workspace_id',w).eq('gmail_thread_id',threadId);
  if(messageError)throw new EmailIntakeError(500,'thread_lookup_failed');
  const ids=(messages??[]).map(row=>String(row.id));
  if(!ids.length)return[];
  const {data:sources,error:sourceError}=await admin.from('ema_candidate_sources').select('ema_candidate_id')
    .eq('workspace_id',w).in('ema_message_id',ids);
  if(sourceError)throw new EmailIntakeError(500,'thread_lookup_failed');
  return [...new Set((sources??[]).map(row=>String(row.ema_candidate_id)))];
}

async function insertMessage(
  admin:SupabaseClient,w:string,account:string,source:SourceMessage,status:'extracted'|'excluded',metadata:Record<string,unknown>,
):Promise<string>{
  const headers=source.headers??{},sender=parseMailbox(headers.from??'');
  const row={
    workspace_id:w,gmail_account:account,gmail_message_id:source.id,gmail_thread_id:source.thread_id,
    sender_email:sender.email,sender_name:sender.name,recipient_addresses:parseRecipients(`${headers.to??''},${headers.cc??''}`),
    subject:(headers.subject??'').slice(0,1000)||null,received_at:parseInternalDate(source.internal_date),processing_status:status,
    raw_metadata:{...metadata,gmail_header_message_id:headers['message-id']??null,attachment_count:Array.isArray(source.attachments)?source.attachments.length:0},
    is_test:false,test_run_id:null,
  };
  const {data,error}=await admin.from('ema_messages').upsert(row,{onConflict:'workspace_id,gmail_account,gmail_message_id'}).select('id').single();
  if(error||!data)throw new EmailIntakeError(500,'ema_message_persist_failed');
  return String(data.id);
}

async function updateMessageCandidateCount(
  admin:SupabaseClient,w:string,messageId:string,metadata:Record<string,unknown>,actualCount:number,
):Promise<void>{
  const previous=numberValue(metadata.candidate_count)??0;
  const raw_metadata={...metadata,candidate_count:Math.max(previous,actualCount),multi_property_reconciled:true};
  const {error}=await admin.from('ema_messages').update({raw_metadata}).eq('workspace_id',w).eq('id',messageId);
  if(error)throw new EmailIntakeError(500,'ema_message_update_failed');
}

async function persistCandidatePlans(
  admin:SupabaseClient,w:string,source:SourceMessage,messageId:string,plans:CandidatePlan[],
):Promise<Array<Record<string,unknown>>>{
  const output:Array<Record<string,unknown>>=[];
  for(const plan of plans){
    const candidate=plan.candidate,index=plan.candidate_index,address=cleanString(candidate.normalized_address,300);
    const intakeResult=candidate.intake_result;
    const addressEnriched=await enrichCandidateAddressFacts(address,candidate.extracted_facts,candidate.evidence);
    const row={
      workspace_id:w,ema_message_id:messageId,candidate_index:index,candidate_type:cleanString(candidate.candidate_type,120),
      normalized_address:address,candidate_fingerprint:candidateFingerprint(source.id,index,address),
      extracted_facts:addressEnriched.facts,evidence:addressEnriched.evidence,missing_information:candidate.missing_information,
      source_type:candidate.source_type,intake_result:intakeResult,
      ghl_readiness:intakeResult==='excluded'?'excluded':'not_evaluated',
      processing_status:intakeResult==='excluded'?'intake_excluded':'extracted',is_test:false,test_run_id:null,
    };
    const {data,error}=await admin.from('ema_candidates').upsert(row,{onConflict:'ema_message_id,candidate_index'})
      .select('id, candidate_index, normalized_address, intake_result, processing_status').single();
    if(error||!data)throw new EmailIntakeError(500,'candidate_persist_failed');
    const candidateId=String(data.id);
    const sourceFacts=cleanFactRecord(candidate.extracted_facts);
    const {error:sourceError}=await admin.from('ema_candidate_sources').upsert({
      workspace_id:w,ema_candidate_id:candidateId,ema_message_id:messageId,relation_type:'origin',fact_updates:sourceFacts,
      reconciliation_metadata:{
        gmail_message_id:source.id,
        gmail_thread_id:source.thread_id,
        source:'agent_gateway_email_intake',
        source_type:candidate.source_type,
        source_fact_keys:nonMissingFactKeys(sourceFacts),
      },
    },{onConflict:'ema_candidate_id,ema_message_id'});
    if(sourceError)throw new EmailIntakeError(500,'candidate_source_persist_failed');
    output.push({
      candidate_id:candidateId,candidate_index:index,normalized_address:data.normalized_address??null,
      intake_result:data.intake_result,processing_status:data.processing_status,disposition:'created',
      filled_address_fact_fields:addressEnriched.filled_fields,
      public_geography:safePublicGeography(addressEnriched.public_geography),
      source_fact_contract:buildSourceFactContract(
        sourceFacts,addressEnriched.facts,candidate.source_type,intakeResult,
      ),
    });
  }
  return output;
}

function safePublicGeography(resolution:PublicGeographyResolution|null):Record<string,unknown>|null{
  if(!resolution)return null;
  return{
    status:resolution.status,
    provider:resolution.provider,
    county:resolution.county,
    state:resolution.state,
    city:resolution.city,
    zip:resolution.zip,
    matched_address:resolution.matched_address,
    source_url:resolution.source_url,
    error_code:resolution.error_code,
  };
}

export function candidateFingerprint(gmailMessageId:string,index:number,address:string|null):string{
  const slug=(address??'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120);
  return `prod:${gmailMessageId}:${slug||`candidate-${index}`}`;
}

function nonMissingFactKeys(facts:Record<string,FactValue>):string[]{
  return Object.entries(facts).filter(([,value])=>!isMissingFact(value)).map(([key])=>key).sort();
}
function cleanFactRecord(value:Record<string,FactValue>):Record<string,FactValue>{
  const result:Record<string,FactValue>={};
  for(const [key,fact] of Object.entries(value))if(!isMissingFact(fact))result[key]=fact;
  return result;
}
function factRecord(value:unknown):Record<string,FactValue>{
  if(!value||typeof value!=='object'||Array.isArray(value))return{};
  const result:Record<string,FactValue>={};
  for(const [key,fact] of Object.entries(value as Record<string,unknown>)){
    if(typeof fact==='string'||typeof fact==='number'||typeof fact==='boolean'||fact===null)result[key]=fact;
  }
  return result;
}
function recordValue(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function isMissingFact(value:unknown):boolean{
  return value===undefined||value===null||(typeof value==='string'&&!value.trim());
}
function canonicalAddress(value:string):string{return value.toLowerCase().replace(/[^a-z0-9]/g,'')}
function parseInternalDate(value:string|null|undefined):string|null{
  if(!value)return null;
  if(/^\d{10,16}$/.test(value)){const date=new Date(Number(value));return Number.isNaN(date.getTime())?null:date.toISOString()}
  const date=new Date(value);return Number.isNaN(date.getTime())?null:date.toISOString();
}
function parseMailbox(value:string):{email:string|null;name:string|null}{
  const match=value.match(/^(.*?)\s*<([^>]+)>\s*$/),email=(match?.[2]??value).trim().toLowerCase();
  const name=(match?.[1]??'').replace(/^\"|\"$/g,'').trim();
  return{email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:null,name:name||null};
}
function parseRecipients(value:string):string[]{return [...new Set(value.split(',').map(part=>parseMailbox(part).email).filter((email):email is string=>Boolean(email)))].slice(0,50)}
function cleanString(value:unknown,max:number):string|null{if(typeof value!=='string')return null;const v=value.trim();return v?v.slice(0,max):null}
function numberValue(value:unknown):number|null{const n=Number(value);return Number.isFinite(n)?n:null}
