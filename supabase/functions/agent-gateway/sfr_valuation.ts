import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { calculateCashValue, normalizePropertyType, type CashValueComp, type CashValueSubject } from './cash_value.ts';

const RENTCAST_BASE = 'https://api.rentcast.io/v1';
const MAX_SOURCE_RECORDS = 25;

export class SfrValuationError extends Error {
  constructor(public status:number, public code:string) { super(code); this.name='SfrValuationError'; }
}

interface CandidateRow {
  id:string;
  workspace_id:string;
  normalized_address:string|null;
  extracted_facts:Record<string,unknown>;
  ghl_opportunity_id:string|null;
  is_test:boolean;
}

interface ProviderConfig {
  rentcastApiKey:string|null;
  zillowConfigured:boolean;
}

export interface SfrValuationResult {
  contract:'sfr_valuation_v1';
  candidate_id:string;
  opportunity_id:string|null;
  subject:CashValueSubject;
  providers:{
    rentcast:{status:'used'|'not_configured'|'failed'; comp_count:number; avm:number|null; avm_range:{low:number;high:number}|null; error_code:string|null};
    zillow:{status:'not_configured'|'configured_pending_adapter'};
  };
  comp_source:'rentcast'|'none';
  comps_found:number;
  cash_value:ReturnType<typeof calculateCashValue>;
  notes:string[];
}

export async function runSfrValuation(
  admin:SupabaseClient,
  workspaceId:string,
  candidateId:string,
  fetchImpl:typeof fetch=fetch,
):Promise<SfrValuationResult>{
  const candidate=await loadCandidate(admin,workspaceId,candidateId);
  if(candidate.is_test)throw new SfrValuationError(409,'test_candidate_not_permitted');
  const config=await resolveProviderConfig(admin);
  let subject=subjectFromCandidate(candidate);
  const notes:string[]=[];

  const providerState:SfrValuationResult['providers']={
    rentcast:{status:'not_configured',comp_count:0,avm:null,avm_range:null,error_code:null},
    zillow:{status:config.zillowConfigured?'configured_pending_adapter':'not_configured'},
  };

  let comps:CashValueComp[]=[];
  let compSource:'rentcast'|'none'='none';

  if(config.rentcastApiKey){
    try{
      const rentcast=await fetchRentCastValuation(config.rentcastApiKey,subject,fetchImpl);
      subject=mergeSubject(subject,rentcast.subject);
      comps=rentcast.comps;
      compSource='rentcast';
      providerState.rentcast={status:'used',comp_count:comps.length,avm:rentcast.avm,avm_range:rentcast.avmRange,error_code:null};
    }catch(error){
      const code=error instanceof SfrValuationError?error.code:'rentcast_request_failed';
      providerState.rentcast={status:'failed',comp_count:0,avm:null,avm_range:null,error_code:code};
      notes.push(`RentCast could not provide verified comps (${code}).`);
    }
  }else{
    notes.push('RentCast is not configured; no RentCast API call was attempted.');
  }

  if(!config.zillowConfigured){
    notes.push('Zillow Zestimate API access is not configured yet. When approved, Zillow will be added as a valuation reference fallback, not as a substitute for verified sold comps.');
  }else{
    notes.push('Zillow credentials are present, but the Zillow adapter is intentionally pending until the approved dataset/auth contract is confirmed.');
  }

  if(!subject.sqft||subject.sqft<=0)throw new SfrValuationError(409,'subject_sqft_required');
  const cashValue=calculateCashValue(subject,comps);
  if(cashValue.selected_comp_count>0&&cashValue.selected_comp_count<3){
    notes.push(`Only ${cashValue.selected_comp_count} defensible comp${cashValue.selected_comp_count===1?'':'s'} were found. Cash must submit them to the team even though the comp set is thin.`);
  }
  if(cashValue.selected_comp_count===0)notes.push('No defensible comps were found from the currently available provider set.');

  return{
    contract:'sfr_valuation_v1',
    candidate_id:candidate.id,
    opportunity_id:candidate.ghl_opportunity_id,
    subject,
    providers:providerState,
    comp_source:compSource,
    comps_found:comps.length,
    cash_value:cashValue,
    notes,
  };
}

async function loadCandidate(admin:SupabaseClient,workspaceId:string,candidateId:string):Promise<CandidateRow>{
  const{data,error}=await admin.from('ema_candidates').select('id, workspace_id, normalized_address, extracted_facts, ghl_opportunity_id, is_test').eq('id',candidateId).eq('workspace_id',workspaceId).maybeSingle();
  if(error)throw new SfrValuationError(500,'candidate_lookup_failed');
  if(!data)throw new SfrValuationError(404,'candidate_not_found');
  return data as CandidateRow;
}

