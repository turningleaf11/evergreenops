import { DEALMACHINE_PROPERTY_FIELDS, fetchDealMachineValuation } from '../_shared/dealmachine.ts';
import { fetchRentCastValuation, haversineMiles, subjectFromCandidate, subjectFromOpportunityRecord, SfrValuationError } from './sfr_valuation.ts';
function assert(condition:unknown,message='Assertion failed'):asserts condition{if(!condition)throw new Error(message)}
function assertEquals(actual:unknown,expected:unknown){const a=JSON.stringify(actual),e=JSON.stringify(expected);if(a!==e)throw new Error(`Expected ${e}, received ${a}`)}

Deno.test('builds canonical SFR subject using the existing GHL property-type routing vocabulary',()=>{
  const subject=subjectFromCandidate({normalized_address:'9510 Ashley Dr, Miramar, FL 33025',extracted_facts:{property_type:'SFR',sqft:1800,year_built:1994,bedrooms:4,bathrooms:2}});
  assertEquals(subject,{address:'9510 Ashley Dr, Miramar, FL 33025',property_type:'Single Family Residence',sqft:1800,year_built:1994,beds:4,baths:2,stories:null,build_style:null});
});

Deno.test('builds a manual HighLevel SFR subject from the existing canonical opportunity fields',()=>{
  const subject=subjectFromOpportunityRecord({id:'5BTfmPQlMolS62aCgIRC',name:'9510 Ashley Dr. Miramar, FL 33025',pipelineId:'w3OtDJjCdN840Hwb1fpt',customFields:[{id:'36WeaPwncmXLzUQhbGHd',fieldValueString:'Single Family Residence'},{id:'hH02pevCKOTpmDYfOTnu',fieldValueString:'9510 Ashley Dr. Miramar, FL 33025'}]});
  assertEquals(subject,{address:'9510 Ashley Dr. Miramar, FL 33025',property_type:'Single Family Residence',sqft:0,year_built:null,beds:null,baths:null,stories:null,build_style:null});
});

Deno.test('manual opportunity resolver rejects wrong pipeline or non-SFR property type',()=>{
  try{subjectFromOpportunityRecord({name:'1 Main St',pipelineId:'wrong',customFields:[]});throw new Error('Expected rejection')}catch(error){assert(error instanceof SfrValuationError);assertEquals(error.code,'sfr_pipeline_required')}
  try{subjectFromOpportunityRecord({name:'1 Main St',pipelineId:'w3OtDJjCdN840Hwb1fpt',customFields:[{id:'36WeaPwncmXLzUQhbGHd',fieldValueString:'Condo'}]});throw new Error('Expected rejection')}catch(error){assert(error instanceof SfrValuationError);assertEquals(error.code,'single_family_residence_required')}
});

Deno.test('rejects non-SFR subject before provider lookup',()=>{
  try{subjectFromCandidate({normalized_address:'1 Main St, Miami, FL 33101',extracted_facts:{property_type:'Condo',sqft:900}});throw new Error('Expected rejection')}catch(error){assert(error instanceof SfrValuationError);assertEquals(error.code,'single_family_residence_required')}
});

