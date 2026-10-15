import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";
import { LabBill } from "../../models/lab-bill.model";
import { LabTestResult } from "../../models/lab-test-result.model";
import { AuditLog } from "../../models/audit-log.model";
import { getSummary, getTodayBills } from "./dashboard.service";
import { SUBMISSION_PENDING, SUBMISSION_CONFIRMED } from "../test-results/result-workflow.service";

const query = (value: unknown) => { const q = { populate: () => q, select: () => q, lean: () => q, sort: () => q, limit: () => q, exec: async () => value }; return q; };
const id = () => new Types.ObjectId();

test("summary counts OSP/vendor bills once, excludes cancelled and removed tests, and shares Today Bills state", async t => {
  const patient = { _id: id(), patientId: "SYNTHETIC", fullName: "Synthetic" };
  const bills = [5, 4, 3, 0, 2].map((count, index) => ({ _id: id(), patientId: patient,
    billType: index % 2 ? "vendor" : "osp", status: index === 4 ? "cancelled" : "generated",
    billNumber: "SYNTHETIC-" + index, createdAt: new Date(),
    items: Array.from({ length: count }, () => ({ testId: id() })) }));
  const rows = bills.flatMap((bill, index) => bill.items.slice(0, index === 0 ? 3 : index === 1 ? 0 : undefined).flatMap(item => [0, 1].map(() => ({
    _id: id(), billId: bill._id, patientId: patient._id, testId: item.testId, parameterId: id(), result: 0, version: 1, enteredAt: new Date(),
  }))));
  rows.push({ ...rows[0], _id: id(), testId: id() }); // removed investigation
  t.mock.method(LabBill, "find", (filter: any) => {
    assert.deepEqual(filter.status, { $ne: "cancelled" });
    assert.ok(filter.createdAt, "requested date window must remain applied");
    assert.equal(filter.billType, undefined, "OSP and vendor eligibility is unchanged");
    return query(bills.filter(bill => bill.status !== "cancelled")) as any;
  });
  let reads = 0;
  t.mock.method(LabTestResult, "find", () => { reads++; return query(rows) as any; });
  t.mock.method(AuditLog, "find", () => query([]) as any);
  const summary = await getSummary({ fromDate: "2026-10-15", toDate: "2026-10-15" });
  assert.equal(summary.labBills, 4);
  assert.equal(summary.completedTests, 1);
  assert.equal(summary.pendingTests, 3); // includes empty bill: existing safe pending rule
  assert.equal(summary.pendingTestCount, 3, "compatibility field must count pending bills too");
  assert.equal(reads, 1, "use one consistent result snapshot for both counts");
  const today = await getTodayBills({ fromDate: "2026-10-15", toDate: "2026-10-15" });
  assert.deepEqual(today.map(bill => bill.completed), [false, false, true, false]);
});

test("incomplete submissions and previous sample collections do not complete a bill", async t => {
  const patientId = id(), testId = id(), collectionId = id();
  const bill = { _id: id(), patientId: { _id: patientId }, status: "generated", items: [{ testId, activeCollectionId: collectionId }] };
  const row = { _id: id(), billId: bill._id, patientId, testId, parameterId: id(), collectionId, result: "15", version: 1, enteredAt: new Date() };
  let action = SUBMISSION_PENDING;
  t.mock.method(LabBill, "find", () => query([bill]) as any);
  t.mock.method(LabTestResult, "find", () => query([row]) as any);
  t.mock.method(AuditLog, "find", () => query([{ entity: row._id, action }]) as any);
  assert.equal((await getSummary({})).completedTests, 0);
  action = SUBMISSION_CONFIRMED;
  assert.equal((await getSummary({})).completedTests, 1);
  row.collectionId = id();
  assert.equal((await getSummary({})).completedTests, 0);
});
