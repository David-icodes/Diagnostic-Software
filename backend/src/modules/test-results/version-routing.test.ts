import mongoose from "mongoose";
import { LabSample } from "../../models/lab-sample.model";
import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {Types} from "mongoose";
import {LabBill} from "../../models/lab-bill.model";
import {LabTestParameter} from "../../models/lab-test-parameter.model";
import {LabTestResult} from "../../models/lab-test-result.model";
import {Patient} from "../../models/patient.model";
import {getBillResultEntry,submitTestResults} from "./test-result.service";

test("entry/report-data routing preserves seven snapshots and rejects an unpinned successor submission before writes",async t=>{
 t.mock.method(mongoose.connection,"transaction",async(callback:any)=>callback(undefined));
 t.mock.method(LabSample,"findOne",()=>({exec:async()=>null}) as any);
 t.mock.method(LabBill,"updateOne",()=>({exec:async()=>({matchedCount:1})}) as any);

 const billId=new Types.ObjectId(),patientId=new Types.ObjectId(),testId=new Types.ObjectId(),userId=new Types.ObjectId();
 const oldIds=Array.from({length:7},()=>new Types.ObjectId()),newIds=oldIds.map(()=>new Types.ObjectId());
 const old=oldIds.map((_id,i)=>({_id,testId,active:true,parameterName:"Changed master "+i,resultType:"TEXT",unit:"changed",method:"changed",referenceRange:"changed",displayOrder:i}));
 const next=newIds.map((_id,i)=>({...old[i],_id,resultType:"NUMBER",unit:"gm/dL",lineage:{originalId:String(oldIds[i]),predecessorId:String(oldIds[i]),version:2,manifestReference:"Synthetic only"}}));
 const rows=oldIds.map((parameterId,i)=>({billId,patientId,testId,parameterId,parameterName:"Historical "+i,resultType:"TEXT",unit:"gm/dL",method:"Original",referenceRange:"original",result:"30.00",version:2,revisions:[{result:"29.00",version:1}]}));
 const hash=()=>createHash("sha256").update(JSON.stringify(rows)).digest("hex"),before=hash();
 const bill={_id:billId,patientId,status:"generated",billNumber:"SYN",items:[{testId,testName:"Synthetic CBP",testCode:"SYN",parameterVersionIds:undefined as string[]|undefined}]};
 const q=(value:unknown)=>{const query={exec:async()=>value,sort:()=>query};return query;};
 t.mock.method(LabBill,"findById",()=>q(bill));t.mock.method(Patient,"findById",()=>q({fullName:"Synthetic",age:30,gender:"male"}));
 t.mock.method(LabTestParameter,"find",()=>q([...old,...next]));t.mock.method(LabTestResult,"find",()=>q(rows));
 t.mock.method(LabTestResult,"create",()=>{throw new Error("No historical or successor write permitted");});
 const entry=await getBillResultEntry(String(billId));assert.equal(entry.tests[0].parameters.length,7);
 entry.tests[0].parameters.forEach((p,i)=>{assert.equal(p.parameterId,String(oldIds[i]));assert.equal(p.parameterName,rows[i].parameterName);assert.equal(p.unit,"gm/dL");assert.equal(p.method,"Original");assert.equal(p.reference.displayValue,"original");assert.equal(p.resultType,"TEXT");});
 await assert.rejects(submitTestResults(String(userId),{billId:String(billId),testId:String(testId),entries:[{parameterId:String(newIds[0]),result:30}]}),/do not belong/);
 bill.items[0].parameterVersionIds=newIds.map(String);
 await assert.rejects(getBillResultEntry(String(billId)),/conflict/);assert.equal(hash(),before);
});

test("prospective pinned order exposes only numeric successor and its unchanged display unit",async t=>{
 t.mock.method(mongoose.connection,"transaction",async(callback:any)=>callback(undefined));
 t.mock.method(LabSample,"findOne",()=>({exec:async()=>null}) as any);
 t.mock.method(LabBill,"updateOne",()=>({exec:async()=>({matchedCount:1})}) as any);

 const billId=new Types.ObjectId(),testId=new Types.ObjectId(),oldId=new Types.ObjectId(),nextId=new Types.ObjectId();
 const q=(value:unknown)=>{const query={exec:async()=>value,sort:()=>query};return query;};
 t.mock.method(LabBill,"findById",()=>q({_id:billId,patientId:new Types.ObjectId(),status:"generated",items:[{testId,testName:"Synthetic CBP",parameterVersionIds:[String(nextId)]}]}));
 t.mock.method(Patient,"findById",()=>q({age:30,gender:"male"}));
 t.mock.method(LabTestResult,"find",()=>q([]));
 t.mock.method(LabTestParameter,"find",()=>q([{_id:oldId,testId,active:true,parameterName:"Legacy",resultType:"TEXT",unit:"gm/dL",displayOrder:1},{_id:nextId,testId,active:false,parameterName:"Prospective",resultType:"NUMBER",unit:"gm/dL",displayOrder:1,lineage:{originalId:String(oldId),predecessorId:String(oldId),version:2,manifestReference:"Synthetic only"}}]));
 const entry=await getBillResultEntry(String(billId));assert.equal(entry.tests[0].parameters.length,1);assert.equal(entry.tests[0].parameters[0].parameterId,String(nextId));assert.equal(entry.tests[0].parameters[0].resultType,"NUMBER");assert.equal(entry.tests[0].parameters[0].unit,"gm/dL");assert.equal(entry.tests[0].parameters[0].calculation,undefined);
});