Deno.test('DealMachine makes one comprehensive subject call and one 12-month comps call',async()=>{
  const requests:Array<{url:string;body:Record<string,unknown>;authorization:string|null}>=[];
  const comp=(id:string,address:string,distance:number,price:number,date:string)=>({
    dm_property_id:id,
    full_address:address,
    property_type:'Single Family Residence',
    living_area_sqft:1780,
    year_built:1993,
    num_bedrooms:4,
    num_bathrooms:2,
    distance_miles:distance,
    sale_price:price,
    sale_date:date,
  });
  const fetchImpl=async(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=String(input);
    const body=JSON.parse(String(init?.body??'{}')) as Record<string,unknown>;
    const headers=new Headers(init?.headers);
    requests.push({url,body,authorization:headers.get('authorization')});
    if(url.endsWith('/enrichment/address'))return new Response(JSON.stringify({
      data:[{
        input:{full_address:'9510 Ashley Dr, Miramar, FL 33025'},matched:true,dm_property_id:'prop-subject',
        full_address:'9510 Ashley Dr, Miramar, FL 33025',latitude:25.99,longitude:-80.27,
        estimated_value:530000,living_area_sqft:1800,year_built:1994,num_bedrooms:4,num_bathrooms:2,
        tax_amount:6432,tax_year:2025,mortgage_1_loan_recording_date:'2020-01-02',lot_size_frontage_feet:75,lot_size_depth_feet:100,
      }],
      totals:{submitted:1,matched:1,unmatched:0},credits:{used:1,properties:1,people:0,deduplicated:0},
    }),{headers:{'X-Request-Id':'req-enrich'}});
    if(url.endsWith('/comps'))return new Response(JSON.stringify({
      data:[{subject_property_id:'prop-subject',comps:[
        comp('comp-1','9500 Example Ave, Miramar, FL 33025',0.2,510000,'2026-06-15'),
        comp('comp-2','9490 Example Ave, Miramar, FL 33025',0.4,520000,'2026-03-15'),
        comp('comp-3','9480 Example Ave, Miramar, FL 33025',0.6,515000,'2026-01-15'),
      ]}],credits:{used:1,properties:1,people:0,deduplicated:1},
    }),{headers:{'X-Request-Id':'req-comps'}});
    return new Response('{}',{status:404});
  };
  const result=await fetchDealMachineValuation('Bearer dm_sk_test_secret','9510 Ashley Dr, Miramar, FL 33025',fetchImpl as typeof fetch);
  assertEquals(result.subject.dm_property_id,'prop-subject');
  assertEquals(result.subject.sqft,1800);
  assertEquals(result.subject.estimated_value,530000);
  assertEquals(result.comps.length,3);
  assertEquals(result.search_pass,'expanded');
  assertEquals(result.property_source,'fetched');
  assertEquals(result.property_facts.tax_amount,6432);
  assertEquals(result.property_facts.tax_year,2025);
  assertEquals(result.credits.people,0);
  assertEquals(result.request_ids,['req-enrich','req-comps']);
  assertEquals(requests.length,2);
  const enrichmentFields=(requests[0].body.fields??[]) as string[];
  assertEquals(requests[0].body.contact_audience,'none');
  assert(enrichmentFields.includes('tax_amount'));
  assert(enrichmentFields.includes('tax_year'));
  assert(enrichmentFields.includes('mortgage_1_loan_recording_date'));
  assert(enrichmentFields.includes('lot_size_frontage_feet'));
  assert(enrichmentFields.includes('lot_size_depth_feet'));
  assert(!enrichmentFields.includes('mortgage_1_recording_date'));
  assert(!enrichmentFields.includes('lot_frontage'));
  assert(!enrichmentFields.includes('lot_depth'));
  assert(!enrichmentFields.includes('foreclosure_past_due_amount'));
  assert(DEALMACHINE_PROPERTY_FIELDS.length<=100);
  const criteria=(requests[1].body.criteria??{}) as Record<string,unknown>;
  assertEquals(criteria.timeframe,'12months');
  assertEquals(criteria.limit,100);
  assertEquals(criteria.include_active_listings,false);
  assertEquals(criteria.include_pending,false);
  assertEquals(criteria.include_foreclosures,false);
  assertEquals(criteria.match_property_type,true);
  assertEquals((requests[1].body.location as Record<string,unknown>).radius_miles,1);
  assert(requests.every((request)=>request.authorization==='Bearer dm_sk_test_secret'));
});

Deno.test('DealMachine reuses a cached subject snapshot and makes only the comps API call',async()=>{
  const requests:Array<{url:string;body:Record<string,unknown>}>=[];
  const fetchImpl=async(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=String(input);
    const body=JSON.parse(String(init?.body??'{}')) as Record<string,unknown>;
    requests.push({url,body});
    if(!url.endsWith('/comps'))return new Response('{}',{status:500});
    return new Response(JSON.stringify({data:[{subject_property_id:'prop-cached',comps:[{
      dm_property_id:'comp-1',full_address:'9500 Example Ave, Miramar, FL 33025',property_type:'Single Family Residence',
      living_area_sqft:1760,year_built:1993,num_bedrooms:4,num_bathrooms:2,distance_miles:.2,sale_price:510000,sale_date:'2026-06-15',
    }]}],credits:{used:1,properties:1,people:0,deduplicated:0}}),{headers:{'X-Request-Id':'req-comps-cached'}});
  };
  const result=await fetchDealMachineValuation('dm_sk_test_secret','9510 Ashley Dr, Miramar, FL 33025',fetchImpl as typeof fetch,{
    dm_property_id:'prop-cached',
    full_address:'9510 Ashley Dr, Miramar, FL 33025',
    facts:{living_area_sqft:1800,year_built:1994,num_bedrooms:4,num_bathrooms:2,estimated_value:530000,tax_amount:6432,tax_year:2025},
  });
  assertEquals(requests.length,1);
  assert(requests[0].url.endsWith('/comps'));
  assertEquals(result.property_source,'cached');
  assertEquals(result.property_request_id,null);
  assertEquals(result.property_credits.used,0);
  assertEquals(result.property_facts.tax_amount,6432);
  assertEquals(result.property_facts.tax_year,2025);
  assertEquals(result.comps.length,1);
});

