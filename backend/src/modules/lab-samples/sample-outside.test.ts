import { test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { updateSampleOutsideSchema } from "../../validations/sample-outside";
import { sampleOutsideView, updateLabSampleOutside } from "./lab-sample.service";
import { LabSample } from "../../models/lab-sample.model";
import { LabBill } from "../../models/lab-bill.model";
import { LabTest } from "../../models/lab-test.model";
import { Patient } from "../../models/patient.model";
import { OutsideLab } from "../../models/outside-lab.model";
import { LabTestResult } from "../../models/lab-test-result.model";
import { AuditLog } from "../../models/audit-log.model";

test("Sample OUT requires a real centre and explicit clearing", () => {
  assert.equal(updateSampleOutsideSchema.safeParse({ out: true }).success, false);
  assert.equal(updateSampleOutsideSchema.safeParse({ out: true, outsideLabId: "bad" }).success, false);
  assert.equal(updateSampleOutsideSchema.safeParse({ out: false, outsideLabId: null }).success, true);
  assert.equal(updateSampleOutsideSchema.safeParse({ out: false, outsideLabId: "507f1f77bcf86cd799439012" }).success, false);
});
test("Sample display preserves legacy assignment and canonical clears without invented dates", () => {
  const id = new Types.ObjectId("507f1f77bcf86cd799439012");
  const date = new Date("2026-10-07T03:00:00Z");
  const legacy = { outsideLabId: id, sentOutAt: date };
  const names = new Map([[String(id), "Existing centre"]]);
  assert.equal(sampleOutsideView(undefined, legacy, names).sentOutAt, date);
  assert.equal(sampleOutsideView({ outsideLabId: null }, legacy, names).outsideLabId, null);
  assert.equal(sampleOutsideView({ outsideLabId: id }, legacy, names).sentOutAt, undefined);
});
test("Sample OUT writes only the linked bill-item association and leaves money/status/results unchanged", async () => {
  const id = (n: number) => new Types.ObjectId(`507f1f77bcf86cd7994390${n.toString().padStart(2, "0")}`);
  const item: Record<string, any> = { testId: id(1), testName: "Synthetic test", testCode: "SYN", unitPrice: 100, quantity: 1, total: 100 };
  const bill = { _id: id(2), patientId: id(3), billNumber: "Synthetic bill", status: "generated", paidAmount: 100, netAmount: 100, items: [item] };
  const sample = { _id: id(4), sampleId: "Synthetic sample", billId: bill._id, patientId: bill.patientId, testId: item.testId, sampleStatus: "COLLECTED", sampleType: "Blood", history: [] };
  const centres = [{ _id: id(5), name: "Synthetic centre", active: true }, { _id: id(6), name: "Other centre", active: true }];
  const query = (value: unknown) => ({ select() { return this; }, lean() { return this; }, exec: async () => value });
  const methods = [[LabSample, "findById"], [LabBill, "findById"], [LabBill, "updateOne"], [Patient, "findById"], [LabTest, "findById"], [OutsideLab, "findById"], [OutsideLab, "find"], [LabTestResult, "exists"], [AuditLog, "create"]] as const;
  const originals = methods.map(([model, method]) => (model as any)[method]);
  let writes = 0;
  try {
    (LabSample as any).findById = () => query(sample);
    (LabBill as any).findById = () => query(bill);
    (Patient as any).findById = () => query({ patientId: "SYN", fullName: "Synthetic patient" });
    (LabTest as any).findById = () => query({ testCode: "SYN", testName: "Synthetic test" });
    (OutsideLab as any).findById = (value: string) => query(centres.find((centre) => String(centre._id) === value));
    (OutsideLab as any).find = () => query(centres);
    (LabTestResult as any).exists = async () => true;
    (AuditLog as any).create = async () => ({});
    (LabBill as any).updateOne = (filter: any, update: any) => {
      assert.equal(String(filter["items.testId"]), String(sample.testId));
      assert.deepEqual(Object.keys(update.$set).sort(), ["items.$.outsideLabId", "items.$.outsideLabName", "items.$.sentOutAt", "updatedBy"].filter((key) => key in update.$set).sort());
      for (const [key, value] of Object.entries(update.$set)) if (key.startsWith("items.$.")) item[key.slice(8)] = value;
      if (update.$unset) delete item.outsideLabName;
      writes++; return query({ matchedCount: 1 });
    };
    let row = await updateLabSampleOutside(String(id(7)), String(sample._id), { out: true, outsideLabId: String(id(5)) });
    assert.equal(row.outsideLabName, "Synthetic centre"); assert.equal(row.sampleStatus, "COLLECTED"); assert.equal(row.testStatus, "CLOSED");
    const date = item.sentOutAt;
    await updateLabSampleOutside(String(id(7)), String(sample._id), { out: true, outsideLabId: String(id(5)) }); assert.equal(item.sentOutAt, date);
    row = await updateLabSampleOutside(String(id(7)), String(sample._id), { out: true, outsideLabId: String(id(6)) }); assert.equal(row.outsideLabName, "Other centre");
    row = await updateLabSampleOutside(String(id(7)), String(sample._id), { out: false, outsideLabId: null }); assert.equal(row.outsideLabId, null);
    const before = writes;
    await assert.rejects(updateLabSampleOutside(String(id(7)), String(sample._id), { out: true, outsideLabId: String(id(8)) }), /active outside lab/); assert.equal(writes, before);
    bill.status = "cancelled"; await assert.rejects(updateLabSampleOutside(String(id(7)), String(sample._id), { out: false, outsideLabId: null }), /cancelled/);
    assert.equal(item.total, 100); assert.equal(bill.paidAmount, 100); assert.equal(sample.sampleStatus, "COLLECTED");
  } finally { methods.forEach(([model, method], i) => { (model as any)[method] = originals[i]; }); }
});
