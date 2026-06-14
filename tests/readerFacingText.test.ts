import test from "node:test";
import assert from "node:assert/strict";
import { readerFacingNote } from "../src/lib/readerFacingText";

test("readerFacingNote removes internal review-only caveat phrasing", () => {
  assert.equal(
    readerFacingNote(
      "Reviewed only as a standards-adjacent safety framework. Reviewed only for FCC filing status.",
    ),
    "used only as a standards-adjacent safety framework. used only for FCC filing status.",
  );
});
