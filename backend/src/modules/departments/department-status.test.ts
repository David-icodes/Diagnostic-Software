import test from "node:test";
import assert from "node:assert/strict";
import { Department } from "../../models/department.model";
import { LabTest } from "../../models/lab-test.model";
import { listDepartments, setDepartmentActive } from "./department.service";
test("status changes preserve ID and permit referenced departments without deletion",async(t)=>{
  const record={_id:"507f1f77bcf86cd799439011",active:true,save:async()=>record};
  t.mock.method(Department,"findById",()=>({exec:async()=>record}));
  t.mock.method(LabTest,"countDocuments",()=>{throw new Error("Status must not check deletion references");});
  const id=record._id;
  await setDepartmentActive(id,id,false);assert.equal(record.active,false);
  await setDepartmentActive(id,id,true);assert.equal(record.active,true);assert.equal(record._id,id);
});
test("active department filtering includes legacy missing status; inactive is explicitly false",async(t)=>{
  let filter:unknown;
  t.mock.method(Department,"find",(value:unknown)=>{filter=value;return {sort:()=>({exec:async()=>[]})};});
  t.mock.method(LabTest,"aggregate",async()=>[]);
  await listDepartments({status:"active"});assert.deepEqual(filter,{active:{$ne:false}});
  await listDepartments({status:"inactive"});assert.deepEqual(filter,{active:false});
});
