import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { extractText, getDocumentProxy } from 'npm:unpdf@1.8.0';
import { refreshAccessToken } from '../_shared/gmail.ts';

const MAX_PDF_BYTES = 8 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_CHARS = 120000;
const EXTRACTION_METHOD = 'unpdf@1.8.0';

interface SourceMessage {
  id:string;
  thread_id:string;
  attachments?:Array<Record<string,unknown>>;
}

export interface CandidateDocumentTarget {
  candidate_id:string;
  normalized_address:string|null;
}

interface PdfAttachment {
  attachment_id:string;
  filename:string;
  mime_type:string|null;
  size:number|null;
}

interface PdfExtraction {
  status:'succeeded'|'empty_text'|'failed'|'unsupported';
  text:string|null;
  total_pages:number|null;
  content_sha256:string|null;
  error_code:string|null;
}

export interface SourceDocumentCaptureSummary {
  status:'not_applicable'|'complete'|'partial'|'needs_attention';
  target_count:number;
  covered_candidate_count:number;
  pdf_attachment_count:number;
  captured_document_count:number;
  reused_document_count:number;
  unmatched_pdf_count:number;
  documents:Array<Record<string,unknown>>;
  unmatched:Array<Record<string,unknown>>;
}

export async function captureCandidateSourceDocuments(
  admin:SupabaseClient,
  workspaceId:string,
  gmailAccount:string,
  emaMessageId:string,
  source:SourceMessage,
  targets:CandidateDocumentTarget[],
):Promise<SourceDocumentCaptureSummary> {
  const pdfs=pdfAttachments(source);
  if(!pdfs.length||!targets.length){
    return{
      status:'not_applicable',target_count:targets.length,covered_candidate_count:0,
      pdf_attachment_count:pdfs.length,captured_document_count:0,reused_document_count:0,
      unmatched_pdf_count:pdfs.length,documents:[],unmatched:[],
    };
  }

  const usableTargets=targets.filter(target=>Boolean(clean(target.normalized_address)));
  if(!usableTargets.length){
    return{
      status:'needs_attention',target_count:targets.length,covered_candidate_count:0,
      pdf_attachment_count:pdfs.length,captured_document_count:0,reused_document_count:0,
      unmatched_pdf_count:pdfs.length,documents:[],
      unmatched:pdfs.map(pdf=>({attachment_id:pdf.attachment_id,filename:pdf.filename,error_code:'candidate_address_required_for_document_match'})),
    };
  }

  let accessTokenPromise:Promise<string>|null=null;
  const extractionCache=new Map<string,Promise<PdfExtraction>>();
  const documents:Array<Record<string,unknown>>=[];
  const unmatched:Array<Record<string,unknown>>=[];

  const accessToken=()=>{
    if(!accessTokenPromise)accessTokenPromise=resolveGmailAccessToken(admin,workspaceId,gmailAccount);
    return accessTokenPromise;
  };
  const extraction=(pdf:PdfAttachment)=>{
    let pending=extractionCache.get(pdf.attachment_id);
    if(!pending){
      pending=extractPdfAttachment(accessToken,source.id,pdf);
      extractionCache.set(pdf.attachment_id,pending);
    }
    return pending;
  };

  for(const pdf of pdfs){
    let matches=usableTargets.filter(target=>filenameMentionsAddress(pdf.filename,target.normalized_address));
    let matchedBy:'filename'|'text'|'single_candidate_single_pdf'|null=matches.length===1?'filename':null;
    let extracted:PdfExtraction|null=null;

    if(matches.length!==1){
      if(usableTargets.length===1&&pdfs.length===1){
        matches=[usableTargets[0]];
        matchedBy='single_candidate_single_pdf';
      }else{
        extracted=await extraction(pdf);
        if(extracted.text){
          matches=usableTargets.filter(target=>textMentionsAddress(extracted?.text??'',target.normalized_address));
          if(matches.length===1)matchedBy='text';
        }
      }
    }

    if(matches.length!==1||!matchedBy){
      unmatched.push({
        attachment_id:pdf.attachment_id,filename:pdf.filename,
        error_code:matches.length>1?'attachment_candidate_match_ambiguous':'attachment_candidate_match_unverified',
      });
      continue;
    }

    const target=matches[0];
    const existing=await loadExistingDocument(admin,workspaceId,target.candidate_id,emaMessageId,pdf.attachment_id);
    if(existing?.extraction_status==='succeeded'&&typeof existing.extracted_text==='string'&&existing.extracted_text.length){
      documents.push({
        document_id:existing.id,candidate_id:target.candidate_id,attachment_id:pdf.attachment_id,
        filename:pdf.filename,document_type:existing.document_type,disposition:'reused',
        extraction_status:existing.extraction_status,total_pages:existing.total_pages,
        extracted_text_chars:existing.extracted_text_chars,content_sha256:existing.content_sha256,
        matched_by:matchedBy,
      });
      continue;
    }

    extracted=extracted??await extraction(pdf);
    const stored=await persistDocument(admin,workspaceId,emaMessageId,source,target,pdf,matchedBy,extracted,existing);
    documents.push(stored);
  }

  const captured=documents.filter(row=>row.disposition==='captured'||row.disposition==='updated').length;
  const reused=documents.filter(row=>row.disposition==='reused').length;
  const coveredCandidateIds=new Set(
    documents.filter(row=>row.extraction_status==='succeeded').map(row=>String(row.candidate_id)),
  );
  const covered=usableTargets.filter(target=>coveredCandidateIds.has(target.candidate_id)).length;
  const matchedExtractionProblem=documents.some(row=>row.extraction_status!=='succeeded');
  const allTargetsCovered=covered===usableTargets.length;
  const status:SourceDocumentCaptureSummary['status']=allTargetsCovered
    ? (matchedExtractionProblem?'partial':'complete')
    : (documents.length?'partial':'needs_attention');
  return{
    status,target_count:usableTargets.length,covered_candidate_count:covered,
    pdf_attachment_count:pdfs.length,captured_document_count:captured,reused_document_count:reused,
    unmatched_pdf_count:unmatched.length,documents,unmatched,
  };
}

