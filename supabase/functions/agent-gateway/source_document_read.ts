import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';

export class SourceDocumentReadError extends Error {
  constructor(public status:number, public code:string) {
    super(code);
    this.name='SourceDocumentReadError';
  }
}

export async function listCandidateSourceDocuments(
  admin:SupabaseClient,
  workspaceId:string,
  candidateId:string,
):Promise<Record<string,unknown>> {
  const candidate=await loadCandidate(admin,workspaceId,candidateId);
  const {data,error}=await admin.from('ema_candidate_documents')
    .select('id, ema_candidate_id, filename, mime_type, document_type, extraction_status, extraction_method, extracted_text_chars, total_pages, content_sha256, source_metadata, created_at, updated_at')
    .eq('workspace_id',workspaceId)
    .eq('ema_candidate_id',candidateId)
    .order('created_at',{ascending:true});
  if(error)throw new SourceDocumentReadError(500,'source_document_list_failed');
  const documents=(data??[]).map(row=>({
    document_id:row.id,
    candidate_id:row.ema_candidate_id,
    filename:row.filename,
    mime_type:row.mime_type,
    document_type:row.document_type,
    extraction_status:row.extraction_status,
    extraction_method:row.extraction_method,
    extracted_text_chars:row.extracted_text_chars,
    total_pages:row.total_pages,
    content_sha256:row.content_sha256,
    matched_by:safeSourceMetadata(row.source_metadata).matched_by??null,
    created_at:row.created_at,
    updated_at:row.updated_at,
  }));
  return{candidate,document_count:documents.length,documents};
}

export async function readCandidateSourceDocument(
  admin:SupabaseClient,
  workspaceId:string,
  candidateId:string,
  documentId:string,
):Promise<Record<string,unknown>> {
  const candidate=await loadCandidate(admin,workspaceId,candidateId);
  const {data:row,error}=await admin.from('ema_candidate_documents')
    .select('id, ema_candidate_id, ema_message_id, filename, mime_type, document_type, extraction_status, extraction_method, extracted_text, extracted_text_chars, total_pages, content_sha256, source_metadata, created_at, updated_at')
    .eq('workspace_id',workspaceId)
    .eq('ema_candidate_id',candidateId)
    .eq('id',documentId)
    .maybeSingle();
  if(error)throw new SourceDocumentReadError(500,'source_document_read_failed');
  if(!row)throw new SourceDocumentReadError(404,'source_document_not_found');
  return{
    candidate,
    document:{
      document_id:row.id,
      candidate_id:row.ema_candidate_id,
      ema_message_id:row.ema_message_id,
      filename:row.filename,
      mime_type:row.mime_type,
      document_type:row.document_type,
      extraction_status:row.extraction_status,
      extraction_method:row.extraction_method,
      extracted_text_chars:row.extracted_text_chars,
      total_pages:row.total_pages,
      content_sha256:row.content_sha256,
      source_metadata:safeSourceMetadata(row.source_metadata),
      text_is_untrusted_external_content:true,
      extracted_text:typeof row.extracted_text==='string'?row.extracted_text:null,
      created_at:row.created_at,
      updated_at:row.updated_at,
    },
  };
}

async function loadCandidate(
  admin:SupabaseClient,
  workspaceId:string,
  candidateId:string,
):Promise<Record<string,unknown>> {
  const {data,error}=await admin.from('ema_candidates')
    .select('id, candidate_index, normalized_address')
    .eq('workspace_id',workspaceId)
    .eq('id',candidateId)
    .maybeSingle();
  if(error)throw new SourceDocumentReadError(500,'candidate_lookup_failed');
  if(!data)throw new SourceDocumentReadError(404,'candidate_not_found');
  return{
    candidate_id:data.id,
    candidate_index:data.candidate_index,
    normalized_address:data.normalized_address,
  };
}

function safeSourceMetadata(value:unknown):Record<string,unknown>{
  const source=isRecord(value)?value:{};
  const result:Record<string,unknown>={};
  for(const key of [
    'source','gmail_message_id','gmail_thread_id','size_bytes','matched_by',
    'extraction_error_code','text_is_untrusted_external_content',
  ]){
    if(source[key]!==undefined)result[key]=source[key];
  }
  return result;
}

function isRecord(value:unknown):value is Record<string,unknown>{
  return typeof value==='object'&&value!==null&&!Array.isArray(value);
}
