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

test("packages use each current test department, reject duplicate mappings and unavailable departments",async t=>{
 const a=new Types.ObjectId(),b=new Types.ObjectId(),packId=new Types.ObjectId(),d1=new Types.ObjectId(),d2=new Types.ObjectId();
 let duplicate=false,available=true;
 t.mock.method(LabPackage,"findOne",()=>({exec:async()=>({_id:packId,name:"Synthetic multi",amount:300,items:[{testId:a,departmentId:d2},{testId:duplicate?a:b,departmentId:d1}]})}) as any);
 t.mock.method(LabTest,"find",()=>({exec:async()=>[{_id:a,testName:"A",testCode:"A",departmentId:d1,active:true,price:100},{_id:b,testName:"B",testCode:"B",departmentId:d2,active:true,price:200}]}) as any);
 t.mock.method(Department,"find",()=>({select(){return this;},exec:async()=>[{_id:d1,name:"Synthetic H",active:true},...available?[{_id:d2,name:"Synthetic C",active:true}]:[]]}) as any);
 const input=[{testId:String(packId),packageId:String(packId),quantity:1}];
 const rows=await buildSnapshotItems(input,"osp");assert.deepEqual(rows.map(row=>row.departmentName),["Synthetic H","Synthetic C"]);assert.equal(computeTotals(rows).totalAmount,300);
 duplicate=true;await assert.rejects(buildSnapshotItems(input,"osp"),/overlapping/);duplicate=false;
 available=false;await assert.rejects(buildSnapshotItems(input,"osp"),/missing department/);
});

test("saved package membership permits catalogue-hidden tests without enabling individual billing",async t=>{
 const a=new Types.ObjectId(),p=new Types.ObjectId(),d=new Types.ObjectId();
 t.mock.method(LabPackage,"findOne",()=>({exec:async()=>({_id:p,name:"Synthetic package",amount:100,items:[{testId:a,departmentId:d}]})}) as any);
 t.mock.method(LabTest,"find",()=>({exec:async()=>[{_id:a,testName:"Hidden synthetic",testCode:"HIDDEN",departmentId:d,active:false,price:40}]}) as any);
 t.mock.method(Department,"find",()=>({select(){return this;},exec:async()=>[{_id:d,name:"Synthetic",active:false}]}) as any);
 const rows=await buildSnapshotItems([{testId:String(p),packageId:String(p),quantity:1}],"osp");assert.equal(rows[0].unitPrice,100);assert.equal(String(rows[0].testId),String(a));
 await assert.rejects(buildSnapshotItems([{testId:String(a),quantity:1}],"osp"),/Inactive tests/);
});
