import test from "node:test";
import assert from "node:assert/strict";
import { vendorBillView } from "./vendor-bill-view";
import { vendorContactSchema } from "./patient-edit.service";

test("vendor response allowlist excludes all financial and result fields",()=>{
  const row=vendorBillView({_id:"synthetic",billNumber:"SYN",netAmount:100,dueAmount:10,comments:"internal",patientId:{_id:"p",fullName:"Synthetic",patientId:"SYN-P",passwordHash:"never"},items:[{testId:"t",unitPrice:100,total:100,packageAmount:100,testName:"Synthetic"}]});
  const text=JSON.stringify(row);for(const key of ["netAmount","dueAmount","unitPrice","packageAmount","passwordHash","internal"])assert.equal(text.includes(key),false);
  assert.equal(row.items[0].testId,"t");assert.equal(row.patientId?.patientId,"SYN-P");
});
test("vendor contact edits require optimistic version and reject identifiers, demographics and money",()=>{
  const base={expectedUpdatedAt:new Date().toISOString(),mobile:"0000000000"};
  assert.equal(vendorContactSchema.safeParse(base).success,true);
  for(const field of ["patientId","clientId","age","gender","firstName","netAmount","status"])assert.equal(vendorContactSchema.safeParse({...base,[field]:"forbidden"}).success,false);
  assert.equal(vendorContactSchema.safeParse({mobile:"0000000000"}).success,false);
});
