import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { filenameMentionsAddress, textMentionsAddress } from "./source_documents.ts";

Deno.test("property-sheet filename matches only its normalized property address", () => {
  const filename = "29910-SW-149th-Ave-Property-Sheet.pdf";
  assertEquals(
    filenameMentionsAddress(filename, "29910 SW 149th Ave, Homestead, FL 33033"),
    true,
  );
  assertEquals(
    filenameMentionsAddress(filename, "2627 NW 25th Ave, Miami, FL 33142"),
    false,
  );
});

Deno.test("extracted PDF text can verify candidate identity when filename is generic", () => {
  const text = `Property Summary\n29910 SW 149th Ave, Homestead, FL 33033\n3 beds / 2 baths`;
  assertEquals(
    textMentionsAddress(text, "29910 SW 149th Ave, Homestead, FL 33033"),
    true,
  );
  assertEquals(
    textMentionsAddress(text, "2627 NW 25th Ave, Miami, FL 33142"),
    false,
  );
});

Deno.test("address matching tolerates punctuation and filename separators", () => {
  assertEquals(
    filenameMentionsAddress(
      "29910_SW-149th.Ave details.pdf",
      "29910 SW 149th Ave, Homestead, FL 33033",
    ),
    true,
  );
});
