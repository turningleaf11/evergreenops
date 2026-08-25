import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseNormalizedAddressFacts, resolveFreeFloridaCounty } from "./public_geography.ts";

Deno.test("normalized address parsing fills city state and zip without a network call", () => {
  assertEquals(parseNormalizedAddressFacts("29910 SW 149th Ave, Homestead, FL 33033"), {
    city: "Homestead",
    state: "FL",
    zip: "33033",
  });
});

Deno.test("Florida county resolver uses Census geographies and returns Miami-Dade County", async () => {
  let calls = 0;
  const fetchImpl = (async (url: string | URL | Request) => {
    calls += 1;
    const text = String(url);
    if (!text.includes("benchmark=Public_AR_Current")) throw new Error("missing benchmark");
    if (!text.includes("vintage=Current_Current")) throw new Error("missing vintage");
    return new Response(JSON.stringify({
      result: {
        addressMatches: [{
          matchedAddress: "29910 SW 149TH AVE, HOMESTEAD, FL, 33033",
          addressComponents: { city: "HOMESTEAD", state: "FL", zip: "33033" },
          geographies: { Counties: [{ NAME: "Miami-Dade County" }] },
        }],
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  const result = await resolveFreeFloridaCounty(
    "29910 SW 149th Ave, Homestead, FL 33033",
    { property_type: "single_family" },
    fetchImpl,
  );

  assertEquals(calls, 1);
  assertEquals(result.status, "resolved");
  assertEquals(result.provider, "census_geocoder");
  assertEquals(result.county, "Miami-Dade County");
  assertEquals(result.state, "FL");
  assertEquals(result.city, "HOMESTEAD");
  assertEquals(result.zip, "33033");
});

Deno.test("non-Florida address does not call Census county lookup", async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    throw new Error("unexpected call");
  }) as typeof fetch;

  const result = await resolveFreeFloridaCounty(
    "3038 Skypark Dr, Houston, TX 77082",
    {},
    fetchImpl,
  );

  assertEquals(calls, 0);
  assertEquals(result.status, "not_supported");
  assertEquals(result.provider, "none");
});
