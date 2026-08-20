export const MCP_SERVER_NAME = "evergreen-agent-gateway";
export const MCP_SERVER_VERSION = "0.7.0";
export const WHOAMI_TOOL_NAME = "system_whoami";

export const MCP_TOOL_ACTIONS = {
  system_whoami: "system.whoami",
  email_list: "email.list",
  email_search: "email.search",
  email_read: "email.read",
  email_get_attachment: "email.get_attachment",
  crm_search_contacts: "crm.search_contacts",
  crm_search_opportunities: "crm.search_opportunities",
  crm_list_pipelines: "crm.list_pipelines",
  deal_buy_box_fit: "deal.buy_box_fit",
  deal_intake_to_crm: "deal.intake_to_crm",
  deal_reconcile_email_update: "deal.reconcile_email_update",
} as const;

export type McpToolName = keyof typeof MCP_TOOL_ACTIONS;
export type GatewayAction = typeof MCP_TOOL_ACTIONS[McpToolName];
export interface GatewayWhoAmI { agent: { id:string; slug:string; name:string }; workspace_id:string }
export interface GatewaySuccess { ok:true; request_id:string; action:GatewayAction; untrusted_external_content?:boolean; data:Record<string,unknown> }
export class GatewayUpstreamError extends Error { constructor(public status:number,public body:string,public retryAfter:string|null=null){super(`Agent Gateway returned HTTP ${status}`);this.name="GatewayUpstreamError"} }
export function resolveGatewayUrl(supabaseUrl:string):string{const normalized=supabaseUrl.trim().replace(/\/+$/,"");if(!normalized.startsWith("https://")&&!normalized.startsWith("http://"))throw new Error("Invalid SUPABASE_URL");return `${normalized}/functions/v1/agent-gateway`}
export function base64UrlToBase64(value:string):string{const normalized=value.replace(/-/g,"+").replace(/_/g,"/");const remainder=normalized.length%4;return remainder===0?normalized:normalized+"=".repeat(4-remainder)}
export function detectAttachmentMimeType(dataBase64Url:string):string{if(dataBase64Url.startsWith("JVBERi0"))return"application/pdf";if(dataBase64Url.startsWith("iVBORw0KGgo"))return"image/png";if(dataBase64Url.startsWith("_9j_"))return"image/jpeg";return"application/octet-stream"}
export function validateAuthorizationHeader(value:string|null):string{if(!value||!/^Bearer\s+\S+$/i.test(value))throw new GatewayUpstreamError(401,JSON.stringify({error:"invalid_credentials"}));return value}
export function parseGatewaySuccess(value:unknown,expectedAction:GatewayAction):GatewaySuccess{if(!isRecord(value)||value.ok!==true||value.action!==expectedAction)throw new Error("Invalid Agent Gateway response");if(typeof value.request_id!=="string"||!isRecord(value.data))throw new Error("Invalid Agent Gateway response");return value as unknown as GatewaySuccess}
export async function callGateway(params:{gatewayUrl:string;authorization:string|null;userAgent:string|null;action:GatewayAction;input:Record<string,unknown>;fetchImpl?:typeof fetch}):Promise<GatewaySuccess>{const authorization=validateAuthorizationHeader(params.authorization),fetchImpl=params.fetchImpl??fetch,headers=new Headers({Authorization:authorization,"Content-Type":"application/json"});if(params.userAgent)headers.set("User-Agent",params.userAgent.slice(0,512));const response=await fetchImpl(params.gatewayUrl,{method:"POST",headers,body:JSON.stringify({action:params.action,input:params.input}),signal:AbortSignal.timeout(20000)}),body=await response.text();if(!response.ok)throw new GatewayUpstreamError(response.status,sanitizeErrorBody(body),response.headers.get("Retry-After"));try{return parseGatewaySuccess(JSON.parse(body),params.action)}catch{throw new GatewayUpstreamError(502,JSON.stringify({error:"invalid_gateway_response"}))}}
export async function authenticateThroughGateway(params:{gatewayUrl:string;authorization:string|null;userAgent:string|null;fetchImpl?:typeof fetch}):Promise<GatewayWhoAmI>{const response=await callGateway({...params,action:"system.whoami",input:{}});if(!isWhoAmI(response.data))throw new GatewayUpstreamError(502,JSON.stringify({error:"invalid_gateway_response"}));return response.data}
function sanitizeErrorBody(body:string):string{try{const parsed=JSON.parse(body);if(isRecord(parsed)&&typeof parsed.error==="string"){const safe:Record<string,unknown>={error:parsed.error};if(typeof parsed.request_id==="string")safe.request_id=parsed.request_id;if(typeof parsed.retry_after_seconds==="number")safe.retry_after_seconds=parsed.retry_after_seconds;return JSON.stringify(safe)}}catch{}return JSON.stringify({error:"agent_gateway_request_failed"})}
function isWhoAmI(value:unknown):value is GatewayWhoAmI{if(!isRecord(value)||typeof value.workspace_id!=="string"||!isRecord(value.agent))return false;return typeof value.agent.id==="string"&&typeof value.agent.slug==="string"&&typeof value.agent.name==="string"}
function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==="object"&&value!==null&&!Array.isArray(value)}
