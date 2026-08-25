import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  EmailIntakeError,
  candidateFingerprint,
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

Deno.test("later property in same Gmail message gets next candidate index instead of overwriting index zero", () => {
  const existing = [{
    candidate_id: "candidate-2627",
    candidate_index: 0,
    normalized_address: "2627 NW 25th Ave, Miami, FL 33142",
    candidate_fingerprint: candidateFingerprint(
      "1a005aef0b0b18ca",
      0,
      "2627 NW 25th Ave, Miami, FL 33142",
    ),
    intake_result: "supported",
    buy_box_fit_result: "needs_info",
    processing_status: "completed",
    ghl_opportunity_id: "old-opportunity",
  }];

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
  const existing = [{
    candidate_id: "candidate-2627",
    candidate_index: 0,
    normalized_address: "2627 NW 25th Ave, Miami, FL 33142",
    candidate_fingerprint: candidateFingerprint(
      "1a005aef0b0b18ca",
      0,
      "2627 NW 25th Ave, Miami, FL 33142",
    ),
    intake_result: "supported",
    buy_box_fit_result: "needs_info",
    processing_status: "completed",
    ghl_opportunity_id: "opportunity-1",
  }];

  const plan = planExistingMessageCandidates(
    "1a005aef0b0b18ca",
    existing,
    [candidate("2627 NW 25th Ave, Miami, FL 33142")],
  );

  assertEquals(plan.matched.map((row) => row.candidate_id), ["candidate-2627"]);
  assertEquals(plan.additions.length, 0);
});

Deno.test("multiple newly discovered properties receive monotonically increasing indexes", () => {
  const existing = [{
    candidate_id: "candidate-2627",
    candidate_index: 0,
    normalized_address: "2627 NW 25th Ave, Miami, FL 33142",
    candidate_fingerprint: candidateFingerprint(
      "1a005aef0b0b18ca",
      0,
      "2627 NW 25th Ave, Miami, FL 33142",
    ),
    intake_result: "supported",
    buy_box_fit_result: "needs_info",
    processing_status: "completed",
    ghl_opportunity_id: null,
  }];

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
  const existing = [{
    candidate_id: "candidate-2627",
    candidate_index: 0,
    normalized_address: "2627 NW 25th Ave, Miami, FL 33142",
    candidate_fingerprint: candidateFingerprint(
      "1a005aef0b0b18ca",
      0,
      "2627 NW 25th Ave, Miami, FL 33142",
    ),
    intake_result: "supported",
    buy_box_fit_result: "needs_info",
    processing_status: "completed",
    ghl_opportunity_id: null,
  }];

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