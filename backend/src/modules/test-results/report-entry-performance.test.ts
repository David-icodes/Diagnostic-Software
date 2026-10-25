import test from "node:test";
import assert from "node:assert/strict";
import {performance} from "node:perf_hooks";
import {Types} from "mongoose";
import {LabBill} from "../../models/lab-bill.model";
import {Patient} from "../../models/patient.model";
import {LabTestParameter} from "../../models/lab-test-parameter.model";
import {LabTestResult} from "../../models/lab-test-result.model";
import {getBillResultEntry} from "./test-result.service";

test("report metadata reads preserve the same bill and patient data",async t=>{
 const billId=new Types.ObjectId(),patientId=new Types.ObjectId(),testId=new Types.ObjectId();
 const bill={_id:billId,patientId,status:"generated",billNumber:"SYN",items:[{testId,testName:"Synthetic",testCode:"SYN"}]};
 let active=0,maxActive=0;const seen:string[]=[];
 const query=(kind:string,value:unknown)=>{const q={sort:()=>q,exec:async()=>{seen.push(kind);active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setTimeout(r,40));active--;return value;}};return q;};
 t.mock.method(LabBill,"findById",()=>({exec:async()=>bill}) as never);
 t.mock.method(Patient,"findById",(value:unknown)=>{assert.equal(String(value),String(patientId));return query("patient",{fullName:"Synthetic",age:30,gender:"male"}) as never;});
 t.mock.method(LabTestParameter,"find",()=>query("parameters",[]) as never);
 t.mock.method(LabTestResult,"find",(filter:Record<string,unknown>)=>{assert.equal(String(filter.billId),String(billId));return query("results",[]) as never;});
 const started=performance.now();const entry=await getBillResultEntry(String(billId));
 t.diagnostic(JSON.stringify({scope:"Synthetic model reads with fixed 40ms latency each; not production timing",elapsedMs:Math.round((performance.now()-started)*100)/100,maxConcurrentReads:maxActive}));
 assert.equal(maxActive,3);assert.equal(entry.patientId,String(patientId));assert.equal(entry.tests.length,1);assert.deepEqual(seen.sort(),["parameters","patient","results"]);
});
