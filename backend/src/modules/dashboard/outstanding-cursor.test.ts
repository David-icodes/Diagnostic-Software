import test from "node:test";
import assert from "node:assert/strict";
import {Types} from "mongoose";
import {LabBill} from "../../models/lab-bill.model";
import {getOutstandingBills} from "./outstanding-bills.service";
test("due cursor applies only to rows, preserves global totals, probes one extra and does not use offsets",async t=>{
 const id=new Types.ObjectId(),date=new Date();
 t.mock.method(LabBill,"exists",async()=>null);
 t.mock.method(LabBill,"findById",()=>({select(){return this;},lean(){return this;},exec:async()=>({_id:id,createdAt:date})}) as any);
 t.mock.method(LabBill,"aggregate",(pipeline:any)=>{
  const facet=pipeline.find((row:any)=>row.$facet).$facet;assert.equal(facet.items.some((row:any)=>row.$skip!==undefined),false);
  assert.equal(facet.items.find((row:any)=>row.$limit).$limit,3);assert.equal(facet.summary.some((row:any)=>row.$match),false);
  assert.equal(facet.items[0].$match.$or[1]._id.$lt,id);
  return {exec:async()=>[{summary:[{total:45,totalDue:900}],items:[{id:"a"},{id:"b"},{id:"c"}]}]} as any;
 });
 const result=await getOutstandingBills(1,2,true,String(id));assert.equal(result.items.length,2);assert.equal(result.nextCursor,"b");assert.equal(result.totalDue,900);assert.equal(result.pagination.total,45);
 await assert.rejects(getOutstandingBills(1,2,true,"bad"),/Invalid bill cursor/);
});
