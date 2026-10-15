import test from "node:test";
import assert from "node:assert/strict";
import mongoose, { Types } from "mongoose";
import { LabBill } from "../../models/lab-bill.model";
import { LabSample } from "../../models/lab-sample.model";
import { LabTestResult } from "../../models/lab-test-result.model";
import { LabTest } from "../../models/lab-test.model";
import { Department } from "../../models/department.model";
import { AuditLog } from "../../models/audit-log.model";
import { modifyLabBill } from "./lab-bill.service";
import { assertResultReportAllowed } from "../test-results/result-workflow.service";
import { updateLabSampleStatus } from "../lab-samples/lab-sample.service";
import { requirePermission } from "../../middleware/require-permission";

const query = (value: unknown) => { const q = { exec: async () => value, session: () => q, select: () => q, lean: () => q, populate: () => q, sort: () => q }; return q; };

for (const clinicalState of ["none", "collected", "results"] as const) {
  test(`bill amendment preserves ${clinicalState} history, receipts, snapshots and report boundaries`, async t => {
    const actor = new Types.ObjectId(), a = new Types.ObjectId(), b = new Types.ObjectId(), dept = new Types.ObjectId();
    const item = (id: Types.ObjectId) => ({ testId: id, testCode: String(id), testName: "Synthetic", departmentId: dept, departmentName: "Synthetic", unitPrice: 100, quantity: 1, total: 100 });
    const bill = new LabBill({ billNumber: "SYNTHETIC", patientId: new Types.ObjectId(), items: [item(a), item(b)], totalAmount: 200, discountPercent: 0, discountAmount: 0, netAmount: 200, paidAmount: 150, dueAmount: 50, createdBy: actor, status: "generated" });
    const clinical = { state: clinicalState, result: 15, revisions: [{ result: 14 }], history: [{ status: "COLLECTED" }] };
    const original = JSON.stringify(clinical);
    const session = {};
    t.mock.method(mongoose.connection, "transaction", async (callback: any) => callback(session));
    t.mock.method(LabBill, "findById", () => query(bill) as any);
    t.mock.method(bill, "save", async (options: any) => { assert.equal(options.session, session); return bill; });
    t.mock.method(LabSample, "find", () => query([]) as any); // outside assignments only
    t.mock.method(LabTest, "find", () => query([{ _id: a, active: true, price: 100, testCode: "A", testName: "Synthetic", departmentId: dept }, { _id: b, active: true, price: 100, testCode: "B", testName: "Synthetic", departmentId: dept }]) as any);
    t.mock.method(Department, "find", () => query([{ _id: dept, name: "Synthetic" }]) as any);
    for (const model of [LabSample, LabTestResult]) for (const method of ["deleteMany", "deleteOne", "updateMany"] as const) {
      t.mock.method(model, method, () => { throw Error("Clinical storage must remain untouched"); });
    }
    let audit: any;
    t.mock.method(AuditLog, "create", async (rows: any, options: any) => { assert.equal(options.session, session); audit = rows[0]; return rows; });
    await modifyLabBill(String(actor), String(bill._id), { items: [{ testId: String(b), quantity: 1 }], discountPercent: 10 });
    assert.deepEqual(bill.items.map(row => String(row.testId)), [String(b)]);
    assert.equal(bill.netAmount, 90); assert.equal(bill.paidAmount, 150); assert.equal(bill.dueAmount, 0);
    assert.equal(bill.amendments?.[0].previousTotals.netAmount, 200);
    assert.equal(String(bill.amendments?.[0].removedItems[0].testId), String(a));
    assert.equal(bill.amendments?.[0].previousItems.length, 2);
    assert.equal(String(bill.amendments?.[0].changedBy), String(actor));
    assert.ok(bill.amendments?.[0].changedAt instanceof Date);
    assert.equal(JSON.stringify(clinical), original);
    assert.deepEqual(audit.details.removedTestIds, [String(a)]);
    await assert.rejects(modifyLabBill(String(actor), String(bill._id), { items: [{ testId: String(a), quantity: 1 }] }), /cannot be re-added/);
    t.mock.method(LabTestResult, "find", () => query([{ _id: new Types.ObjectId(), testId: a, result: 15, version: 1, enteredAt: new Date() }]) as any);
    t.mock.method(AuditLog, "find", () => query([]) as any);
    await assert.rejects(assertResultReportAllowed(String(bill._id), [String(a)]), /Submit the selected/);
  });
}

test("stale sample status updates cannot act on a removed investigation", async t => {
  t.mock.method(mongoose.connection, "transaction", async (callback: any) => callback({}));
  const sample = { _id: new Types.ObjectId(), billId: new Types.ObjectId(), patientId: new Types.ObjectId(), testId: new Types.ObjectId(), sampleStatus: "SELECT" };
  t.mock.method(LabSample, "findById", () => query(sample) as any);
  t.mock.method(LabBill, "updateOne", (filter: any) => { assert.equal(String(filter["items.testId"]), String(sample.testId)); return query({ matchedCount: 0 }) as any; });
  t.mock.method(LabSample, "findOneAndUpdate", () => { throw Error("Must not write a retired sample"); });
  await assert.rejects(updateLabSampleStatus(String(new Types.ObjectId()), String(sample._id), { status: "COLLECTED" }), /no longer active/);
});

test("bill amendment authorization remains restricted to billing.modify roles", () => {
  for (const [role, expected] of [[undefined, 401], ["operator", 403], ["vendor", 403], ["staff", undefined], ["admin", undefined]] as const) {
    let failure: any;
    requirePermission("billing.modify")({ user: role ? { role } : undefined } as any, {} as any, error => { failure = error; });
    assert.equal(failure?.statusCode, expected);
  }
});
