import { test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { LabBill } from "../../../models/lab-bill.model";
import { Patient } from "../../../models/patient.model";
import { Doctor } from "../../../models/doctor.model";
import { DoctorCommission } from "../../../models/doctor-commission.model";
import { Department } from "../../../models/department.model";
import { LabTest } from "../../../models/lab-test.model";
import { LabClient } from "../../../models/lab-client.model";
import { LabClientTariff } from "../../../models/lab-client-tariff.model";
import { AuditLog } from "../../../models/audit-log.model";
import { listReferralDoctorCommission } from "./referral-doctor-commission.service";
import { referralDoctorCommissionQuerySchema } from "../validations/referral-doctor-commission";
import { listTariffs, updateTariffs } from "../../lab-tariffs/lab-tariff.service";
import { assignCommissionMappings } from "../../commission-mappings/commission-mapping.service";
import { applyClientTariffs } from "../../client-tariffs/client-tariff.service";
import { createTest, updateTest, getTest } from "../../lab-tests/lab-test.service";

function q(value: unknown) {
  const chain = { exec: async () => value, select: () => chain, sort: () => chain, skip: () => chain, limit: () => chain, populate: () => chain };
  return chain;
}
const ids = Array.from({ length: 6 }, () => new Types.ObjectId());
const [user, doctor, dept, patient, testA, testB] = ids;

test("referral columns use historical gross, discount, paid and configured commission with filters", async (t) => {
  const bill = { id: "fixture", patientId: patient, referringDoctorId: doctor, createdAt: new Date("2026-10-09T06:00:00Z"), billNumber: "FIXTURE", patientType: "osp", totalAmount: 200, netAmount: 180, paidAmount: 80,
    items: [{ testId: testA, departmentId: dept, testName: "First", total: 100 }, { testId: testB, departmentId: dept, testName: "Second", total: 100 }] };
  t.mock.method(LabBill, "find", (filter: Record<string, unknown>) => { assert.deepEqual(filter.referringDoctorId, { $in: [String(doctor)] }); assert.equal(filter.status, "generated"); return q([bill]); });
  t.mock.method(Patient, "find", () => q([{ _id: patient, patientId: "GP-FIXTURE", fullName: "Synthetic Patient" }]));
  t.mock.method(Doctor, "find", () => q([{ _id: doctor, name: "Configured Doctor" }]));
  t.mock.method(DoctorCommission, "find", async () => [{ scope: "test", doctorId: doctor, testId: testA, commissionPercent: 10 }]);
  const base = { doctorIds: String(doctor), testIds: String(testA), departmentIds: String(dept) };
  const net = await listReferralDoctorCommission(referralDoctorCommissionQuerySchema.parse(base));
  assert.equal(net.data.length, 1); const row = net.data[0];
  assert.equal(row.sNo, 1); assert.equal(row.patientId, "GP-FIXTURE"); assert.equal(row.doctorName, "Configured Doctor"); assert.equal(row.tests, "First");
  assert.equal(row.segmentTotal, 100); assert.equal(row.segmentDiscount, 10); assert.equal(row.segmentNet, 90); assert.equal(row.segmentPaid, 40); assert.equal(row.commissionAmount, 9);
  const paid = await listReferralDoctorCommission(referralDoctorCommissionQuerySchema.parse({ ...base, amountBasis: "paid" }));
  assert.equal(paid.data[0].commissionAmount, 4); assert.equal(paid.summary.totalCommission, 4);
});

test("ALL tariffs scope includes available active departments and individual scope stays isolated", async (t) => {
  t.mock.method(Department, "find", (filter: Record<string, unknown>) => { if (filter.active !== undefined) assert.equal(filter.active, true); return q([{ _id: dept, name: "Synthetic department" }]); });
  t.mock.method(LabTest, "find", (filter: Record<string, unknown>) => {
    if (typeof filter.departmentId === "object" && !(filter.departmentId instanceof Types.ObjectId)) assert.deepEqual(filter.departmentId, { $in: [dept] });
    else assert.equal(String(filter.departmentId), String(dept));
    return q([{ _id: testA, id: String(testA), departmentId: dept, testName: "Synthetic", price: 10 }]);
  });
  t.mock.method(LabTest, "countDocuments", async () => 1);
  for (const departmentId of ["all", String(dept)]) {
    const result = await listTariffs({ departmentId, page: 1, limit: 50 });
    assert.equal(result.data[0].departmentName, "Synthetic department"); assert.equal(result.pagination.total, 1);
  }
});

test("tariff save affects only submitted catalog rows and records an audit", async (t) => {
  t.mock.method(LabTest, "find", () => q([{ _id: testA }, { _id: testB }]));
  let count = 0;
  t.mock.method(LabTest, "bulkWrite", async (operations: any[]) => { count = operations.length; assert.equal(String(operations[0].updateOne.filter._id), String(testA)); assert.equal(operations[0].updateOne.update.$set.price, 12.5); return { modifiedCount: 1, upsertedCount: 0 }; });
  const audits: any[] = []; t.mock.method(AuditLog, "create", async (entry: any) => { audits.push(entry); return {}; });
  assert.deepEqual(await updateTariffs(String(user), [{ testId: String(testA), price: 12.5 }]), { updated: 1 });
  assert.equal(count, 1); assert.equal(audits.length, 1);
});

test("doctor set copy and client tariff saves reuse existing mappings and leave other tests untouched", async (t) => {
  t.mock.method(Doctor, "findById", () => q({ _id: doctor }));
  t.mock.method(LabClient, "findById", () => q({ _id: doctor }));
  t.mock.method(Department, "findById", () => q({ _id: dept }));
  t.mock.method(LabTest, "find", () => q([{ _id: testA }]));
  t.mock.method(AuditLog, "create", async () => ({}));
  let doctorSaves = 0; let clientSaves = 0;
  const doctorMapping = { testId: testA, commissionPercent: 0, commissionAmount: undefined as number | undefined, save: async () => { doctorSaves++; } };
  const clientMapping = { testId: testA, price: 0, save: async () => { clientSaves++; } };
  t.mock.method(DoctorCommission, "find", (filter: any) => { assert.deepEqual(filter.testId, { $in: [String(testA)] }); return q([doctorMapping]); });
  t.mock.method(LabClientTariff, "find", (filter: any) => { assert.deepEqual(filter.testId, { $in: [String(testA)] }); return q([clientMapping]); });
  t.mock.method(DoctorCommission, "findOne", () => q(doctorMapping));
  t.mock.method(LabClientTariff, "findOne", () => q(clientMapping));
  t.mock.method(DoctorCommission, "create", () => { throw new Error("Must reuse the existing mapping"); });
  t.mock.method(LabClientTariff, "create", () => { throw new Error("Must reuse the existing tariff"); });
  const result = await assignCommissionMappings(String(user), { doctorId: String(doctor), departmentId: String(dept), overwrite: true, mappings: [{ testId: String(testA), commissionPercent: 10, commissionAmount: 30 }] });
  assert.equal(result.removed, 0); assert.equal(doctorSaves, 1); assert.equal(doctorMapping.commissionPercent, 10); assert.equal(doctorMapping.commissionAmount, 30);
  const clientResult = await applyClientTariffs(String(user), { clientId: String(doctor), departmentId: String(dept), overwrite: true, rows: [{ testId: String(testA), price: 75 }] });
  assert.equal(clientResult.removed, 0); assert.equal(clientSaves, 1); assert.equal(clientMapping.price, 75);
});

test("specimen and container values survive existing create/update/reopen APIs including legacy data", async (t) => {
  t.mock.method(Department, "findById", () => q({ _id: dept }));
  const stored: any = { _id: testA, save: async () => stored };
  t.mock.method(LabTest, "create", async (input: any) => Object.assign(stored, input));
  t.mock.method(LabTest, "findById", () => q(stored));
  await createTest(String(user), { departmentId: dept, testCode: "SYNTHETIC", testName: "Synthetic", shortName: "S", price: 10, active: true, sampleType: "EDTA", containerType: "Lavander", resultMode: "PARAMETER_BASED" } as any);
  assert.equal((await getTest(String(testA))).containerType, "Lavander");
  await updateTest(String(testA), String(user), { sampleType: "SERUM", containerType: "Red" });
  assert.equal((await getTest(String(testA))).sampleType, "SERUM");
  assert.equal(stored.containerType, "Red");
  await updateTest(String(testA), String(user), { sampleType: "Legacy specimen", containerType: "Legacy tube" });
  assert.equal((await getTest(String(testA))).containerType, "Legacy tube");
});