export function filenameMentionsAddress(filename:string,address:string|null):boolean{
  const street=streetIdentity(address);
  return Boolean(street&&canonical(filename).includes(street));
}

export function textMentionsAddress(text:string,address:string|null):boolean{
  const street=streetIdentity(address);
  if(!street)return false;
  const normalized=canonical(text);
  return normalized.includes(street);
}

function pdfAttachments(source:SourceMessage):PdfAttachment[]{
  const attachments=Array.isArray(source.attachments)?source.attachments:[];
  const seen=new Set<string>();
  const result:PdfAttachment[]=[];
  for(const raw of attachments){
    const attachmentId=typeof raw.attachment_id==='string'?raw.attachment_id.trim():'';
    const filename=typeof raw.filename==='string'?raw.filename.trim():'';
    const mime=typeof raw.mime_type==='string'?raw.mime_type.trim().toLowerCase():null;
    if(!attachmentId||!filename||seen.has(attachmentId))continue;
    if(mime!=='application/pdf'&&!filename.toLowerCase().endsWith('.pdf'))continue;
    seen.add(attachmentId);
    const size=typeof raw.size==='number'&&Number.isFinite(raw.size)?Math.max(0,Math.trunc(raw.size)):null;
    result.push({attachment_id:attachmentId,filename:filename.slice(0,500),mime_type:mime,size});
  }
  return result.slice(0,20);
}

