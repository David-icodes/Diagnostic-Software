import { it } from "node:test";
import assert from "node:assert/strict";
import { resolveReferenceRange, evaluateValue } from "./reference-resolver";

it("configured legacy gender rows display and compare the same single applicable row", () => {
  const parameter = { referenceType: "GENDER_WISE", referenceRange: "old combined male and female text", genderRanges: [
    { gender: "M" as const, from: 5, to: 8, text: "5-8 configured male" },
    { gender: "F" as const, from: 9, to: 12, text: "9-12 configured female" },
  ] };
  const male = resolveReferenceRange(parameter, { gender: "male" });
  const female = resolveReferenceRange(parameter, { gender: "female" });
  assert.equal(male.displayValue, parameter.genderRanges[0].text);
  assert.equal(female.displayValue, parameter.genderRanges[1].text);
  assert.equal(evaluateValue(10, male), "OUT_OF_RANGE");
  assert.equal(evaluateValue(10, female), "IN_RANGE");
  assert.equal(resolveReferenceRange(parameter, { gender: "other" }).displayValue, "");
  assert.equal(resolveReferenceRange({ ...parameter, genderRanges: [...parameter.genderRanges, parameter.genderRanges[0]] }, { gender: "male" }).status, "AMBIGUOUS");
  const narrative = "<20 Deficient\n20-30 Insufficient\n>30 Sufficient";
  const resolved = resolveReferenceRange({ referenceType: "GENDER_WISE", genderRanges: [{ gender: "F", text: narrative }] }, { gender: "female" });
  assert.equal(resolved.displayValue, narrative);
  assert.equal(evaluateValue(25, resolved), "NOT_COMPARABLE");
});

// Synthetic configuration fixtures exercise the real resolver without master/database writes.
it("male and female configured mappings each return only their exact complete display text", () => {
  const parameter = { referenceRange: "obsolete raw combined text", referenceMappings: [
    { mappingType: "SEX_WISE" as const, sex: "MALE" as const, valueType: "NARRATIVE" as const, displayValue: "Configured male wording\nAdditional male instruction" },
    { mappingType: "SEX_WISE" as const, sex: "FEMALE" as const, valueType: "NARRATIVE" as const, displayValue: "Configured female wording\nAdditional female instruction" },
  ] };
  for (const [gender, index] of [["male", 0], ["female", 1]] as const) {
    const resolved = resolveReferenceRange(parameter, { gender, age: 29 });
    assert.equal(resolved.source, "MAPPING");
    assert.equal(resolved.displayValue, parameter.referenceMappings[index].displayValue);
  }
});
it("generic, narrative, missing and unmatched references retain the existing authoritative policy", () => {
  const generic = resolveReferenceRange({ referenceMappings: [{ mappingType: "GENERIC", valueType: "NARRATIVE", displayValue: "Generic exact wording" }] }, { gender: "female" });
  assert.equal(generic.displayValue, "Generic exact wording");
  const narrative = "< 20 Deficient\n20-30 Insufficient\n>30 Sufficient";
  const resolved = resolveReferenceRange({ referenceRange: narrative }, { gender: "male" });
  assert.equal(resolved.displayValue, narrative);
  assert.equal(evaluateValue("25", resolved), "NOT_COMPARABLE");
  assert.equal(resolveReferenceRange({}, { gender: "female" }).displayValue, "");
  assert.equal(resolveReferenceRange({ referenceMappings: [{ mappingType: "SEX_WISE", sex: "MALE", valueType: "NARRATIVE", displayValue: "Male only" }] }, { gender: "female" }).status, "NO_MAPPING_FOR_PATIENT");
});
