import test from "node:test";
import assert from "node:assert/strict";
import { computeTotals } from "./lab-bill.service";
import { modifyLabBillSchema } from "../../validations/lab-bill";

for (const [name, paid, discount, due, credit] of [
  ["unpaid",0,0,100,0], ["partially paid with dues",40,10,50,0],
  ["fully paid",100,0,0,0], ["settled with revised lower total",100,10,0,10],
  ["existing overpayment",120,0,0,20],
] as const) {
  test(`modification balance: ${name}`, () => {
    const totals=computeTotals([{unitPrice:100,quantity:1}],discount,undefined,paid,true);
    assert.equal(totals.dueAmount,due);
    assert.equal(Math.max(0,paid-totals.netAmount),credit);
    assert.equal(totals.netAmount,100-discount);
  });
}
test("creation still rejects overpayment; modification schema cannot rewrite paid amount or status", () => {
 assert.throws(()=>computeTotals([{unitPrice:100,quantity:1}],10,undefined,100),/Paid amount cannot exceed/);
 const input={items:[{testId:"507f1f77bcf86cd799439011",quantity:1}],discountPercent:10};
 assert.equal(modifyLabBillSchema.safeParse(input).success,true);
 for(const invalid of [{paidAmount:0},{patientId:"507f1f77bcf86cd799439012"},{status:"draft"},{discountPercent:101},{discountPercent:NaN},{items:[]}]) {
  assert.equal(modifyLabBillSchema.safeParse({...input,...invalid}).success,false);
 }
});
