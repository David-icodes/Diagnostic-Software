import { it } from "node:test";
import assert from "node:assert/strict";
import { reportReferenceText } from "./report-reference.ts";

it("report uses complete backend-resolved sex/generic/narrative text instead of stale raw ranges", () => {
  const raw = "Males: raw male\nFemales: raw female";
  for (const text of ["configured male text", "configured female text", "configured generic text", "< 20 Deficient\n20-30 Insufficient\n>30 Sufficient"]) {
    assert.equal(reportReferenceText("p", { p: text }, raw), text);
  }
});
it("an empty authoritative resolution never falls back to a different patient's or legacy range", () => {
  assert.equal(reportReferenceText("p", { p: "" }, "old raw range"), "");
  assert.equal(reportReferenceText("p", undefined, "historical text"), "historical text");
});
