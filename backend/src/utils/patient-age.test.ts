import test from "node:test";import assert from "node:assert/strict";import {patientAgeLabel} from "./patient-age";
test("dashboard age preserves completed years/months, infant days and India day",()=>{const now=new Date("2026-10-11T04:00:00Z");assert.equal(patientAgeLabel({dateOfBirth:"2001-12-11"},now),"24 years, 10 months");assert.equal(patientAgeLabel({dateOfBirth:"2026-07-12"},now),"2 months");assert.equal(patientAgeLabel({dateOfBirth:"2026-10-10"},now),"1 day");assert.equal(patientAgeLabel({age:18},now),"18 years");assert.equal(patientAgeLabel({dateOfBirth:"2030-01-01"},now),"Unknown");});
test("missing, invalid and zero-only legacy ages are explicitly unknown",()=>{
 const now=new Date("2026-10-11T04:00:00Z");
 for(const patient of [{},{age:0},{dateOfBirth:"invalid",age:0},{dateOfBirth:"2026-02-31"},{age:NaN},{age:-1}]) assert.equal(patientAgeLabel(patient,now),"Unknown");
 assert.equal(patientAgeLabel({dateOfBirth:"2026-10-11",age:0},now),"0 days");
});
