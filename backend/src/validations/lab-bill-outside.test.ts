import { test } from "node:test";
import assert from "node:assert/strict";
import { createLabBillSchema, modifyLabBillSchema } from "./lab-bill";
import { LabBill } from "../models/lab-bill.model";
const patientId = "507f1f77bcf86cd799439011";
const testId = "507f1f77bcf86cd799439012";
const outsideLabId = "507f1f77bcf86cd799439013";
const parse = (item: object) => createLabBillSchema.safeParse({ patientId, items: [{ testId, quantity: 1, ...item }] });
test("old bill requests remain valid in-house", () => assert.equal(parse({}).success, true));
test("Out requires a real-format centre ID", () => {
  assert.equal(parse({ out: true }).success, false);
  assert.equal(parse({ out: true, outsideLabId: "made-up" }).success, false);
  assert.equal(parse({ out: true, outsideLabId }).success, true);
});
test("unchecked Out clears its association", () => {
  assert.equal(parse({ out: false, outsideLabId: null }).success, true);
  assert.equal(parse({ out: false, outsideLabId }).success, false);
});
test("Modify validates the same Out selection without changing patient or status", () => {
  assert.equal(modifyLabBillSchema.safeParse({ items: [{ testId, quantity: 1, out: true, outsideLabId }] }).success, true);
  assert.equal(modifyLabBillSchema.safeParse({ items: [{ testId, quantity: 1, out: true }] }).success, false);
  assert.equal(modifyLabBillSchema.safeParse({ patientId, items: [{ testId, quantity: 1 }] }).success, false);
});
test("BSON association and timestamp serialize independently from billing amounts", () => {
  const bill = new LabBill({ items: [{ testId, testName: "Synthetic", quantity: 2, unitPrice: 50, total: 100, outsideLabId, outsideLabName: "Synthetic centre", sentOutAt: new Date("2026-10-08T04:00:00Z") }] });
  const item = JSON.parse(JSON.stringify(bill.items[0]));
  assert.equal(item.outsideLabId, outsideLabId);
  assert.equal(item.sentOutAt, "2026-10-08T04:00:00.000Z");
  assert.equal(item.quantity, 2);
  assert.equal(item.total, 100);
});
