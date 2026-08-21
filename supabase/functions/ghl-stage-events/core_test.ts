import {
  parseHighLevelEnvelope,
  PORTFOLIO_PIPELINE_ID,
  PORTFOLIO_READY_FOR_NAPKIN_STAGE_ID,
  processAuthenticatedStageEvent,
  SFR_PIPELINE_ID,
  SFR_UNDERWRITING_STAGE_ID,
  verifyHighLevelSignature,
  type HighLevelEnvelope,
  type ReconcileResult,
  type StageEventDependencies,
  type WorkKind,
} from './core.ts';

const WORKSPACE_ID = 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9';
const LOCATION_ID = 'P1eXkPmyGMQD6hHTIQiC';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {if (!condition) throw new Error(message);}
function assertEquals(actual: unknown, expected: unknown): void {const a = JSON.stringify(actual),e = JSON.stringify(expected);if (a !== e) throw new Error(`Expected ${e}, received ${a}`);}

function event(overrides: Partial<HighLevelEnvelope> = {}): HighLevelEnvelope {
  return {type:'OpportunityStageUpdate',locationId:LOCATION_ID,opportunityId:'opp_123',pipelineId:SFR_PIPELINE_ID,pipelineStageId:SFR_UNDERWRITING_STAGE_ID,webhookId:'wh_123',eventTimestamp:'2026-08-20T19:30:00.000Z',rawMetadata:{},...overrides};
}
function context(){return{workspaceId:WORKSPACE_ID,expectedLocationId:LOCATION_ID,payloadSha256:'a'.repeat(64),rawSizeBytes:250,receivedAt:'2026-08-20T19:30:00.000Z'}}
function deps(options:{duplicate?:boolean;live?:null|{id:string;location_id:string|null;pipeline_id:string|null;stage_id:string|null;name?:string|null};candidate?:null|{id:string;cash_task_id:string|null;normalized_address:string|null};reconcile?:(input:{workKind:WorkKind;candidateId:string|null})=>ReconcileResult|Promise<ReconcileResult>}={}):{value:StageEventDependencies;finalized:Array<{decision:string}>;reconciledKinds:WorkKind[];reconciledCandidateIds:Array<string|null>}{
  const finalized:Array<{decision:string}>=[],reconciledKinds:WorkKind[]=[],reconciledCandidateIds:Array<string|null>=[];
  const value:StageEventDependencies={
    reserve:async()=>({eventId:'event_123',duplicate:options.duplicate??false}),
    finalize:async(_eventId,input)=>{finalized.push({decision:input.decision})},
    getLiveOpportunity:async()=>options.live===null?null:(options.live??{id:'opp_123',location_id:LOCATION_ID,pipeline_id:SFR_PIPELINE_ID,stage_id:SFR_UNDERWRITING_STAGE_ID,name:'123 Main St'}),
    findCandidate:async()=>options.candidate===null?null:(options.candidate??{id:'candidate_123',cash_task_id:null,normalized_address:'123 Main St'}),
    reconcile:async(input)=>{reconciledKinds.push(input.workKind);reconciledCandidateIds.push(input.candidateId);if(options.reconcile)return await options.reconcile({workKind:input.workKind,candidateId:input.candidateId});return{work_item_id:'work_123',agent_task_id:'task_123',reused_work_item:false,reused_task:false,reopened:false,legacy_reconciled:false,activation_count:1}},
  };
  return{value,finalized,reconciledKinds,reconciledCandidateIds};
}

