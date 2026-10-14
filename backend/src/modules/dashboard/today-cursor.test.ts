import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { LabBill } from "../../models/lab-bill.model";
import { getTodayBills } from "./dashboard.service";
test("Today Bills cursor combines the date window with stable time/ID ordering",async t=>{
  const id=new Types.ObjectId(),createdAt=new Date("2026-10-14T10:00:00Z");let filter:any,sort:any,limit:any;
  t.mock.method(LabBill,"findById",()=>({select:()=>({lean:()=>({exec:async()=>({_id:id,createdAt})})})}));
  t.mock.method(LabBill,"find",(value:any)=>{filter=value;const q={sort:(value:any)=>{sort=value;return q;},limit:(value:any)=>{limit=value;return q;},populate:()=>q,lean:()=>q,exec:async()=>[]};return q;});
  await getTodayBills({fromDate:"2026-10-14",toDate:"2026-10-14",before:String(id),limit:30});
  assert.deepEqual(sort,{createdAt:-1,_id:-1});assert.equal(limit,30);assert.ok(filter.createdAt);
  assert.deepEqual(filter.$and.at(-1),{$or:[{createdAt:{$lt:createdAt}},{createdAt,_id:{$lt:id}}]});
});
