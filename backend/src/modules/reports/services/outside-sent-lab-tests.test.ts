import { test } from "node:test";
import assert from "node:assert/strict";
import { LabBill } from "../../../models/lab-bill.model";
import { LabSample } from "../../../models/lab-sample.model";
import { OutsideLab } from "../../../models/outside-lab.model";
import { Patient } from "../../../models/patient.model";
import { listOutsideSentLabTests } from "./outside-sent-lab-tests.service";
test("Outside report preserves legacy, excludes cleared and undated assignments, and totals real charges", async () => {
  const original = [LabBill.find, LabSample.find, OutsideLab.find, Patient.find];
  const date = new Date(2026, 9, 8, 9);
  const query = (value: unknown) => ({ select() { return this; }, lean() { return this; }, exec: async () => value });
  const bill = { _id: "bill", patientId: "patient", items: [
    { testId: "new", testName: "New", total: 120, outsideLabId: "centre", sentOutAt: date },
    { testId: "legacy", testName: "Legacy", total: 80 },
    { testId: "cleared", testName: "In-house", total: 50, outsideLabId: null, sentOutAt: null },
    { testId: "missing-date", testName: "Undated", total: 20, outsideLabId: "centre" },
    { testId: "old-date", testName: "Old", total: 10, outsideLabId: "centre", sentOutAt: new Date(2026, 9, 7) },
  ] };
  try {
    LabBill.find = (() => query([bill])) as unknown as typeof LabBill.find;
    LabSample.find = (() => query([{ billId: "bill", testId: "legacy", outsideLabId: "centre", sentOutAt: date }, { billId: "bill", testId: "cleared", outsideLabId: "centre", sentOutAt: date }])) as unknown as typeof LabSample.find;
    OutsideLab.find = (() => query([{ _id: "centre", name: "Synthetic centre" }])) as unknown as typeof OutsideLab.find;
    Patient.find = (() => query([{ _id: "patient", patientId: "SYNTHETIC", fullName: "Synthetic patient" }])) as unknown as typeof Patient.find;
    const result = await listOutsideSentLabTests({ page: 1, limit: 20, fromDate: "2026-10-08", toDate: "2026-10-08" });
    assert.deepEqual(result.data.map((row) => row.testName).sort(), ["Legacy", "New"]);
    assert.equal(result.summary.totalAmount, 200);
    assert.equal(result.summary.totalRecords, 2);
    assert.equal(result.data[0].labCenterName, "Synthetic centre");
    assert.equal(result.data[0].sentDate, date.toISOString());
    const excluded = await listOutsideSentLabTests({ page: 1, limit: 20, outsideLabIds: ["other"] });
    assert.equal(excluded.data.length, 0);
  } finally {
    [LabBill.find, LabSample.find, OutsideLab.find, Patient.find] = original as [typeof LabBill.find, typeof LabSample.find, typeof OutsideLab.find, typeof Patient.find];
  }
});
