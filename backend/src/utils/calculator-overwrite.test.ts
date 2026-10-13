import test from "node:test";
import assert from "node:assert/strict";
import {
  calculationBindingChanged,
  normalizeCalculationOverwrite,
  overwriteDecision,
} from "./configured-calculations";

test("overwrite policy defaults to the safe confirmation behaviour and ignores unknown values", () => {
  for (const value of [undefined, null, "", "bogus", "confirm", "never", "calculated"]) {
    assert.equal(normalizeCalculationOverwrite(value as string | null | undefined), "CONFIRM");
  }
  assert.equal(normalizeCalculationOverwrite("CALCULATED"), "CALCULATED");
  assert.equal(normalizeCalculationOverwrite("NEVER"), "NEVER");
});

test("overwrite decision allows an empty target, blanks a never-overwrite target and confirms the default", () => {
  assert.equal(overwriteDecision("NEVER", false), "ALLOW");
  assert.equal(overwriteDecision("NEVER", true), "BLOCK");
  assert.equal(overwriteDecision("CALCULATED", true), "ALLOW");
  assert.equal(overwriteDecision("CONFIRM", true), "CONFIRM");
  assert.equal(overwriteDecision(undefined, true), "CONFIRM");
});

test("changing only the overwrite policy requires fresh approval", () => {
  const base = { formulaId: "mch", dependencyIds: ["a", "b"], precision: 2, overwrite: "CONFIRM" };
  assert.equal(calculationBindingChanged(base, base, "pg", "pg"), false);
  assert.equal(calculationBindingChanged({ ...base, overwrite: "NEVER" }, base, "pg", "pg"), true);
  assert.equal(calculationBindingChanged(base, { ...base, overwrite: "CALCULATED" }, "pg", "pg"), true);
});
