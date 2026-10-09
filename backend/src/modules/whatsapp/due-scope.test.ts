import { test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { Patient } from "../../models/patient.model";
import { LabBill } from "../../models/lab-bill.model";
import { LabTest } from "../../models/lab-test.model";
import { Department } from "../../models/department.model";
import { LabClient } from "../../models/lab-client.model";
import { LabSample } from "../../models/lab-sample.model";
import { Counter } from "../../models/counter.model";
import { AuditLog } from "../../models/audit-log.model";
import { updatePatient } from "../patients/patient.service";
import { createLabBill, modifyLabBill } from "../lab-bills/lab-bill.service";

const patientId = new Types.ObjectId(); const userId = new Types.ObjectId();
const testId = new Types.ObjectId(); const departmentId = new Types.ObjectId();
function q(value: unknown) { const chain = { exec: async () => value, select: () => chain, lean: () => chain, populate: () => chain }; return chain; }

test("patient modification saves without reading or enforcing bill dues", async (t) => {
  let saves = 0;
  const patient = { _id: patientId, status: "active", mobile: "old", save: async () => { saves++; } };
  t.mock.method(Patient, "findOne", async () => patient);
  t.mock.method(LabBill, "find", () => { throw new Error("Patient editing must not query outstanding dues"); });
  t.mock.method(AuditLog, "create", async () => ({}));
  await updatePatient(String(userId), String(patientId), { mobile: "+919876543210" });
  assert.equal(patient.mobile, "+919876543210"); assert.equal(saves, 1);
});

test("OSP and Vendor bill creation remain available with outstanding patient balances", async (t) => {
  t.mock.method(Patient, "findById", () => q({ _id: patientId, status: "active" }));
  t.mock.method(LabBill, "find", () => { throw new Error("New bills must not query previous balances"); });
  t.mock.method(LabTest, "find", () => q([{ _id: testId, departmentId, active: true, price: 100, testName: "Test", testCode: "TEST" }]));
  t.mock.method(Department, "find", () => q([{ _id: departmentId, name: "Department" }]));
  t.mock.method(LabClient, "findById", () => q({ active: true, name: "Existing client" }));
  t.mock.method(Counter, "findOneAndUpdate", async () => ({ seq: 1 }));
  t.mock.method(AuditLog, "create", async () => ({}));
  t.mock.method(LabBill, "create", async (data: Record<string, unknown>) => ({ ...data, _id: new Types.ObjectId() }));
  for (const billType of ["osp", "vendor"]) {
    const bill = await createLabBill(String(userId), { patientId: String(patientId), billType,
      ...(billType === "vendor" ? { clientId: String(new Types.ObjectId()) } : {}),
      items: [{ testId: String(testId), quantity: 1 }], paidAmount: 0, status: "generated" });
    assert.equal(bill.billType, billType); assert.equal(bill.dueAmount, 100);
  }
});

test("otherwise eligible unpaid bill with due can be modified while paid-bill integrity remains enforced", async (t) => {
  let saves = 0;
  const bill = { _id: new Types.ObjectId(), patientId, status: "generated", patientType: "osp", paidAmount: 0,
    dueAmount: 100, items: [{ testId }], save: async () => { saves++; } };
  t.mock.method(LabBill, "findById", () => q(bill));
  t.mock.method(LabBill, "find", () => { throw new Error("Modification must not query other patient dues"); });
  t.mock.method(LabTest, "find", () => q([{ _id: testId, departmentId, active: true, price: 100, testName: "Test", testCode: "TEST" }]));
  t.mock.method(Department, "find", () => q([{ _id: departmentId, name: "Department" }]));
  t.mock.method(LabSample, "find", () => q([]));
  t.mock.method(AuditLog, "create", async () => ({}));
  await modifyLabBill(String(userId), String(bill._id), { items: [{ testId: String(testId), quantity: 1 }] });
  assert.equal(saves, 1); bill.paidAmount = 1;
  await assert.rejects(modifyLabBill(String(userId), String(bill._id), { items: [{ testId: String(testId), quantity: 1 }] }), /already has payments/);
});