import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveReferenceRange, evaluateValue } from "../backend/src/utils/reference-resolver.ts";
import { reportReferenceText } from "../frontend/src/lib/report-reference.ts";
import { previewFlag } from "../frontend/src/lib/result-preview.ts";

// Synthetic non-clinical fixtures; these never create or alter master records.
test("one backend resolution drives result text, live abnormal feedback and report text", () => {
  const parameters = [
    { referenceMappings: [
      { mappingType: "SEX_WISE" as const, sex: "MALE" as const, valueType: "NUMERIC" as const, valueFrom: 5, valueTo: 8, displayValue: "Male fixture 5–8" },
      { mappingType: "SEX_WISE" as const, sex: "FEMALE" as const, valueType: "NUMERIC" as const, valueFrom: 10, valueTo: 12, displayValue: "Female fixture 10–12" },
    ] },
    { referenceMappings: [{ mappingType: "GENERIC" as const, valueType: "NUMERIC" as const, valueFrom: 5, valueTo: 8, displayValue: "Generic fixture 5–8" }] },
    { referenceMappings: [{ mappingType: "AGE_WISE" as const, ageUnit: "YEAR" as const, ageFrom: 18, ageTo: 30, valueType: "NUMERIC" as const, valueFrom: 5, valueTo: 8, displayValue: "Age fixture 5–8" }] },
    { referenceMappings: [{ mappingType: "AGE_SEX_WISE" as const, sex: "FEMALE" as const, ageUnit: "YEAR" as const, ageFrom: 18, ageTo: 30, valueType: "NUMERIC" as const, valueFrom: 5, valueTo: 8, displayValue: "Age and sex fixture 5–8" }] },
    { referenceRange: "<20 Deficient\n20-30 Insufficient\n>30 Sufficient" },
    {},
  ];
  for (const parameter of parameters) for (const gender of ["male", "female"]) {
    const resolved = resolveReferenceRange(parameter, { gender, age: 22 });
    assert.equal(reportReferenceText("id", { id: resolved.displayValue }, "obsolete combined text"), resolved.displayValue);
    for (const value of [7, 11, 13]) {
      const backend = evaluateValue(value, resolved);
      const frontend = previewFlag(value, resolved);
      assert.equal(frontend, backend === "IN_RANGE" ? "in-range" : backend === "OUT_OF_RANGE" ? "out-of-range" : "not-comparable");
    }
  }
});