async function resolveProviderConfig(admin:SupabaseClient):Promise<ProviderConfig>{
  const keys=['RENTCAST_API_KEY','ZILLOW_ACCESS_TOKEN','ZILLOW_API_TOKEN','ZILLOW_ZESTIMATE_TOKEN'];
  const{data,error}=await admin.from('app_settings').select('key, value').in('key',keys);
  if(error)throw new SfrValuationError(500,'valuation_configuration_lookup_failed');
  const settings:Record<string,string>={};
  for(const row of data??[])if(typeof row.key==='string'&&typeof row.value==='string'&&row.value.trim())settings[row.key]=row.value.trim();
  const rentcastApiKey=settings.RENTCAST_API_KEY||Deno.env.get('RENTCAST_API_KEY')||null;
  const zillowToken=settings.ZILLOW_ACCESS_TOKEN||settings.ZILLOW_API_TOKEN||settings.ZILLOW_ZESTIMATE_TOKEN||Deno.env.get('ZILLOW_ACCESS_TOKEN')||Deno.env.get('ZILLOW_API_TOKEN')||Deno.env.get('ZILLOW_ZESTIMATE_TOKEN')||null;
  return{rentcastApiKey,zillowConfigured:Boolean(zillowToken)};
}

export function subjectFromCandidate(candidate:Pick<CandidateRow,'normalized_address'|'extracted_facts'>):CashValueSubject{
  const facts=candidate.extracted_facts??{};
  const propertyType=stringValue(first(facts,['property_type','propertyType','asset_class','assetClass','type']))??'Single Family Residence';
  const normalizedType=normalizePropertyType(propertyType)??propertyType;
  if(normalizedType!=='Single Family Residence')throw new SfrValuationError(409,'single_family_residence_required');
  const address=stringValue(candidate.normalized_address);
  if(!address)throw new SfrValuationError(409,'normalized_address_required');
  return{
    address,
    property_type:'Single Family Residence',
    sqft:numberValue(first(facts,['sqft','square_feet','squareFeet','living_area','livingArea']))??0,
    year_built:numberValue(first(facts,['year_built','yearBuilt','built_year','builtYear'])),
    beds:numberValue(first(facts,['bedrooms','beds','bed_count','bedCount'])),
    baths:numberValue(first(facts,['bathrooms','baths','bath_count','bathCount'])),
    stories:numberValue(first(facts,['stories','story_count','storyCount','floor_count','floorCount'])),
    build_style:stringValue(first(facts,['build_style','buildStyle','architecture_type','architectureType'])),
  };
}