async function resolveGmailAccessToken(
  admin:SupabaseClient,workspaceId:string,gmailAccount:string,
):Promise<string>{
  const {data:account,error:accountError}=await admin.from('gmail_workspace_account')
    .select('refresh_token_secret_id').eq('workspace_id',workspaceId).ilike('email',gmailAccount)
    .is('revoked_at',null).maybeSingle();
  if(accountError)throw new Error('source_document_gmail_account_lookup_failed');
  if(!account?.refresh_token_secret_id)throw new Error('source_document_gmail_account_not_connected');
  const {data:token,error:tokenError}=await admin.from('gmail_tokens').select('refresh_token')
    .eq('workspace_id',workspaceId).eq('id',account.refresh_token_secret_id).maybeSingle();
  if(tokenError||!token?.refresh_token)throw new Error('source_document_gmail_token_unavailable');
  const accessToken=await refreshAccessToken(token.refresh_token);
  if(!accessToken)throw new Error('source_document_gmail_reauth_required');
  return accessToken;
}

async function extractPdfAttachment(
  getAccessToken:()=>Promise<string>,messageId:string,pdf:PdfAttachment,
):Promise<PdfExtraction>{
  if(pdf.size!==null&&pdf.size>MAX_PDF_BYTES){
    return{status:'unsupported',text:null,total_pages:null,content_sha256:null,error_code:'attachment_exceeds_8mb_limit'};
  }
  try{
    const accessToken=await getAccessToken();
    const response=await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(pdf.attachment_id)}`,
      {headers:{Authorization:`Bearer ${accessToken}`},signal:AbortSignal.timeout(20000)},
    );
    if(!response.ok){
      return{status:'failed',text:null,total_pages:null,content_sha256:null,error_code:`gmail_attachment_http_${response.status}`};
    }
    const body=await response.json() as Record<string,unknown>;
    const encoded=typeof body.data==='string'?body.data:'';
    const size=typeof body.size==='number'&&Number.isFinite(body.size)?Number(body.size):0;
    if(!encoded)return{status:'failed',text:null,total_pages:null,content_sha256:null,error_code:'gmail_attachment_data_missing'};
    if(size>MAX_PDF_BYTES)return{status:'unsupported',text:null,total_pages:null,content_sha256:null,error_code:'attachment_exceeds_8mb_limit'};
    const bytes=base64UrlToBytes(encoded);
    if(bytes.length>MAX_PDF_BYTES)return{status:'unsupported',text:null,total_pages:null,content_sha256:null,error_code:'attachment_exceeds_8mb_limit'};
    if(!looksLikePdf(bytes))return{status:'unsupported',text:null,total_pages:null,content_sha256:await sha256Bytes(bytes),error_code:'attachment_not_pdf'};
    const contentSha256=await sha256Bytes(bytes);
    const proxy=await getDocumentProxy(bytes);
    try{
      const result=await extractText(proxy,{mergePages:true});
      const text=String(result.text??'').slice(0,MAX_EXTRACTED_TEXT_CHARS);
      const totalPages=Number.isFinite(Number(result.totalPages))?Math.max(0,Math.trunc(Number(result.totalPages))):null;
      return{
        status:text.trim()?'succeeded':'empty_text',text:text||null,total_pages:totalPages,
        content_sha256:contentSha256,error_code:text.trim()?null:'pdf_contains_no_extractable_text',
      };
    }finally{
      const destroyable=proxy as unknown as {destroy?:()=>Promise<void>|void};
      if(typeof destroyable.destroy==='function')await destroyable.destroy();
    }
  }catch(error){
    return{
      status:'failed',text:null,total_pages:null,content_sha256:null,
      error_code:error instanceof Error?boundedErrorCode(error.message):'pdf_extraction_failed',
    };
  }
}

async function persistDocument(
  admin:SupabaseClient,workspaceId:string,emaMessageId:string,source:SourceMessage,
  target:CandidateDocumentTarget,pdf:PdfAttachment,matchedBy:string,extraction:PdfExtraction,
  existing:ExistingDocumentRow|null,
):Promise<Record<string,unknown>>{
  const sourceMetadata={
    ...(recordValue(existing?.source_metadata)),
    source:'gmail',gmail_message_id:source.id,gmail_thread_id:source.thread_id,
    size_bytes:pdf.size,matched_by:matchedBy,extraction_error_code:extraction.error_code,
    text_is_untrusted_external_content:true,
  };
  const fields={
    filename:pdf.filename,mime_type:pdf.mime_type??'application/pdf',
    extraction_status:extraction.status,extraction_method:EXTRACTION_METHOD,
    extracted_text:extraction.text,extracted_text_chars:extraction.text?.length??0,
    total_pages:extraction.total_pages,content_sha256:extraction.content_sha256,
    source_metadata:sourceMetadata,
  };
  if(existing){
    const {data,error}=await admin.from('ema_candidate_documents').update(fields)
      .eq('workspace_id',workspaceId).eq('id',existing.id)
      .select('id, document_type, extraction_status, extracted_text_chars, total_pages, content_sha256').single();
    if(error||!data)throw new Error('source_document_update_failed');
    return{
      document_id:String(data.id),candidate_id:target.candidate_id,attachment_id:pdf.attachment_id,
      filename:pdf.filename,document_type:data.document_type,disposition:'updated',
      extraction_status:data.extraction_status,total_pages:data.total_pages,
      extracted_text_chars:data.extracted_text_chars,content_sha256:data.content_sha256,matched_by:matchedBy,
    };
  }
  const {data,error}=await admin.from('ema_candidate_documents').insert({
    workspace_id:workspaceId,ema_candidate_id:target.candidate_id,ema_message_id:emaMessageId,
    gmail_attachment_id:pdf.attachment_id,document_type:'source_pdf',...fields,
  }).select('id, document_type, extraction_status, extracted_text_chars, total_pages, content_sha256').single();
  if(error||!data)throw new Error('source_document_insert_failed');
  return{
    document_id:String(data.id),candidate_id:target.candidate_id,attachment_id:pdf.attachment_id,
    filename:pdf.filename,document_type:data.document_type,disposition:'captured',
    extraction_status:data.extraction_status,total_pages:data.total_pages,
    extracted_text_chars:data.extracted_text_chars,content_sha256:data.content_sha256,matched_by:matchedBy,
  };
}

interface ExistingDocumentRow {
  id:string;
  document_type:string;
  extraction_status:string;
  extracted_text:string|null;
  extracted_text_chars:number;
  total_pages:number|null;
  content_sha256:string|null;
  source_metadata:Record<string,unknown>;
}

async function loadExistingDocument(
  admin:SupabaseClient,workspaceId:string,candidateId:string,emaMessageId:string,attachmentId:string,
):Promise<ExistingDocumentRow|null>{
  const {data,error}=await admin.from('ema_candidate_documents')
    .select('id, document_type, extraction_status, extracted_text, extracted_text_chars, total_pages, content_sha256, source_metadata')
    .eq('workspace_id',workspaceId).eq('ema_candidate_id',candidateId).eq('ema_message_id',emaMessageId)
    .eq('gmail_attachment_id',attachmentId).maybeSingle();
  if(error)throw new Error('source_document_lookup_failed');
  return data as ExistingDocumentRow|null;
}

function streetIdentity(address:string|null):string|null{
  const value=clean(address);
  if(!value)return null;
  const street=value.split(',')[0]??'';
  const normalized=canonical(street);
  return normalized.length>=8?normalized:null;
}
function canonical(value:string):string{return value.toLowerCase().replace(/[^a-z0-9]/g,'')}
function clean(value:unknown):string|null{return typeof value==='string'&&value.trim()?value.trim():null}
function recordValue(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{} }
function boundedErrorCode(value:string):string{return value.toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_+|_+$/g,'').slice(0,120)||'pdf_extraction_failed'}
function looksLikePdf(bytes:Uint8Array):boolean{return bytes.length>=4&&bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46}
function base64UrlToBytes(value:string):Uint8Array{
  const base64=value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=');
  const binary=atob(base64);
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
async function sha256Bytes(bytes:Uint8Array):Promise<string>{
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
