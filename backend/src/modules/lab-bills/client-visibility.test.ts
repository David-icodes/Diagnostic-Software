import test from "node:test";
import assert from "node:assert/strict";
import { LabBill } from "../../models/lab-bill.model";
import { Patient } from "../../models/patient.model";
import { LabSample } from "../../models/lab-sample.model";
import { listLabBills } from "./lab-bill.service";
test("generated vendor and ordinary bills retain test associations; client-name search is not patient-only", async t => {
  let filter:any;const rows=[{_id:"ordinary",billType:"osp",items:[{testId:"first"}]},{_id:"vendor",billType:"vendor",clientName:"Synthetic Client",items:[{testId:"second"}]}];
  const q=(value:unknown)=>{const chain={select:()=>chain,sort:()=>chain,skip:()=>chain,limit:()=>chain,populate:()=>chain,lean:()=>chain,exec:async()=>value};return chain;};
  t.mock.method(LabBill,"find",(value:any)=>{filter=value;return q(rows);});
  t.mock.method(LabBill,"countDocuments",async()=>2);t.mock.method(Patient,"find",()=>q([]));t.mock.method(LabSample,"find",()=>q([]));
  const result=await listLabBills({status:"generated",search:"Synthetic Client"});
  assert.equal(filter.billType,undefined);assert.ok(filter.$or.some((entry:any)=>entry.clientName));assert.deepEqual(result.data,rows);
  await listLabBills({status:"generated",billType:"osp"});assert.equal(filter.billType,"osp");
});
