import { fetchRentCastValuation, haversineMiles, subjectFromCandidate, SfrValuationError } from './sfr_valuation.ts';
function assert(condition:unknown,message='Assertion failed'):asserts condition{if(!condition)throw new Error(message)}
function assertEquals(actual:unknown,expected:unknown){const a=JSON.stringify(actual),e=JSON.stringify(expected);if(a!==e)throw new Error(`Expected ${e}, received ${a}`)}

Deno.test('builds canonical SFR subject from Ema candidate facts',()=>{
  const subject=subjectFromCandidate({normalized_address:'9510 Ashley Dr, Miramar, FL 33025',extracted_facts:{property_type:'SFR',sqft:1800,year_built:1994,bedrooms:4,bathrooms:2}});
  assertEquals(subject,{address:'9510 Ashley Dr, Miramar, FL 33025',property_type:'Single Family Residence',sqft:1800,year_built:1994,beds:4,baths:2,stories:null,build_style:null});
});

Deno.test('rejects non-SFR subject before provider lookup',()=>{
  try{subjectFromCandidate({normalized_address:'1 Main St, Miami, FL 33101',extracted_facts:{property_type:'Condo',sqft:900}});throw new Error('Expected rejection')}catch(error){assert(error instanceof SfrValuationError);assertEquals(error.code,'single_family_residence_required')}
});

Deno.test('RentCast adapter requests expanded candidate pool but returns only real sold property records',async()=>{
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
  const compRequest=seen.find(url=>url.includes('/properties?')&&!url.includes('limit=1'))??'';
  assert(compRequest.includes('radius=1'));
  assert(compRequest.includes('saleDateRange=365'));
  assert(compRequest.includes('squareFootage=1550%3A2050'));
  assert(compRequest.includes('yearBuilt=1974%3A2014'));
});

Deno.test('haversine distance is deterministic for nearby coordinates',()=>{
  const distance=haversineMiles(25.99,-80.27,25.991,-80.271);
  assert(distance>0&&distance<1);
});
