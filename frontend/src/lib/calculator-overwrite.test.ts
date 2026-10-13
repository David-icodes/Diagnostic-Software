import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCalculationOverwrite, overwriteDecision } from "./configured-calculations.ts";

test("overwrite policy defaults to confirmation and drives the apply decision", () => {
  assert.equal(normalizeCalculationOverwrite(undefined), "CONFIRM");
  assert.equal(normalizeCalculationOverwrite("garbage"), "CONFIRM");
  assert.equal(normalizeCalculationOverwrite("NEVER"), "NEVER");
  // Nothing entered yet: always safe to fill the calculated value.
  assert.equal(overwriteDecision(undefined, false), "ALLOW");
  // Default policy asks before replacing an entered value.
  assert.equal(overwriteDecision(undefined, true), "CONFIRM");
  // Approved override policy replaces without a prompt.
  assert.equal(overwriteDecision("CALCULATED", true), "ALLOW");
  // Approved keep policy never overwrites an entered value.
  assert.equal(overwriteDecision("NEVER", true), "BLOCK");
});
