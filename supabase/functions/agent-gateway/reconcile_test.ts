import { messageMentionsAddress, requiresBuyBoxRerun, selectCandidateFromMatches } from './reconcile.ts';
function assert(condition:unknown,message='Assertion failed'):asserts condition{if(!condition)throw new Error(message)}
function assertEquals(actual:unknown,expected:unknown){const a=JSON.stringify(actual),e=JSON.stringify(expected);if(a!==e)throw new Error(`Expected ${e}, received ${a}`)}
const candidates=[
  {id:'11111111-1111-4111-8111-111111111111',normalized_address:'2627 NW 25th Ave, Miami, FL 33142'},
  {id:'22222222-2222-4222-8222-222222222222',normalized_address:'100 Main Street, Miami, FL 33101'},
];
Deno.test('exact or street-form address evidence matches an existing candidate',()=>{const source={id:'m1',thread_id:'t1',headers:{subject:'Documents for 2627 NW 25th Avenue'},body_text:'Attached is the updated T12.'};assert(messageMentionsAddress(source,'2627 NW 25th Ave, Miami, FL 33142'));assert(!messageMentionsAddress(source,'100 Main Street, Miami, FL 33101'))});
Deno.test('multiple thread candidates narrow only with source-backed address evidence',()=>{const source={id:'m1',thread_id:'shared',headers:{subject:'Re: portfolio'},body_text:'Here is the rent roll for 100 Main St.'};const selected=selectCandidateFromMatches(candidates,source,null);assertEquals(selected,candidates[1])});
Deno.test('candidate hint cannot override contradictory source matching',()=>{const source={id:'m1',thread_id:'shared',headers:{subject:'Re: portfolio'},body_text:'Here is the rent roll for 100 Main St.'};const selected=selectCandidateFromMatches(candidates,source,candidates[0].id);assertEquals(selected,null)});
Deno.test('single same-thread candidate does not require the address repeated in every reply',()=>{const source={id:'m1',thread_id:'same',headers:{subject:'Re: requested files'},body_text:'Attached.'};assertEquals(selectCandidateFromMatches([candidates[0]],source,null),candidates[0])});
Deno.test('pricing-only source updates do not require buy-box rerun',()=>{assert(!requiresBuyBoxRerun(['arv','repair_estimate','asking_price']));assert(!requiresBuyBoxRerun(['tenant_rent_monthly']));});
Deno.test('screen-relevant source updates require buy-box rerun',()=>{assert(requiresBuyBoxRerun(['property_type']));assert(requiresBuyBoxRerun(['sqft']));assert(requiresBuyBoxRerun(['hoa']));});
