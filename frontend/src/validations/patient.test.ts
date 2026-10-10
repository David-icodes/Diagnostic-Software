import { it } from "node:test";
import assert from "node:assert/strict";
import { patientFormSchema } from "./patient";

it("OSP submission validation accepts 1, 2, 10 and 13 mobile digits without persisting patients", () => {
  for (const mobile of ["1", "12", "9876543210", "1234567890123"]) {
    assert.equal(patientFormSchema.safeParse({ firstName: "TEST PATIENT", gender: "male", dateOfBirth: "", mobile }).success, true, mobile);
  }
  for (const mobile of ["", "12a", "1 2", "+12", "12345678901234"]) {
    assert.equal(patientFormSchema.safeParse({ firstName: "TEST PATIENT", gender: "male", dateOfBirth: "", mobile }).success, false, mobile);
  }
});
