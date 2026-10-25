import test from "node:test";
import assert from "node:assert/strict";
import {displayPatientCode,patientCodeAliases,patientCodePattern} from "./patient-code";
import {generatePatientId} from "./id-generator";
import {Counter} from "../models/counter.model";
import {Patient} from "../models/patient.model";
test("patient display only removes the verified legacy padding zero",()=>{
 assert.equal(displayPatientCode("GP202600049"),"GP20260049");
 for(const id of ["GP20260049","GP202612345","VC202600049","DIAG2026-49","GP202649","507f1f77bcf86cd799439011"])assert.equal(displayPatientCode(id),id);
 assert.deepEqual(patientCodeAliases("GP20260049"),["GP20260049","GP202600049"]);
 for(const id of patientCodeAliases("GP20260049"))assert.ok(new RegExp(patientCodePattern("GP20260049")).test(id));
 assert.ok(!new RegExp(patientCodePattern("GP20260049")).test("GP202600490"));
 assert.equal(patientCodePattern("a.b"),"a\\.b");
 const p=new Patient({patientId:"GP202600049",firstName:"Synthetic",gender:"female",mobile:"0000000000"});
 assert.equal(p.toJSON().patientId,"GP20260049");assert.equal(p.patientId,"GP202600049");
});
test("patient counter stays atomic, skips legacy aliases and does not truncate growing sequences",async t=>{
 let seq=48;const keys:string[]=[];
 t.mock.method(Counter,"findOneAndUpdate",async(filter:any)=>{keys.push(filter.key);return {seq:++seq};});
 t.mock.method(Patient,"exists",async(filter:any)=>filter.patientId.$in.includes("GP"+new Date().getFullYear()+"0049")?{_id:"synthetic"}:null);
 const first=await generatePatientId();assert.equal(first,"GP"+new Date().getFullYear()+"0050");
 const concurrent=await Promise.all(Array.from({length:5},()=>generatePatientId()));assert.equal(new Set(concurrent).size,5);
 assert.ok(keys.every(key=>key==="patient:"+new Date().getFullYear()));
 seq=9999;assert.equal(await generatePatientId(),"GP"+new Date().getFullYear()+"10000");
});
