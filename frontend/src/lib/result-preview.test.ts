import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { enteredNumber, previewFlag } from "./result-preview.ts";
import { resolveCalculations } from "./parameter-calculator.ts";
import type { ReferenceResolution } from "../types/test-result";

const numeric: ReferenceResolution = {
  status: "MATCHED",
  source: "MAPPING",
  valueType: "NUMERIC",
  valueFrom: 5,
  valueTo: 8,
  displayValue: "5 - 8",
  patient: {},
};

describe("result-entry abnormal feedback", () => {
  it("does not misread grouped numeric text as a small comma decimal", () => {
    assert.equal(enteredNumber("7,500"), undefined);
    assert.equal(enteredNumber("1,234,567"), undefined);
    assert.equal(enteredNumber("7,5"), 7.5);
    assert.equal(previewFlag(enteredNumber("7,500"), numeric), "not-comparable");
  });
  it("changes from abnormal to normal and back as 13 becomes 7 then 9", () => {
    const states = ["13", "7", "9"].map((input) => previewFlag(enteredNumber(input), numeric));
    assert.deepEqual(states, ["out-of-range", "in-range", "out-of-range"]);
    assert.equal(numeric.displayValue, "5 - 8");
  });

  it("uses the same feedback for calculator results", () => {
    const calc = resolveCalculations([
      { parameterId: "target", parameterName: "PCV" },
      { parameterId: "cells", parameterName: "RBC" },
      { parameterId: "volume", parameterName: "MCV" },
    ]).find((item) => item.parameterId === "target");
    assert.ok(calc);
    const states = [130, 70, 90].map((volume) => {
      const result = calc.run({ cells: 1, volume });
      assert.ok(result.ok);
      return previewFlag(enteredNumber(String(result.value)), numeric);
    });
    assert.deepEqual(states, ["out-of-range", "in-range", "out-of-range"]);
  });

  it("does not interpret narrative reference text", () => {
    for (const displayValue of ["Negative", "Positive", "Normal", "Reactive", "Non Reactive", "<20 Deficient\n20-30 Insufficient\n>30 Sufficient"]) {
      const reference: ReferenceResolution = { ...numeric, valueType: "NARRATIVE", displayValue };
      assert.equal(previewFlag(13, reference), "not-comparable");
      assert.equal(reference.displayValue, displayValue);
    }
    assert.equal(previewFlag(13, { ...numeric, valueType: undefined }), "not-comparable");
  });

  it("does not compare missing, narrative or non-finite results", () => {
    for (const input of ["", "Negative", "NaN", "Infinity", true]) {
      assert.equal(previewFlag(enteredNumber(input), numeric), "not-comparable");
    }
    assert.equal(previewFlag(13, { ...numeric, valueFrom: undefined, valueTo: undefined }), "not-comparable");
    assert.equal(previewFlag(13, { ...numeric, status: "AMBIGUOUS" }), "not-comparable");
    assert.equal(previewFlag(13, { ...numeric, status: "NO_MAPPING_FOR_PATIENT" }), "not-comparable");
  });
});
