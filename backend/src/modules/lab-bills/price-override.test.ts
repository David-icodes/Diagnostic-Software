import test from "node:test";
import assert from "node:assert/strict";
import mongoose, { Types } from "mongoose";
import { LabBill } from "../../models/lab-bill.model";
import { LabSample } from "../../models/lab-sample.model";
import { LabTest } from "../../models/lab-test.model";
import { Department } from "../../models/department.model";
import { AuditLog } from "../../models/audit-log.model";
import { modifyLabBill } from "./lab-bill.service";
import { modifyLabBillSchema } from "../../validations/lab-bill";

const query = (value: unknown) => {
  const q: Record<string, unknown> = {
    exec: async () => value,
    session: () => q,
    select: () => q,
    lean: () => q,
    populate: () => q,
    sort: () => q,
  };
  return q;
};

test("individual bill price overrides are administrator-only and recorded with old/new values", async (t) => {
  const actor = new Types.ObjectId();
  const testId = new Types.ObjectId();
  const departmentId = new Types.ObjectId();
  const masterTest = { _id: testId, active: true, price: 100, testCode: "SYN", testName: "Synthetic", departmentId };

  t.mock.method(mongoose.connection, "transaction", async (callback: any) => callback({}));
  t.mock.method(LabSample, "find", () => query([]) as any);
  t.mock.method(LabTest, "find", () => query([masterTest]) as any);
  t.mock.method(Department, "find", () => query([{ _id: departmentId, name: "Synthetic" }]) as any);

  const makeBill = () => new LabBill({
    billNumber: "SYNTHETIC",
    billType: "osp",
    patientType: "osp",
    patientId: new Types.ObjectId(),
    items: [{ testId, testCode: "SYN", testName: "Synthetic", departmentId, departmentName: "Synthetic", unitPrice: 100, quantity: 1, total: 100 }],
    totalAmount: 100, discountPercent: 0, discountAmount: 0, netAmount: 100,
    paidAmount: 0, dueAmount: 100, createdBy: actor, status: "generated",
  });

  let current = makeBill();
  t.mock.method(LabBill, "findById", () => query(current) as any);

  // A normal operator cannot send an override even when the rest of the bill is valid.
  await assert.rejects(
    modifyLabBill(String(actor), String(current._id), { items: [{ testId: String(testId), quantity: 1, unitPrice: 75 }] }),
    /Only an administrator may change an individual bill price/,
  );

  // Admin override changes only the bill snapshot, audited with old and new values.
  current = makeBill();
  const bill = current;
  t.mock.method(bill, "save", async () => bill);
  let audit: any;
  t.mock.method(AuditLog, "create", async (rows: any) => { audit = rows[0]; return rows; });

  await modifyLabBill(
    String(actor),
    String(bill._id),
    { items: [{ testId: String(testId), quantity: 1, unitPrice: 75 }] },
    { allowPriceOverride: true },
  );

  assert.equal(bill.items[0].unitPrice, 75);
  assert.equal(bill.items[0].total, 75);
  assert.equal(bill.netAmount, 75);
  // The master tariff is never rewritten by a bill-specific override.
  assert.equal(masterTest.price, 100);
  assert.equal(audit.action, "lab_bill.modified");
  assert.equal(audit.details.priceChanges[0].testId, String(testId));
  assert.equal(audit.details.priceChanges[0].previousUnitPrice, 100);
  assert.equal(audit.details.priceChanges[0].newUnitPrice, 75);
  assert.equal(audit.details.priceChanges[0].previousTotal, 100);
  assert.equal(audit.details.priceChanges[0].newTotal, 75);
  assert.equal(audit.details.previousTotals.netAmount, 100);
  assert.equal(audit.details.revisedTotals.netAmount, 75);
  await modifyLabBill(String(actor),String(bill._id),{items:[{testId:String(testId),quantity:2,unitPrice:75}]},{allowPriceOverride:true});
  assert.equal(audit.details.priceChanges[0].previousTotal,75,"Old total must use the original quantity, not the revised quantity");
  assert.equal(audit.details.priceChanges[0].newTotal,150);
});

test("the modification schema accepts an optional override but rejects negative prices", () => {
  const base = { items: [{ testId: "507f1f77bcf86cd799439011", quantity: 1 }] };
  assert.equal(modifyLabBillSchema.safeParse(base).success, true);
  assert.equal(modifyLabBillSchema.safeParse({ items: [{ ...base.items[0], unitPrice: 75 }] }).success, true);
  assert.equal(modifyLabBillSchema.safeParse({ items: [{ ...base.items[0], unitPrice: -1 }] }).success, false);
  assert.equal(modifyLabBillSchema.safeParse({ items: [{ ...base.items[0], unitPrice: 0 }] }).success, true);
});


test("adding or changing quantity preserves a retained bill price rather than resetting to master price",async t=>{
 const actor=new Types.ObjectId(),testId=new Types.ObjectId(),dept=new Types.ObjectId();
 const bill=new LabBill({billNumber:'SYNTHETIC-RETAINED-PRICE',billType:'osp',patientType:'osp',patientId:new Types.ObjectId(),createdBy:actor,status:'generated',items:[{testId,testCode:'SYN',testName:'Synthetic',departmentId:dept,departmentName:'Synthetic',unitPrice:75,quantity:1,total:75}],totalAmount:75,netAmount:75,paidAmount:0,dueAmount:75,discountAmount:0,discountPercent:0});
 t.mock.method(mongoose.connection,'transaction',async(callback:any)=>callback({}));t.mock.method(LabBill,'findById',()=>query(bill) as any);t.mock.method(bill,'save',async()=>bill);t.mock.method(LabSample,'find',()=>query([]) as any);t.mock.method(LabTest,'find',()=>query([{_id:testId,active:true,price:100,testCode:'SYN',testName:'Synthetic',departmentId:dept}]) as any);t.mock.method(Department,'find',()=>query([{_id:dept,name:'Synthetic'}]) as any);t.mock.method(AuditLog,'create',async(rows:any)=>rows);
 await modifyLabBill(String(actor),String(bill._id),{items:[{testId:String(testId),quantity:2}],discountPercent:0});assert.equal(bill.items[0].unitPrice,75);assert.equal(bill.totalAmount,150);
});
