import test from "node:test";
import assert from "node:assert/strict";
import { LabBill } from "../../../models/lab-bill.model";
import { listGeneratedLabBills } from "./generated-lab-bills.service";
test("analytics reuse complete bill filters, exclude cancelled bills, and never count outstanding as collected", async(t) => {
  const bill={id:"fixture",billNumber:"Fixture",status:"generated",patientType:"osp",patientId:{patientId:"GP-FIXTURE",fullName:"Synthetic"},items:[],createdAt:new Date("2026-10-09T06:00:00Z"),paymentMode:"cash",totalAmount:100,discountAmount:10,netAmount:90,paidAmount:40,dueAmount:50};
  const fixtures=[bill,{...bill,id:"cancelled",status:"cancelled",totalAmount:200,netAmount:200,paidAmount:200,dueAmount:0}];
  t.mock.method(LabBill,"countDocuments",async() => fixtures.length);
  const chain={sort:()=>chain,skip:()=>chain,limit:()=>chain,populate:()=>chain,exec:async()=>fixtures};
  t.mock.method(LabBill,"find",()=>chain);
  let calls=0;
  t.mock.method(LabBill,"aggregate",async(pipeline: Record<string,any>[]) => {
    calls++; assert.equal(pipeline[0].$match.status,"generated");
    assert.deepEqual(pipeline[0].$match.paymentMode,{$in:["cash"]});
    const eligible=fixtures.filter(b=>b.status===pipeline[0].$match.status);
    const sum=(field:keyof typeof bill)=>eligible.reduce((n,b)=>n+Number(b[field]),0);
    if(pipeline[1].$facet) {
      assert.equal(pipeline[1].$facet.daily[0].$group.paidAmount.$sum,"$paidAmount");
      assert.equal(pipeline[1].$facet.daily[0].$group.dueAmount.$sum,"$dueAmount");
      return [{daily:[{date:"2026-10-09",netAmount:sum("netAmount"),paidAmount:sum("paidAmount"),dueAmount:sum("dueAmount")}],paymentModes:[{mode:"cash",paidAmount:sum("paidAmount")}]}];
    }
    return [{totalBills:eligible.length,totalAmount:sum("totalAmount"),totalDiscount:sum("discountAmount"),totalNet:sum("netAmount"),totalPaid:sum("paidAmount"),totalDue:sum("dueAmount")}];
  });
  const result=await listGeneratedLabBills({page:1,limit:1,paymentModes:"cash"});
  assert.equal(calls,2); assert.deepEqual(result.summary,{totalBills:1,totalAmount:100,totalDiscount:10,totalNet:90,totalPaid:40,totalDue:50});
  assert.equal(result.analytics.daily[0].paidAmount,40); assert.equal(result.analytics.daily[0].dueAmount,50);
});
