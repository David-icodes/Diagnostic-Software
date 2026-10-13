import test from "node:test";
import assert from "node:assert/strict";
import { Patient } from "../../models/patient.model";
import { createPatientSchema } from "../../validations/patient";
import { listPatients } from "./patient.service";

test("shared mobile is non-unique while patient ID remains unique and immutable", () => {
  const indexes = Patient.schema.indexes();
  assert.ok(indexes.some(([key, options]) => key.patientId === 1 && options.unique));
  assert.ok(indexes.some(([key, options]) => key.mobile === 1 && !options.unique));
  assert.equal(Patient.schema.path("patientId").options.immutable, true);
  const input = {firstName: "Synthetic", gender: "female", mobile: " 0001234567 "};
  assert.equal(createPatientSchema.parse(input).mobile, "0001234567");
  assert.equal(createPatientSchema.safeParse({...input, patientId:"spoof"}).success, false);
  assert.equal(createPatientSchema.safeParse({...input, mobile:"invalid"}).success, false);
});

test("shared-number search returns multiple identities with correct paginated count", async (t) => {
  let filter: unknown;
  t.mock.method(Patient, "countDocuments", async (value: unknown) => {filter=value;return 2;});
  t.mock.method(Patient, "find", () => ({sort:()=>({skip:()=>({limit:()=>({exec:async()=>[{patientId:"SYN-2"}]})})})}));
  const result = await listPatients({search:" 0001234567 ", page:2, limit:1});
  assert.equal(result.data[0].patientId,"SYN-2");
  assert.deepEqual(result.pagination,{page:2,limit:1,total:2,totalPages:2});
  assert.deepEqual(filter,{$or:[{patientId:{$regex:"0001234567",$options:"i"}},{fullName:{$regex:"0001234567",$options:"i"}},{mobile:{$regex:"0001234567",$options:"i"}}]});
});
