import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { Department } from "../../models/department.model";
import { LabTest } from "../../models/lab-test.model";
import { LabTestParameter } from "../../models/lab-test-parameter.model";
import { createParameter, getParameter, updateParameter } from "./lab-test-parameter.service";
const query=(value:unknown)=>{const q={exec:async()=>value,select:()=>q,lean:()=>q};return q;};
test("parameter, subtitle and narrative configurations persist against the exact test with stable order",async t=>{
 const testId=new Types.ObjectId();const departmentId=new Types.ObjectId();const user=String(new Types.ObjectId());const rows:any[]=[];
 t.mock.method(LabTest,"findById",()=>query({_id:testId,departmentId,testName:"Synthetic CBC"}));
 t.mock.method(Department,"findById",()=>query({name:"Synthetic Department"}));
 t.mock.method(LabTestParameter,"create",async (data:any)=>{const row={...data,_id:new Types.ObjectId(),save:async()=>row};rows.push(row);return row;});
 t.mock.method(LabTestParameter,"findById",(id:any)=>query(rows.find(row=>String(row._id)===String(id))));
 // getParameter returns the persisted row with its existing reference mappings.
 for(const [index,itemType] of ["PARAMETER","SUBTITLE","TEXT_AREA"].entries()){
  const data={testId,parameterName:"Synthetic "+itemType,itemType,resultType:"NUMBER",displayOrder:index+1,active:true,referenceType:"GENERAL",referenceMappings:[],mappingTypes:[],genderRanges:[],unit:"g/dL",rangeFrom:1,rangeTo:10,defaultValue:itemType==="TEXT_AREA"?"Line one\nLine two":undefined} as never;
  const saved=await createParameter(user,data);assert.equal(String(saved.testId),String(testId));assert.equal(saved.displayOrder,index+1);
  const reopened=await getParameter(String(saved._id));assert.equal(reopened.itemType,itemType);
  if(itemType!=="PARAMETER"){assert.equal(reopened.unit,undefined);assert.equal(reopened.referenceRange,undefined);assert.equal(reopened.calculation,null);}
  if(itemType==="TEXT_AREA"){assert.equal(reopened.resultType,"TEXTAREA");assert.equal(reopened.defaultValue,"Line one\nLine two");}
 }
 const heading=rows[1];await updateParameter(String(heading._id),user,{parameterName:"Renamed heading"});assert.equal(heading.parameterName,"Renamed heading");assert.equal(heading.resultType,"TEXT");assert.equal(heading.referenceRange,undefined);
});
