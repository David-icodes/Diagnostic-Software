import { it } from "node:test";
import assert from "node:assert/strict";
import { createPatientSchema, updatePatientSchema } from "./patient";

it("patient API submission validation accepts partial digits and rejects nonnumeric mobile values without database writes", () => {
  for (const mobile of ["1", "12", "9876543210", "1234567890123"]) {
    assert.equal(createPatientSchema.safeParse({ firstName: "TEST PATIENT", gender: "male", mobile }).success, true, mobile);
    assert.equal(updatePatientSchema.safeParse({ mobile }).success, true, mobile);
  }
  for (const mobile of ["", "12a", "1 2", "+12", "12345678901234"]) {
    assert.equal(createPatientSchema.safeParse({ firstName: "TEST PATIENT", gender: "male", mobile }).success, false, mobile);
  }
});
