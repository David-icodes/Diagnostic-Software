import test from "node:test";
import assert from "node:assert/strict";
import {Types} from "mongoose";
import {Department} from "../../models/department.model";
import {updateDepartment, setDepartmentActive} from "./department.service";
test("legacy missing creator reproduces document-save validation; permitted updates preserve identity and provenance",async t=>{
 const id=new Types.ObjectId(),actor=new Types.ObjectId();
 const legacy=Department.hydrate({_id:id,name:"Synthetic legacy",code:"SYNLEG"});
 assert.ok(legacy.validateSync()?.errors.createdBy);
 t.mock.method(Department,"findById",()=>({exec:async()=>legacy}) as any);
 let requests=0;
 t.mock.method(Department,"findByIdAndUpdate",(target:any,update:any,options:any)=>{
  requests++;assert.equal(String(target),String(id));assert.equal(options.runValidators,true);assert.equal(options.new,true);
  assert.equal("createdBy" in update.$set,false);assert.equal("_id" in update.$set,false);
  return {exec:async()=>Object.assign(legacy,update.$set)} as any;
 });
 await updateDepartment(String(actor),String(id),{name:"Synthetic revised"});
 await setDepartmentActive(String(actor),String(id),false);
 assert.equal(requests,2);assert.equal(legacy.createdBy,undefined);assert.equal(String(legacy._id),String(id));assert.equal(legacy.active,false);
});
