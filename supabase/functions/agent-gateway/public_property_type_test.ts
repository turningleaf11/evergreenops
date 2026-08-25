import { resolvePublicPropertyType } from './public_property_type.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

Deno.test('HCAD free lookup resolves A1 to SFR without owner/contact fields', async () => {
  let requested = '';
  const fetchImpl = async (input: RequestInfo | URL) => {
    requested = String(input);
    return new Response(JSON.stringify({
      features: [{
        attributes: {
          HCAD_NUM: '1234567890123',
          state_class: 'A1',
          land_use: '1001',
          dscr: 'RESIDENTIAL',
          Full_Address: '3038 SKYPARK DR',
          site_city: 'HOUSTON',
          site_county: 'HARRIS',
          site_zip: '77082',
        },
      }],
    }), { headers: { 'content-type': 'application/json' } });
  };

  const result = await resolvePublicPropertyType(
    '3038 Skypark Dr, Houston, TX 77082, USA',
    { city: 'Houston', state: 'TX', zip: '77082' },
    fetchImpl as typeof fetch,
  );

  assertEquals(result.status, 'resolved');
  assertEquals(result.provider, 'hcad_arcgis');
  assertEquals(result.property_type, 'Single Family Residence');
  assertEquals(result.classification_code, 'A1');
  assert(requested.includes('site_str_num+%3D+3038') || requested.includes('site_str_num%20%3D%203038'));
  assert(requested.includes('state_class'));
  assert(!requested.toLowerCase().includes('owner_name'));
  assert(!requested.toLowerCase().includes('mail_addr'));
});

Deno.test('BCPA free lookup resolves official use code 01 to SFR', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    features: [{
      attributes: {
        FOLIO: '514129010010',
        USE_CODE: '01',
        FULL_SITE_ADDRESS: '123 MAIN ST',
        CITY_NAME: 'MIRAMAR',
      },
    }],
  }), { headers: { 'content-type': 'application/json' } });

  const result = await resolvePublicPropertyType(
    '123 Main St, Miramar, FL 33025',
    { city: 'Miramar', state: 'FL', county: 'Broward County', zip: '33025' },
    fetchImpl as typeof fetch,
  );

  assertEquals(result.status, 'resolved');
  assertEquals(result.provider, 'bcpa_arcgis');
  assertEquals(result.property_type, 'Single Family Residence');
  assertEquals(result.classification_code, '01');
});

Deno.test('BCPA condo code resolves explicitly so buy box can reject without DealMachine', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    features: [{ attributes: { FOLIO: '1', USE_CODE: '04', FULL_SITE_ADDRESS: '1 OCEAN DR', CITY_NAME: 'HOLLYWOOD' } }],
  }), { headers: { 'content-type': 'application/json' } });

  const result = await resolvePublicPropertyType(
    '1 Ocean Dr, Hollywood, FL 33019',
    { city: 'Hollywood', state: 'FL', county: 'Broward' },
    fetchImpl as typeof fetch,
  );
  assertEquals(result.property_type, 'Condo');
});

Deno.test('ambiguous public parcel match fails open to paid fallback instead of guessing', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    features: [
      { attributes: { HCAD_NUM: '1', state_class: 'A1', Full_Address: '3038 SKYPARK DR' } },
      { attributes: { HCAD_NUM: '2', state_class: 'A1', Full_Address: '3038 SKYPARK DR UNIT A' } },
    ],
  }), { headers: { 'content-type': 'application/json' } });

  const result = await resolvePublicPropertyType(
    '3038 Skypark Dr, Houston, TX 77082',
    { city: 'Houston', state: 'TX' },
    fetchImpl as typeof fetch,
  );
  assertEquals(result.status, 'ambiguous');
  assertEquals(result.property_type, null);
});

Deno.test('unsupported geography does not make a public HTTP request', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response('{}');
  };
  const result = await resolvePublicPropertyType(
    '10 Main St, Nashville, TN 37201',
    { city: 'Nashville', state: 'TN' },
    fetchImpl as typeof fetch,
  );
  assertEquals(result.status, 'not_supported');
  assertEquals(calls, 0);
});
