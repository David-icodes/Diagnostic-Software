import test from "node:test";
import assert from "node:assert/strict";
import {Types} from "mongoose";
import {LabTestParameter} from "../../models/lab-test-parameter.model";
import {LabTest} from "../../models/lab-test.model";
import {Department} from "../../models/department.model";
import {createLabTestParameterSchema,updateLabTestParameterSchema} from "../../validations/lab-test-parameter";
import {createParameter,getParameter,updateParameter} from "./lab-test-parameter.service";
const patch=(value:unknown)=>{const {testId,calculation,...rest}=updateLabTestParameterSchema.parse(value);assert.equal(testId,undefined);assert.equal(calculation,undefined);return rest;};
const values=["0","0.5","0.8","0.05","0.08","1.0","12.0","5.00","+0.50","-0.08",".5","001.00","negative","<0.5",">0.8","<= 0.05",">= 1.0","< 20 Deficient\n20-30 Insufficient\n>30 Sufficient","26.0 to 34.3 seconds","  preserved text  "];
const query=(value:unknown)=>{const q={exec:async()=>value,select:()=>q,lean:()=>q};return q;};
test("create/update/reload preserve generic/default text for every result type; omission differs from clearing",async t=>{
 const id=new Types.ObjectId(),actor=String(new Types.ObjectId());let stored:any;
 t.mock.method(LabTest,"findById",()=>query({_id:id}));t.mock.method(Department,"findById",()=>query({name:"Synthetic"}));
 t.mock.method(LabTestParameter,"create",async(data:any)=>{stored=new LabTestParameter(data);stored.save=async()=>stored;return stored;});
 t.mock.method(LabTestParameter,"findById",()=>query(stored));
 for(const resultType of ["TEXT","TEXTAREA","NUMBER","RANGE","SELECT","BOOLEAN"] as const){
  const input=createLabTestParameterSchema.parse({testId:String(id),parameterName:'Synthetic '+resultType,resultType,defaultValue:'0.05',rangeText:'<0.5',options:resultType==='SELECT'?['0.05','negative']:undefined});
  const {calculation,...plainInput}=input;assert.equal(calculation,undefined);const saved=await createParameter(actor,{...plainInput,testId:id,active:input.active ?? true});assert.equal(saved.defaultValue,'0.05');
  for(const value of values){await updateParameter(String(saved._id),actor,patch({defaultValue:value,rangeText:value}));const reopened=await getParameter(String(saved._id));assert.equal(reopened.defaultValue,value);assert.equal(reopened.rangeText,value);assert.equal(reopened.referenceRange,value);assert.equal(new LabTestParameter(stored.toObject()).defaultValue,value);}
  await updateParameter(String(saved._id),actor,patch({parameterName:'Synthetic renamed'}));assert.equal(stored.defaultValue,values.at(-1));
  await updateParameter(String(saved._id),actor,patch({defaultValue:'',rangeText:''}));assert.equal((await getParameter(String(saved._id))).defaultValue,'');assert.equal(stored.referenceRange,'');
 }
 assert.equal(createLabTestParameterSchema.safeParse({testId:String(id),parameterName:'x',rangeFrom:'<0.5'}).success,false);
});
