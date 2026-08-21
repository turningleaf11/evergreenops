import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { candidateFingerprint } from "./email_intake.ts";

Deno.test("candidate fingerprint is deterministic per Gmail message and address", () => {
  assertEquals(
    candidateFingerprint("abc123", 0, "2627 NW 25th Ave, Miami, FL 33142"),
    "prod:abc123:2627-nw-25th-ave-miami-fl-33142",
  );
});

Deno.test("candidate fingerprint has a stable index fallback when address is unknown", () => {
  assertEquals(candidateFingerprint("abc123", 2, null), "prod:abc123:candidate-2");
});
