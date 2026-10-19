import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  patientAgeLabel,
  patientAgeYears,
  validateOspAge,
} from "./patient-age.ts";

const now = new Date(2026, 9, 19, 12, 0, 0);

describe("OSP age is mandatory", () => {
  it("rejects missing, blank and zero-only age without a date of birth", () => {
    for (const ageYears of ["", " ", "0"]) {
      assert.match(
        validateOspAge({ dateOfBirth: "", ageYears, ageMonths: "", ageDays: "" }, now) ?? "",
        /Age is required|under one year/,
      );
    }
  });

  it("accepts a valid whole age and a valid date of birth", () => {
    assert.equal(
      validateOspAge({ dateOfBirth: "", ageYears: "34", ageMonths: "", ageDays: "" }, now),
      undefined,
    );
    assert.equal(
      validateOspAge({ dateOfBirth: "2026-01-02", ageYears: "", ageMonths: "", ageDays: "" }, now),
      undefined,
    );
  });

  it("rejects invalid, out-of-range and future dates", () => {
    for (const ageYears of ["abc", "-1", "151", "1.5"]) {
      assert.ok(
        validateOspAge({ dateOfBirth: "", ageYears, ageMonths: "", ageDays: "" }, now),
        ageYears,
      );
    }
    assert.match(
      validateOspAge({ dateOfBirth: "2026-10-20", ageYears: "", ageMonths: "", ageDays: "" }, now) ?? "",
      /future/,
    );
    assert.match(
      validateOspAge({ dateOfBirth: "2026-02-31", ageYears: "", ageMonths: "", ageDays: "" }, now) ?? "",
      /valid date/,
    );
  });
});

describe("patient age display", () => {
  it("uses a valid DOB before a stored legacy age", () => {
    assert.equal(patientAgeYears({ dateOfBirth: "1992-10-19", age: 99 }, now), 34);
    assert.equal(patientAgeLabel({ dateOfBirth: "1992-10-19", age: 99 }, now), "34 years");
  });

  it("uses a positive stored age when no DOB exists", () => {
    assert.equal(patientAgeYears({ age: 34 }, now), 34);
    assert.equal(patientAgeLabel({ age: 34 }, now), "34 years");
  });

  it("does not present an ambiguous zero-only legacy age as a real age", () => {
    assert.equal(patientAgeYears({ age: 0 }, now), undefined);
    assert.equal(patientAgeLabel({ age: 0 }, now), "");
  });
});
it("OSP DOB validation enforces the same maximum age as the billing backend",()=>{
 const now=new Date("2026-10-19T12:00:00");
 assert.equal(validateOspAge({dateOfBirth:"1850-01-01",ageYears:"",ageMonths:"",ageDays:""},now),"Age cannot exceed 150 years.");
});
