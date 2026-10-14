import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { LabPackage } from "../../models/lab-package.model";
import { LabTest } from "../../models/lab-test.model";
import { Department } from "../../models/department.model";
import { buildSnapshotItems,computeTotals } from "./lab-bill.service";
test("fixed package charges once, keeps actual test IDs, rejects overlap, and leaves individual prices intact",async t=>{
 const a=new Types.ObjectId(),b=new Types.ObjectId(),packId=new Types.ObjectId(),department=new Types.ObjectId();let active=true;
 t.mock.method(LabPackage,"findOne",()=>({exec:async()=>active?{_id:packId,name:"Synthetic XYZ",amount:1000,insAmount:700,items:[{testId:a,departmentId:department},{testId:b,departmentId:department}]}:null}) as any);
 t.mock.method(LabTest,"find",()=>({exec:async()=>[{_id:a,testName:"A",testCode:"A",departmentId:department,active:true,price:600},{_id:b,testName:"B",testCode:"B",departmentId:department,active:true,price:650}]}) as any);
 t.mock.method(Department,"find",()=>({select(){return this;},exec:async()=>[{_id:department,name:"Synthetic"}]}) as any);
 const rows=await buildSnapshotItems([{testId:String(packId),packageId:String(packId),quantity:2}],"osp");assert.deepEqual(rows.map(row=>String(row.testId)),[String(a),String(b)]);assert.equal(computeTotals(rows).totalAmount,2000);assert.deepEqual(rows.map(row=>row.unitPrice),[1000,0]);assert.ok(rows.every(row=>String(row.packageId)===String(packId)));assert.equal(rows[0].packageName,"Synthetic XYZ");
 const individual=await buildSnapshotItems([{testId:String(a),quantity:1}],"osp");assert.equal(individual[0].unitPrice,600);assert.equal(individual[0].packageId,undefined);
 await assert.rejects(buildSnapshotItems([{testId:String(packId),packageId:String(packId),quantity:1},{testId:String(a),quantity:1}],"osp"),/individually/);
 active=false;await assert.rejects(buildSnapshotItems([{testId:String(packId),packageId:String(packId),quantity:1}],"osp"),/active package/);
});
