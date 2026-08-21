import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';

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
interface CandidateInput {
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
    const existingSummary=await summarizeExisting(admin,workspaceId,existing.id,existing.processing_status);
    const expectedCount=numberValue(existing.raw_metadata?.candidate_count);
    if(input.message_disposition==='deal'&&existing.processing_status==='extracted'&&expectedCount!==null&&existingSummary.candidates.length<expectedCount){
      return resumeCandidatePersistence(admin,workspaceId,source,existing.id,input);
    }
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
  const candidates=await persistCandidates(admin,workspaceId,source,messageId,input.candidates);
  return {disposition:'persisted',message_id:messageId,gmail_message_id:source.id,candidates};
}

async function resumeCandidatePersistence(
  admin:SupabaseClient, workspaceId:string, source:SourceMessage, messageId:string, input:IntakeInput,
):Promise<Record<string,unknown>> {
  if(!input.candidates.length)throw new EmailIntakeError(409,'email_intake_incomplete');
  const candidates=await persistCandidates(admin,workspaceId,source,messageId,input.candidates);
  return {disposition:'resumed',message_id:messageId,gmail_message_id:source.id,candidates};
}

async function loadExistingMessage(
  admin:SupabaseClient,w:string,account:string,gmailMessageId:string,
):Promise<{id:string;processing_status:string;raw_metadata:Record<string,unknown>}|null>{
  const {data,error}=await admin.from('ema_messages').select('id, processing_status, raw_metadata')
    .eq('workspace_id',w).eq('gmail_account',account).eq('gmail_message_id',gmailMessageId).maybeSingle();
  if(error)throw new EmailIntakeError(500,'ema_message_lookup_failed');
  return data as {id:string;processing_status:string;raw_metadata:Record<string,unknown>}|null;
}

async function summarizeExisting(admin:SupabaseClient,w:string,messageId:string,messageStatus:string){
  const {data:candidates,error:candidateError}=await admin.from('ema_candidates')
    .select('id, candidate_index, normalized_address, intake_result, buy_box_fit_result, processing_status, ghl_opportunity_id')
    .eq('workspace_id',w).eq('ema_message_id',messageId).order('candidate_index',{ascending:true});
  if(candidateError)throw new EmailIntakeError(500,'candidate_lookup_failed');
  const rows=(candidates??[]).map(row=>({
    candidate_id:String(row.id),candidate_index:Number(row.candidate_index),normalized_address:row.normalized_address??null,
    intake_result:row.intake_result??null,buy_box_fit_result:row.buy_box_fit_result??null,
    processing_status:row.processing_status,has_crm_opportunity:Boolean(row.ghl_opportunity_id),
  }));
  if(rows.length)return{disposition:'already_persisted',processing_status:messageStatus,candidates:rows};

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

async function persistCandidates(
  admin:SupabaseClient,w:string,source:SourceMessage,messageId:string,candidates:CandidateInput[],
):Promise<Array<Record<string,unknown>>>{
  const output:Array<Record<string,unknown>>=[];
  for(let index=0;index<candidates.length;index++){
    const candidate=candidates[index],address=cleanString(candidate.normalized_address,300);
    const intakeResult=candidate.intake_result;
    const row={
      workspace_id:w,ema_message_id:messageId,candidate_index:index,candidate_type:cleanString(candidate.candidate_type,120),
      normalized_address:address,candidate_fingerprint:candidateFingerprint(source.id,index,address),
      extracted_facts:candidate.extracted_facts,evidence:candidate.evidence,missing_information:candidate.missing_information,
      source_type:candidate.source_type,intake_result:intakeResult,
      ghl_readiness:intakeResult==='excluded'?'excluded':'not_evaluated',
      processing_status:intakeResult==='excluded'?'intake_excluded':'extracted',is_test:false,test_run_id:null,
    };
    const {data,error}=await admin.from('ema_candidates').upsert(row,{onConflict:'ema_message_id,candidate_index'})
      .select('id, candidate_index, normalized_address, intake_result, processing_status').single();
    if(error||!data)throw new EmailIntakeError(500,'candidate_persist_failed');
    const candidateId=String(data.id);
    const {error:sourceError}=await admin.from('ema_candidate_sources').upsert({
      workspace_id:w,ema_candidate_id:candidateId,ema_message_id:messageId,relation_type:'origin',fact_updates:{},
      reconciliation_metadata:{gmail_message_id:source.id,gmail_thread_id:source.thread_id,source:'agent_gateway_email_intake'},
    },{onConflict:'ema_candidate_id,ema_message_id'});
    if(sourceError)throw new EmailIntakeError(500,'candidate_source_persist_failed');
    output.push({candidate_id:candidateId,candidate_index:index,normalized_address:data.normalized_address??null,intake_result:data.intake_result,processing_status:data.processing_status});
  }
  return output;
}

export function candidateFingerprint(gmailMessageId:string,index:number,address:string|null):string{
  const slug=(address??'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120);
  return `prod:${gmailMessageId}:${slug||`candidate-${index}`}`;
}

function parseInternalDate(value:string|null|undefined):string|null{
  if(!value)return null;
  if(/^\d{10,16}$/.test(value)){const date=new Date(Number(value));return Number.isNaN(date.getTime())?null:date.toISOString()}
  const date=new Date(value);return Number.isNaN(date.getTime())?null:date.toISOString();
}
function parseMailbox(value:string):{email:string|null;name:string|null}{
  const match=value.match(/^(.*?)\s*<([^>]+)>\s*$/),email=(match?.[2]??value).trim().toLowerCase();
  const name=(match?.[1]??'').replace(/^"|"$/g,'').trim();
  return{email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:null,name:name||null};
}
function parseRecipients(value:string):string[]{return [...new Set(value.split(',').map(part=>parseMailbox(part).email).filter((email):email is string=>Boolean(email)))].slice(0,50)}
function cleanString(value:unknown,max:number):string|null{if(typeof value!=='string')return null;const v=value.trim();return v?v.slice(0,max):null}
function numberValue(value:unknown):number|null{const n=Number(value);return Number.isFinite(n)?n:null}
