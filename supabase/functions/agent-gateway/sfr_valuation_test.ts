import { fetchRentCastValuation, haversineMiles, subjectFromCandidate, SfrValuationError } from './sfr_valuation.ts';
function assert(condition:unknown,message='Assertion failed'):asserts condition{if(!condition)throw new Error(message)}
function assertEquals(actual:unknown,expected:unknown){const a=JSON.stringify(actual),e=JSON.stringify(expected);if(a!==e)throw new Error(`Expected ${e}, received ${a}`)}

Deno.test('builds canonical SFR subject using the existing GHL property-type routing vocabulary',()=>{
  const subject=subjectFromCandidate({normalized_address:'9510 Ashley Dr, Miramar, FL 33025',extracted_facts:{property_type:'SFR',sqft:1800,year_built:1994,bedrooms:4,bathrooms:2}});
  assertEquals(subject,{address:'9510 Ashley Dr, Miramar, FL 33025',property_type:'Single Family Residence',sqft:1800,year_built:1994,beds:4,baths:2,stories:null,build_style:null});
});

Deno.test('rejects non-SFR subject before provider lookup',()=>{
  try{subjectFromCandidate({normalized_address:'1 Main St, Miami, FL 33101',extracted_facts:{property_type:'Condo',sqft:900}});throw new Error('Expected rejection')}catch(error){assert(error instanceof SfrValuationError);assertEquals(error.code,'single_family_residence_required')}
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
