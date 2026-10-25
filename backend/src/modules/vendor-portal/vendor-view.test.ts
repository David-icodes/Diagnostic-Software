import test from "node:test";
import assert from "node:assert/strict";
import { vendorBillView } from "./vendor-bill-view";
import { vendorContactSchema } from "./patient-edit.service";

test("vendor response allowlist shares only the vendor's own assigned prices and hides internal fields",()=>{
  const row=vendorBillView({_id:"synthetic",billNumber:"SYN",netAmount:100,dueAmount:10,comments:"internal",masterPrice:999,commission:12,patientId:{_id:"p",fullName:"Synthetic",patientId:"SYN-P",passwordHash:"never"},items:[{testId:"t",unitPrice:100,total:100,packageAmount:100,defaultPrice:999,internalCost:50,testName:"Synthetic"}]});
  const text=JSON.stringify(row);for(const key of ["passwordHash","internal","masterPrice","defaultPrice","internalCost","commission","packageAmount"])assert.equal(text.includes(key),false);
  // The vendor sees the price snapshotted for their own client and their bill totals.
  assert.equal(row.items[0].testId,"t");assert.equal(row.items[0].unitPrice,100);assert.equal(row.items[0].total,100);assert.equal(row.netAmount,100);assert.equal(row.dueAmount,10);
  assert.equal(row.patientId?.patientId,"SYN-P");
});
test("vendor contact edits require optimistic version and reject identifiers, demographics and money",()=>{
  const base={expectedUpdatedAt:new Date().toISOString(),mobile:"0000000000"};
  assert.equal(vendorContactSchema.safeParse(base).success,true);
  for(const field of ["patientId","clientId","age","gender","firstName","netAmount","status"])assert.equal(vendorContactSchema.safeParse({...base,[field]:"forbidden"}).success,false);
  assert.equal(vendorContactSchema.safeParse({mobile:"0000000000"}).success,false);
});
