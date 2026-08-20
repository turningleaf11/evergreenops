export const ALLOWED_ACTIONS = [
  'system.whoami',
  'email.list',
  'email.search',
  'email.read',
  'email.get_attachment',
  'crm.search_contacts',
  'crm.search_opportunities',
  'crm.list_pipelines',
  'deal.buy_box_fit',
  'deal.intake_to_crm',
  'deal.reconcile_email_update',
] as const;

export const DEFAULT_INLINE_ATTACHMENT_BYTES = 2 * 1024 * 1024;
export const MAX_INLINE_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const RECONCILE_FACT_KEYS = new Set([
  'property_type','units','sites','pads','bedrooms','bathrooms','sqft','asking_price',
  'arv','occupancy','tenant_rent_monthly','condition','renovation_level','hoa',
  'post_possession','fire_damage','structural_issues','flood_zone',
]);
const PORTFOLIO_DOCUMENT_TYPES = ['om','rent_roll','t12','pnl'] as const;
export type GatewayAction = typeof ALLOWED_ACTIONS[number];
export interface GatewayRequest { action: GatewayAction; input: Record<string, unknown> }
export class RequestValidationError extends Error { constructor(message:string){super(message);this.name='RequestValidationError'} }

export function parseBearerToken(header:string|null):string|null{const match=header?.match(/^Bearer\s+([^\s]+)$/i);if(!match)return null;const token=match[1];return token.length>=32&&token.length<=512?token:null}
export async function sha256Hex(value:string):Promise<string>{const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')}

export function parseGatewayRequest(value:unknown):GatewayRequest{
  if(!isRecord(value))throw new RequestValidationError('Body must be a JSON object');
  if(typeof value.action!=='string'||!ALLOWED_ACTIONS.includes(value.action as GatewayAction))throw new RequestValidationError('Unsupported action');
  const input=value.input===undefined?{}:value.input;if(!isRecord(input))throw new RequestValidationError('input must be a JSON object');
  switch(value.action as GatewayAction){
    case 'system.whoami': return{action:'system.whoami',input:{}};
    case 'email.list': return{action:'email.list',input:{max_results:optionalInteger(input.max_results,'max_results',1,50)??50,page_token:optionalPageToken(input.page_token),after_epoch_seconds:optionalInteger(input.after_epoch_seconds,'after_epoch_seconds',0,Number.MAX_SAFE_INTEGER)??null}};
    case 'email.search': return{action:'email.search',input:{query:requiredString(input.query,'query',1,500),max_results:optionalInteger(input.max_results,'max_results',1,50)??50,page_token:optionalPageToken(input.page_token)}};
    case 'email.read': return{action:'email.read',input:{thread_id:gmailId(input.thread_id,'thread_id')}};
    case 'email.get_attachment': return{action:'email.get_attachment',input:{message_id:gmailId(input.message_id,'message_id'),attachment_id:gmailId(input.attachment_id,'attachment_id'),max_bytes:optionalInteger(input.max_bytes,'max_bytes',64*1024,MAX_INLINE_ATTACHMENT_BYTES)??DEFAULT_INLINE_ATTACHMENT_BYTES}};
    case 'crm.search_contacts': return{action:'crm.search_contacts',input:{query:requiredString(input.query,'query',1,75),limit:optionalInteger(input.limit,'limit',1,20)??20,page:optionalInteger(input.page,'page',1,1000)??1}};
    case 'crm.search_opportunities':{const query=optionalString(input.query,'query',1,200),contactId=optionalGhlId(input.contact_id,'contact_id');if(!query&&!contactId)throw new RequestValidationError('query or contact_id is required');return{action:'crm.search_opportunities',input:{query,contact_id:contactId,pipeline_id:optionalGhlId(input.pipeline_id,'pipeline_id'),stage_id:optionalGhlId(input.stage_id,'stage_id'),status:optionalEnum(input.status,'status',['open','won','lost','abandoned','all'] as const),limit:optionalInteger(input.limit,'limit',1,50)??20,page:optionalInteger(input.page,'page',1,1000)??1}}}
    case 'crm.list_pipelines': return{action:'crm.list_pipelines',input:{}};
    case 'deal.buy_box_fit': return{action:'deal.buy_box_fit',input:{candidate_id:uuid(input.candidate_id,'candidate_id')}};
    case 'deal.intake_to_crm': return{action:'deal.intake_to_crm',input:{candidate_id:uuid(input.candidate_id,'candidate_id')}};
    case 'deal.reconcile_email_update': {
      const factUpdates=reconcileFactUpdates(input.fact_updates),documents=reconcileDocuments(input.documents),candidateId=optionalUuid(input.candidate_id,'candidate_id');
      if(Object.keys(factUpdates).length===0&&documents.length===0)throw new RequestValidationError('fact_updates or documents is required');
      return{action:'deal.reconcile_email_update',input:{message_id:gmailId(input.message_id,'message_id'),candidate_id:candidateId,fact_updates:factUpdates,documents}};
    }
  }
}

export function isUntrustedExternalAction(action:GatewayAction):boolean{return action.startsWith('email.')||action.startsWith('crm.')||action.startsWith('deal.')}
export function summarizeGatewayInput(request:GatewayRequest):{inputSummary:Record<string,unknown>;resourceType:string|null;resourceId:string|null}{switch(request.action){
  case 'system.whoami':return{inputSummary:{},resourceType:'agent',resourceId:null};
  case 'email.list':return{inputSummary:{max_results:request.input.max_results,has_page_token:Boolean(request.input.page_token),after_epoch_seconds:request.input.after_epoch_seconds},resourceType:'gmail_message_list',resourceId:null};
  case 'email.search':return{inputSummary:{query_length:String(request.input.query).length,max_results:request.input.max_results,has_page_token:Boolean(request.input.page_token)},resourceType:'gmail_search',resourceId:null};
  case 'email.read':return{inputSummary:{},resourceType:'gmail_thread',resourceId:String(request.input.thread_id)};
  case 'email.get_attachment':return{inputSummary:{message_id:request.input.message_id,max_bytes:request.input.max_bytes},resourceType:'gmail_attachment',resourceId:String(request.input.attachment_id)};
  case 'crm.search_contacts':return{inputSummary:{query_length:String(request.input.query).length,limit:request.input.limit,page:request.input.page},resourceType:'ghl_contact_search',resourceId:null};
  case 'crm.search_opportunities':return{inputSummary:{query_length:request.input.query?String(request.input.query).length:0,has_contact_id:Boolean(request.input.contact_id),has_pipeline_id:Boolean(request.input.pipeline_id),has_stage_id:Boolean(request.input.stage_id),status:request.input.status,limit:request.input.limit,page:request.input.page},resourceType:'ghl_opportunity_search',resourceId:null};
  case 'crm.list_pipelines':return{inputSummary:{},resourceType:'ghl_pipeline_list',resourceId:null};
  case 'deal.buy_box_fit':return{inputSummary:{contract:'v1'},resourceType:'ema_candidate',resourceId:String(request.input.candidate_id)};
  case 'deal.intake_to_crm':return{inputSummary:{contract:'v2'},resourceType:'ema_candidate',resourceId:String(request.input.candidate_id)};
  case 'deal.reconcile_email_update':return{inputSummary:{contract:'v1',message_id:request.input.message_id,has_candidate_hint:Boolean(request.input.candidate_id),fact_keys:Object.keys(request.input.fact_updates as Record<string,unknown>),document_count:Array.isArray(request.input.documents)?request.input.documents.length:0},resourceType:'gmail_message_reconciliation',resourceId:String(request.input.message_id)};
}}

export function selectedHeaders(headers:unknown):Record<string,string>{const allowed=new Set(['from','to','cc','delivered-to','subject','date','message-id']),result:Record<string,string>={};if(!Array.isArray(headers))return result;for(const header of headers){if(!isRecord(header))continue;const name=String(header.name??'').toLowerCase();if(allowed.has(name))result[name]=String(header.value??'')}return result}
export function extractBody(payload:unknown,mimeType:string):string{if(!isRecord(payload))return'';if(payload.mimeType===mimeType&&isRecord(payload.body)&&typeof payload.body.data==='string')return decodeBase64Url(payload.body.data);if(Array.isArray(payload.parts))for(const part of payload.parts){const value=extractBody(part,mimeType);if(value)return value}return''}
export function extractAttachments(payload:unknown,output:Array<Record<string,unknown>>=[]):Array<Record<string,unknown>>{if(!isRecord(payload))return output;if(typeof payload.filename==='string'&&payload.filename&&isRecord(payload.body)&&typeof payload.body.attachmentId==='string')output.push({filename:payload.filename,mime_type:typeof payload.mimeType==='string'?payload.mimeType:'application/octet-stream',size:typeof payload.body.size==='number'?payload.body.size:null,attachment_id:payload.body.attachmentId});if(Array.isArray(payload.parts))for(const part of payload.parts)extractAttachments(part,output);return output}
export function safeSourceIp(value:string|null):string|null{if(!value)return null;const candidate=value.split(',')[0].trim();return/^[0-9a-fA-F:.]{3,45}$/.test(candidate)?candidate:null}
function decodeBase64Url(value:string):string{try{const normalized=value.replace(/-/g,'+').replace(/_/g,'/'),binary=atob(normalized);return new TextDecoder().decode(Uint8Array.from(binary,c=>c.charCodeAt(0)))}catch{return''}}
function gmailId(value:unknown,field:string):string{const result=requiredString(value,field,1,512);if(!/^[A-Za-z0-9_-]+$/.test(result))throw new RequestValidationError(`${field} is invalid`);return result}
function optionalPageToken(value:unknown):string|null{if(value===undefined||value===null||value==='')return null;const result=requiredString(value,'page_token',1,2048);if(!/^[A-Za-z0-9_-]+$/.test(result))throw new RequestValidationError('page_token is invalid');return result}
function optionalGhlId(value:unknown,field:string):string|null{if(value===undefined||value===null||value==='')return null;const result=requiredString(value,field,1,128);if(!/^[A-Za-z0-9_-]+$/.test(result))throw new RequestValidationError(`${field} is invalid`);return result}
function optionalString(value:unknown,field:string,minimum:number,maximum:number):string|null{if(value===undefined||value===null||value==='')return null;return requiredString(value,field,minimum,maximum)}
function optionalEnum<const T extends readonly string[]>(value:unknown,field:string,allowed:T):T[number]|null{if(value===undefined||value===null||value==='')return null;if(typeof value!=='string'||!allowed.includes(value))throw new RequestValidationError(`${field} is invalid`);return value as T[number]}
function optionalUuid(value:unknown,field:string):string|null{if(value===undefined||value===null||value==='')return null;return uuid(value,field)}
function uuid(value:unknown,field:string):string{const result=requiredString(value,field,36,36).toLowerCase();if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(result))throw new RequestValidationError(`${field} is invalid`);return result}
function requiredString(value:unknown,field:string,minimum:number,maximum:number):string{if(typeof value!=='string')throw new RequestValidationError(`${field} must be a string`);const result=value.trim();if(result.length<minimum||result.length>maximum)throw new RequestValidationError(`${field} must be between ${minimum} and ${maximum} characters`);return result}
function optionalInteger(value:unknown,field:string,minimum:number,maximum:number):number|null{if(value===undefined||value===null)return null;if(!Number.isSafeInteger(value)||Number(value)<minimum||Number(value)>maximum)throw new RequestValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);return Number(value)}
function reconcileFactUpdates(value:unknown):Record<string,string|number|boolean>{if(value===undefined||value===null)return{};if(!isRecord(value))throw new RequestValidationError('fact_updates must be an object');const out:Record<string,string|number|boolean>={};for(const[key,raw]of Object.entries(value)){if(!RECONCILE_FACT_KEYS.has(key))throw new RequestValidationError(`fact_updates.${key} is not allowed`);if(typeof raw==='string'){const v=raw.trim();if(!v||v.length>1000)throw new RequestValidationError(`fact_updates.${key} is invalid`);out[key]=v}else if(typeof raw==='number'&&Number.isFinite(raw)){out[key]=raw}else if(typeof raw==='boolean'){out[key]=raw}else throw new RequestValidationError(`fact_updates.${key} must be a string, number, or boolean`)}return out}
function reconcileDocuments(value:unknown):Array<{attachment_id:string;document_type:typeof PORTFOLIO_DOCUMENT_TYPES[number]}> {if(value===undefined||value===null)return[];if(!Array.isArray(value)||value.length>8)throw new RequestValidationError('documents must be an array with at most 8 items');return value.map((item,index)=>{if(!isRecord(item))throw new RequestValidationError(`documents[${index}] must be an object`);const attachmentId=gmailId(item.attachment_id,`documents[${index}].attachment_id`),documentType=optionalEnum(item.document_type,`documents[${index}].document_type`,PORTFOLIO_DOCUMENT_TYPES);if(!documentType)throw new RequestValidationError(`documents[${index}].document_type is required`);return{attachment_id:attachmentId,document_type:documentType}})}
function isRecord(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value)}