Deno.test('valid SFR Underwriting event creates SFR underwriting envelope',async()=>{const fake=deps();const result=await processAuthenticatedStageEvent(event(),context(),fake.value);assertEquals(result.decision,'activated');assertEquals(result.cashTaskId,'task_123');assertEquals(fake.reconciledKinds,['sfr_underwriting']);assertEquals(fake.reconciledCandidateIds,['candidate_123'])});
Deno.test('verified manual HighLevel opportunity activates Cash even without an Ema candidate',async()=>{const fake=deps({candidate:null,live:{id:'opp_123',location_id:LOCATION_ID,pipeline_id:SFR_PIPELINE_ID,stage_id:SFR_UNDERWRITING_STAGE_ID,name:'9510 Ashley Dr. Miramar, FL 33025'}});const result=await processAuthenticatedStageEvent(event(),context(),fake.value);assertEquals(result.decision,'activated');assertEquals(result.cashTaskId,'task_123');assertEquals(fake.reconciledKinds,['sfr_underwriting']);assertEquals(fake.reconciledCandidateIds,[null])});
Deno.test('valid Portfolio Ready for Napkin event creates napkin envelope',async()=>{const fake=deps({live:{id:'opp_123',location_id:LOCATION_ID,pipeline_id:PORTFOLIO_PIPELINE_ID,stage_id:PORTFOLIO_READY_FOR_NAPKIN_STAGE_ID}});const result=await processAuthenticatedStageEvent(event({pipelineId:PORTFOLIO_PIPELINE_ID,pipelineStageId:PORTFOLIO_READY_FOR_NAPKIN_STAGE_ID}),context(),fake.value);assertEquals(result.decision,'activated');assertEquals(fake.reconciledKinds,['portfolio_napkin'])});
Deno.test('wrong pipeline fails closed without Cash work',async()=>{const fake=deps();const result=await processAuthenticatedStageEvent(event({pipelineId:'other_pipeline'}),context(),fake.value);assertEquals(result.decision,'ignored_wrong_pipeline');assertEquals(fake.reconciledKinds,[])});
Deno.test('wrong stage fails closed without Cash work',async()=>{const fake=deps();const result=await processAuthenticatedStageEvent(event({pipelineStageId:'other_stage'}),context(),fake.value);assertEquals(result.decision,'ignored_wrong_stage');assertEquals(fake.reconciledKinds,[])});
Deno.test('forged or altered webhook fails Ed25519 verification',async()=>{const keyPair=await crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']) as CryptoKeyPair;const raw=JSON.stringify({type:'OpportunityStageUpdate',id:'opp_123'});const signature=new Uint8Array(await crypto.subtle.sign({name:'Ed25519'},keyPair.privateKey,new TextEncoder().encode(raw)));const spki=new Uint8Array(await crypto.subtle.exportKey('spki',keyPair.publicKey));const signatureB64=bytesToBase64(signature),publicKeyB64=bytesToBase64(spki);assert(await verifyHighLevelSignature(raw,signatureB64,publicKeyB64));assert(!(await verifyHighLevelSignature(raw+' ',signatureB64,publicKeyB64)));assert(!(await verifyHighLevelSignature(raw,'not-a-signature',publicKeyB64)))});
Deno.test('duplicate delivery is acknowledged without duplicate Cash work',async()=>{const fake=deps({duplicate:true});const result=await processAuthenticatedStageEvent(event(),context(),fake.value);assertEquals(result.decision,'duplicate');assertEquals(fake.reconciledKinds,[])});
Deno.test('move out and back into trigger stage reuses the same work envelope',async()=>{let workExists=false;const sharedTaskId='task_same';const fake=deps({reconcile:()=>{const reused=workExists;workExists=true;return{work_item_id:'work_same',agent_task_id:sharedTaskId,reused_work_item:reused,reused_task:reused,reopened:reused,legacy_reconciled:false,activation_count:reused?2:1}}});const first=await processAuthenticatedStageEvent(event({webhookId:'entry_1'}),context(),fake.value);const out=await processAuthenticatedStageEvent(event({webhookId:'out_1',pipelineStageId:'not_trigger'}),context(),fake.value);const second=await processAuthenticatedStageEvent(event({webhookId:'entry_2'}),context(),fake.value);assertEquals(first.cashTaskId,sharedTaskId);assertEquals(out.decision,'ignored_wrong_stage');assertEquals(second.decision,'reconciled');assertEquals(second.cashTaskId,sharedTaskId);assertEquals(fake.reconciledKinds,['sfr_underwriting','sfr_underwriting'])});
Deno.test('existing legacy Cash task is reconciled rather than duplicated',async()=>{const legacyTaskId='4cb30f1c-11de-443f-bf53-68fbf67354f9';const fake=deps({candidate:{id:'fcec7026-4bfc-4860-a80c-465e83584a93',cash_task_id:legacyTaskId,normalized_address:'2627 NW 25th Ave, Miami, FL 33142'},reconcile:()=>({work_item_id:'work_legacy',agent_task_id:legacyTaskId,reused_work_item:false,reused_task:true,reopened:true,legacy_reconciled:true,activation_count:1})});const result=await processAuthenticatedStageEvent(event({opportunityId:'opp_123'}),context(),fake.value);assertEquals(result.decision,'reconciled');assertEquals(result.cashTaskId,legacyTaskId);assertEquals(fake.reconciledKinds.length,1)});
Deno.test('malformed stage payload is rejected before Cash work',async()=>{const parsed=parseHighLevelEnvelope({type:'OpportunityStageUpdate',locationId:LOCATION_ID,webhookId:'malformed_1'});const fake=deps();const result=await processAuthenticatedStageEvent(parsed,context(),fake.value);assertEquals(result.decision,'malformed');assertEquals(fake.reconciledKinds,[])});
Deno.test('unknown live opportunity creates no Cash work',async()=>{const fake=deps({live:null});const result=await processAuthenticatedStageEvent(event(),context(),fake.value);assertEquals(result.decision,'unknown_opportunity');assertEquals(fake.reconciledKinds,[])});
Deno.test('signed event is rechecked against live pipeline and stage before activation',async()=>{const fake=deps({live:{id:'opp_123',location_id:LOCATION_ID,pipeline_id:SFR_PIPELINE_ID,stage_id:'moved_elsewhere'}});const result=await processAuthenticatedStageEvent(event(),context(),fake.value);assertEquals(result.decision,'stale_or_mismatched_opportunity');assertEquals(fake.reconciledKinds,[])});

function bytesToBase64(bytes:Uint8Array):string{let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary)}