Deno.test('RentCast adapter searches standard rules first then expands only after a thin standard set',async()=>{
  const seen:string[]=[];
  const fetchImpl=async(input:RequestInfo|URL)=>{
    const url=String(input);seen.push(url);
    if(url.includes('/properties?')&&url.includes('limit=1'))return new Response(JSON.stringify([{id:'subject-id',formattedAddress:'9510 Ashley Dr, Miramar, FL 33025',propertyType:'Single Family',bedrooms:4,bathrooms:2,squareFootage:1800,yearBuilt:1994,latitude:25.99,longitude:-80.27,features:{floorCount:1,architectureType:'Ranch'}}]));
    if(url.includes('/properties?'))return new Response(JSON.stringify([
      {id:'comp-1',formattedAddress:'9500 Example Ave, Miramar, FL 33025',propertyType:'Single Family',bedrooms:4,bathrooms:2,squareFootage:1750,yearBuilt:1992,latitude:25.991,longitude:-80.271,lastSalePrice:510000,lastSaleDate:'2026-06-15T00:00:00.000Z',features:{floorCount:1}},
      {id:'subject-id',formattedAddress:'9510 Ashley Dr, Miramar, FL 33025',propertyType:'Single Family',squareFootage:1800,latitude:25.99,longitude:-80.27,lastSalePrice:400000,lastSaleDate:'2026-01-01T00:00:00.000Z'},
      {id:'unsold',formattedAddress:'9400 No Sale St, Miramar, FL 33025',propertyType:'Single Family',squareFootage:1810,latitude:25.992,longitude:-80.272},
    ]));
    if(url.includes('/avm/value'))return new Response(JSON.stringify({price:525000,priceRangeLow:500000,priceRangeHigh:550000}));
    return new Response('{}',{status:404});
  };
  const result=await fetchRentCastValuation('test-key',{address:'9510 Ashley Dr, Miramar, FL 33025',property_type:'Single Family Residence',sqft:1800,year_built:1994,beds:4,baths:2},fetchImpl as typeof fetch);
  assertEquals(result.comps.length,1);
  assertEquals(result.comps[0].property_type,'Single Family Residence');
  assertEquals(result.comps[0].sale_price,510000);
  assertEquals(result.avm,525000);
  assertEquals(result.avmRange,{low:500000,high:550000});
  const compRequests=seen.filter(url=>url.includes('/properties?')&&!url.includes('limit=1'));
  assertEquals(compRequests.length,2);
  const standard=compRequests.find(url=>url.includes('saleDateRange=180'))??'';
  const expanded=compRequests.find(url=>url.includes('saleDateRange=365'))??'';
  assert(standard.includes('radius=1'));
  assert(standard.includes('squareFootage=1550%3A2050'));
  assert(standard.includes('yearBuilt=1984%3A2004'));
  assert(expanded.includes('radius=1'));
  assert(expanded.includes('squareFootage=1550%3A2050'));
  assert(expanded.includes('yearBuilt=1974%3A2014'));
});

Deno.test('RentCast adapter does not expand when at least three standard comps are available',async()=>{
  const seen:string[]=[];
  const fetchImpl=async(input:RequestInfo|URL)=>{
    const url=String(input);seen.push(url);
    if(url.includes('/properties?')&&url.includes('limit=1'))return new Response(JSON.stringify([{id:'subject-id',formattedAddress:'9510 Ashley Dr, Miramar, FL 33025',propertyType:'Single Family',bedrooms:4,bathrooms:2,squareFootage:1800,yearBuilt:1994,latitude:25.99,longitude:-80.27}]));
    if(url.includes('/properties?'))return new Response(JSON.stringify([
      {id:'c1',formattedAddress:'1 A St, Miramar, FL 33025',propertyType:'Single Family',bedrooms:4,bathrooms:2,squareFootage:1750,yearBuilt:1992,latitude:25.991,longitude:-80.271,lastSalePrice:510000,lastSaleDate:'2026-06-15'},
      {id:'c2',formattedAddress:'2 B St, Miramar, FL 33025',propertyType:'Single Family',bedrooms:4,bathrooms:2,squareFootage:1810,yearBuilt:1994,latitude:25.992,longitude:-80.272,lastSalePrice:520000,lastSaleDate:'2026-05-15'},
      {id:'c3',formattedAddress:'3 C St, Miramar, FL 33025',propertyType:'Single Family',bedrooms:3,bathrooms:2,squareFootage:1850,yearBuilt:1996,latitude:25.993,longitude:-80.273,lastSalePrice:530000,lastSaleDate:'2026-04-15'},
    ]));
    if(url.includes('/avm/value'))return new Response(JSON.stringify({price:525000}));
    return new Response('{}',{status:404});
  };
  const result=await fetchRentCastValuation('test-key',{address:'9510 Ashley Dr, Miramar, FL 33025',property_type:'Single Family Residence',sqft:1800,year_built:1994,beds:4,baths:2},fetchImpl as typeof fetch);
  assertEquals(result.comps.length,3);
  assertEquals(seen.filter(url=>url.includes('/properties?')&&!url.includes('limit=1')).length,1);
});

Deno.test('haversine distance is deterministic for nearby coordinates',()=>{
  const distance=haversineMiles(25.99,-80.27,25.991,-80.271);
  assert(distance>0&&distance<1);
});