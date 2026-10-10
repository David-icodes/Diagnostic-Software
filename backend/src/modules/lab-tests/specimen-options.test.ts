import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { LabTest } from "../../models/lab-test.model";
import { SpecimenOption } from "../../models/specimen-option.model";
import { Department } from "../../models/department.model";
import { AuditLog } from "../../models/audit-log.model";
import { createSpecimenOption, listTestSpecimenOptions, createTest, getTest } from "./lab-test.service";

const query=(value:unknown)=>{const q={exec:async()=>value,select:()=>q,lean:()=>q,populate:()=>q};return q;};
test("specimen creation persists separately, reopens, deduplicates case and preserves legacy spelling",async t=>{
 const stored:any[]=[];const audits:any[]=[];const user=String(new Types.ObjectId());
 t.mock.method(LabTest,"find",()=>query([{sampleType:"Legacy Spelling",containerType:"Legacy Tube"}]));
 t.mock.method(SpecimenOption,"find",()=>query(stored));
 t.mock.method(SpecimenOption,"findOneAndUpdate",(filter:any,update:any)=>{let row=stored.find(row=>row.kind===filter.kind&&row.normalizedName===filter.normalizedName);if(!row){row={...update.$setOnInsert,_id:new Types.ObjectId()};stored.push(row);}return query(row);});
 t.mock.method(AuditLog,"create",async (data:any)=>{audits.push(data);return data;});
 assert.deepEqual(await createSpecimenOption(user,{kind:"sample",name:"  Synthetic Sample  "}),{kind:"sample",name:"Synthetic Sample"});
 await createSpecimenOption(user,{kind:"tube",name:"Synthetic Tube"});
 await createSpecimenOption(user,{kind:"sample",name:"synthetic sample"});
 assert.equal(stored.length,2);assert.equal(audits.length,2);
 assert.deepEqual(await createSpecimenOption(user,{kind:"sample",name:"legacy spelling"}),{kind:"sample",name:"Legacy Spelling"});
 assert.deepEqual(await listTestSpecimenOptions(),{sampleTypes:["Legacy Spelling","Synthetic Sample"],containerTypes:["Legacy Tube","Synthetic Tube"]});
 await assert.rejects(createSpecimenOption(user,{kind:"sample",name:"   "}),/name/);
});
test("new test keeps INVG202, department and specimen IDs through create/reopen; duplicates remain rejected",async t=>{
 const department=new Types.ObjectId();const user=String(new Types.ObjectId());let stored:any;
 t.mock.method(Department,"findById",()=>query({_id:department,name:"Synthetic Department"}));
 t.mock.method(LabTest,"create",async (data:any)=>{if(stored){const error=Object.assign(new Error("duplicate"),{code:11000});throw error;}stored={...data,_id:new Types.ObjectId()};return stored;});
 t.mock.method(LabTest,"findById",()=>query(stored));
 const input={testCode:"INVG202",testName:"Synthetic Test",shortName:"Synthetic",departmentId:department,sampleType:"Synthetic Sample",containerType:"Synthetic Tube",price:100,active:true,resultMode:"PARAMETER_BASED"} as never;
 const saved=await createTest(user,input);const reopened=await getTest(String((saved as any)._id));
 assert.equal(reopened.testCode,"INVG202");assert.equal(String(reopened.departmentId),String(department));assert.equal(reopened.sampleType,"Synthetic Sample");assert.equal(reopened.containerType,"Synthetic Tube");
 await assert.rejects(createTest(user,input),/already exists/);
});
