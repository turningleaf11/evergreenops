import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  EmailIntakeError,
  candidateFingerprint,
  mergeMissingSourceFacts,
  planExistingMessageCandidates,
  type CandidateInput,
} from "./email_intake.ts";

Deno.test("candidate fingerprint is deterministic per Gmail message and address", () => {
  assertEquals(
    candidateFingerprint("abc123", 0, "2627 NW 25th Ave, Miami, FL 33142"),
    "prod:abc123:2627-nw-25th-ave-miami-fl-33142",
  );
});

Deno.test("candidate fingerprint has a stable index fallback when address is unknown", () => {
  assertEquals(candidateFingerprint("abc123", 2, null), "prod:abc123:candidate-2");
});

function candidate(address: string | null): CandidateInput {
  return {
    candidate_type: "property",
    normalized_address: address,
    extracted_facts: {},
    evidence: {},
    missing_information: [],
    source_type: "attachment",
    intake_result: "supported",
  };
}

function existingCandidate(params: {
  id?: string;
  index?: number;
  address?: string;
  opportunity?: string | null;
  facts?: Record<string, string | number | boolean | null>;
}) {
  const id = params.id ?? "candidate-2627";
  const index = params.index ?? 0;
  const address = params.address ?? "2627 NW 25th Ave, Miami, FL 33142";
  return {
    candidate_id: id,
    candidate_index: index,
    normalized_address: address,
    candidate_fingerprint: candidateFingerprint("1a005aef0b0b18ca", index, address),
    extracted_facts: params.facts ?? {},
    intake_result: "supported",
    buy_box_fit_result: "needs_info",
    processing_status: "completed",
    ghl_opportunity_id: params.opportunity ?? null,
  };
}

Deno.test("later property in same Gmail message gets next candidate index instead of overwriting index zero", () => {
  const existing = [existingCandidate({ opportunity: "old-opportunity" })];

  const plan = planExistingMessageCandidates(
    "1a005aef0b0b18ca",
    existing,
    [candidate("29910 SW 149th Ave, Homestead, FL 33033")],
  );

  assertEquals(plan.matched.length, 0);
  assertEquals(plan.additions.length, 1);
  assertEquals(plan.additions[0].candidate_index, 1);
  assertEquals(
    plan.additions[0].candidate.normalized_address,
    "29910 SW 149th Ave, Homestead, FL 33033",
  );
});

Deno.test("same property from same Gmail message matches existing candidate by address fingerprint", () => {
  const existing = [existingCandidate({ opportunity: "opportunity-1" })];

  const plan = planExistingMessageCandidates(
    "1a005aef0b0b18ca",
    existing,
    [candidate("2627 NW 25th Ave, Miami, FL 33142")],
  );

  assertEquals(plan.matched.map((row) => row.candidate_id), ["candidate-2627"]);
  assertEquals(plan.additions.length, 0);
});

Deno.test("multiple newly discovered properties receive monotonically increasing indexes", () => {
  const existing = [existingCandidate({})];

  const plan = planExistingMessageCandidates(
    "1a005aef0b0b18ca",
    existing,
    [
      candidate("29910 SW 149th Ave, Homestead, FL 33033"),
      candidate("10470 SW 179th St, Miami, FL 33157"),
    ],
  );

  assertEquals(plan.additions.map((entry) => entry.candidate_index), [1, 2]);
});

Deno.test("even one incremental addressless candidate fails closed instead of position-matching index zero", () => {
  const existing = [existingCandidate({})];

  const error = assertThrows(() =>
    planExistingMessageCandidates(
      "1a005aef0b0b18ca",
      existing,
      [candidate(null)],
    )
  );
  assertEquals(error instanceof EmailIntakeError, true);
  assertEquals((error as EmailIntakeError).code, "candidate_identity_required_for_incremental_email");
});

Deno.test("same-source rerun fills only missing facts and never overwrites known source facts", () => {
  const result = mergeMissingSourceFacts(
    {
      property_type: "single_family",
      asking_price: 325000,
      bedrooms: null,
      hoa: "",
    },
    {
      property_type: "SFR",
      asking_price: 420000,
      bedrooms: 3,
      bathrooms: 2,
      sqft: 1726,
      hoa: "No",
      occupancy: "vacant",
    },
  );

  assertEquals(result.facts.property_type, "single_family");
  assertEquals(result.facts.asking_price, 325000);
  assertEquals(result.facts.bedrooms, 3);
  assertEquals(result.facts.bathrooms, 2);
  assertEquals(result.facts.sqft, 1726);
  assertEquals(result.facts.hoa, "No");
  assertEquals(result.facts.occupancy, "vacant");
  assertEquals(result.filled_fields, ["bedrooms", "bathrooms", "sqft", "hoa", "occupancy"]);
});