export async function fetchRentCastValuation(apiKey:string,subject:CashValueSubject,fetchImpl:typeof fetch=fetch):Promise<{subject:Partial<CashValueSubject>;comps:CashValueComp[];avm:number|null;avmRange:{low:number;high:number}|null}>{
  if(!subject.address)throw new SfrValuationError(409,'normalized_address_required');
  const subjectRecord=await rentCastJson(`${RENTCAST_BASE}/properties?${new URLSearchParams({address:subject.address,limit:'1'}).toString()}`,apiKey,fetchImpl);
  const subjectRow=Array.isArray(subjectRecord)?record(subjectRecord[0]):record(subjectRecord);
  const resolvedSubject:Partial<CashValueSubject>={
    sqft:numberValue(subjectRow.squareFootage)??subject.sqft,
    year_built:numberValue(subjectRow.yearBuilt)??subject.year_built,
    beds:numberValue(subjectRow.bedrooms)??subject.beds,
    baths:numberValue(subjectRow.bathrooms)??subject.baths,
    stories:numberValue(record(subjectRow.features).floorCount)??subject.stories,
    build_style:stringValue(record(subjectRow.features).architectureType)??subject.build_style,
  };
  const sqft=Number(resolvedSubject.sqft??0);
  if(!(sqft>0))throw new SfrValuationError(409,'subject_sqft_required');
  const yearBuilt=numberValue(resolvedSubject.year_built);
  const beds=numberValue(resolvedSubject.beds);
  const baths=numberValue(resolvedSubject.baths);
  const params=new URLSearchParams({
    address:subject.address,
    radius:'1',
    propertyType:'Single Family',
    squareFootage:`${Math.max(1,Math.round(sqft-250))}:${Math.round(sqft+250)}`,
    saleDateRange:'365',
    limit:String(MAX_SOURCE_RECORDS),
  });
  if(yearBuilt!==null)params.set('yearBuilt',`${Math.max(1600,Math.round(yearBuilt-20))}:${Math.round(yearBuilt+20)}`);
  if(beds!==null)params.set('bedrooms',`${Math.max(0,beds-1)}:${beds+1}`);
  if(baths!==null)params.set('bathrooms',`${Math.max(0,baths-1)}:${baths+1}`);
  const rawComps=await rentCastJson(`${RENTCAST_BASE}/properties?${params.toString()}`,apiKey,fetchImpl);
  const rows=Array.isArray(rawComps)?rawComps:[];
  const subjectLat=numberValue(subjectRow.latitude),subjectLng=numberValue(subjectRow.longitude);
  const subjectId=stringValue(subjectRow.id);
  const comps:CashValueComp[]=[];
  for(const raw of rows){
    const row=record(raw),id=stringValue(row.id),address=stringValue(row.formattedAddress);
    if(!address||!numberValue(row.lastSalePrice)||!stringValue(row.lastSaleDate)||!numberValue(row.squareFootage))continue;
    if((subjectId&&id===subjectId)||address.toLowerCase()===subject.address.toLowerCase())continue;
    const lat=numberValue(row.latitude),lng=numberValue(row.longitude);
    const distance=subjectLat!==null&&subjectLng!==null&&lat!==null&&lng!==null?haversineMiles(subjectLat,subjectLng,lat,lng):null;
    if(distance===null||distance>1)continue;
    comps.push({
      id,
      address,
      property_type:mapRentCastPropertyType(stringValue(row.propertyType)),
      sqft:Number(row.squareFootage),
      year_built:numberValue(row.yearBuilt),
      beds:numberValue(row.bedrooms),
      baths:numberValue(row.bathrooms),
      stories:numberValue(record(row.features).floorCount),
      build_style:stringValue(record(row.features).architectureType),
      condition:null,
      sale_price:Number(row.lastSalePrice),
      sale_date:String(row.lastSaleDate).slice(0,10),
      distance_miles:Math.round(distance*100)/100,
      source:'rentcast_property_record',
    });
  }

  let avm:number|null=null,avmRange:{low:number;high:number}|null=null;
  try{
    const avmParams=new URLSearchParams({address:subject.address,propertyType:'Single Family',squareFootage:String(Math.round(sqft)),maxRadius:'1',daysOld:'365',compCount:'15',lookupSubjectAttributes:'true'});
    if(beds!==null)avmParams.set('bedrooms',String(beds));
    if(baths!==null)avmParams.set('bathrooms',String(baths));
    const avmRaw=record(await rentCastJson(`${RENTCAST_BASE}/avm/value?${avmParams.toString()}`,apiKey,fetchImpl));
    avm=numberValue(avmRaw.price);
    const low=numberValue(avmRaw.priceRangeLow),high=numberValue(avmRaw.priceRangeHigh);
    if(low!==null&&high!==null)avmRange={low,high};
  }catch{
    // AVM is supporting evidence only; sold-comp retrieval remains usable when AVM fails.
  }
  return{subject:resolvedSubject,comps,avm,avmRange};
}

async function rentCastJson(url:string,apiKey:string,fetchImpl:typeof fetch):Promise<unknown>{
  const response=await fetchImpl(url,{headers:{'X-Api-Key':apiKey,Accept:'application/json'},signal:AbortSignal.timeout(20000)});
  if(response.status===401||response.status===403)throw new SfrValuationError(503,'rentcast_auth_failed');
  if(response.status===429)throw new SfrValuationError(503,'rentcast_rate_limited');
  if(!response.ok)throw new SfrValuationError(502,'rentcast_request_failed');
  return response.json();
}

function mergeSubject(base:CashValueSubject,patch:Partial<CashValueSubject>):CashValueSubject{return{...base,...Object.fromEntries(Object.entries(patch).filter(([,v])=>v!==null&&v!==undefined&&v!==0&&v!==''))} as CashValueSubject}
function mapRentCastPropertyType(value:string|null):string{return value==='Single Family'?'Single Family Residence':value??''}
function first(recordValue:Record<string,unknown>,keys:string[]):unknown{for(const key of keys)if(recordValue[key]!==undefined&&recordValue[key]!==null&&recordValue[key]!=='')return recordValue[key];return null}
function stringValue(value:unknown):string|null{return typeof value==='string'&&value.trim()?value.trim():null}
function numberValue(value:unknown):number|null{if(typeof value==='number'&&Number.isFinite(value))return value;if(typeof value==='string'&&value.trim()&&Number.isFinite(Number(value.replace(/[$,]/g,''))))return Number(value.replace(/[$,]/g,''));return null}
function record(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>: {}}
export function haversineMiles(lat1:number,lng1:number,lat2:number,lng2:number):number{const r=3958.7613,toRad=(v:number)=>v*Math.PI/180,dLat=toRad(lat2-lat1),dLng=toRad(lng2-lng1),a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;return r*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))}
