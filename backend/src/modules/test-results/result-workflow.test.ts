import mongoose from "mongoose";
import { LabSample } from "../../models/lab-sample.model";
import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { LabBill } from "../../models/lab-bill.model";
import { LabTestResult } from "../../models/lab-test-result.model";
import { LabTestParameter } from "../../models/lab-test-parameter.model";
import { Patient } from "../../models/patient.model";
import { AuditLog } from "../../models/audit-log.model";
import { submitTestResults } from "./test-result.service";
import { persistedSubmission, getResultWorkflow, assertResultReportAllowed, SUBMISSION_PENDING, SUBMISSION_CONFIRMED } from "./result-workflow.service";

test("saved false/zero values are valid; blank/nonfinite/unconfirmed results cannot print", () => {
  const row = { version: 1, enteredAt: new Date(), result: 0 };
  assert.equal(persistedSubmission([row]), true);
  assert.equal(persistedSubmission([{ ...row, result: false }]), true);
  assert.equal(persistedSubmission([row], SUBMISSION_PENDING), false);
  assert.equal(persistedSubmission([row], SUBMISSION_CONFIRMED), true);
  for (const result of [" ", NaN, Infinity, null]) assert.equal(persistedSubmission([{ ...row, result }]), false);
  assert.equal(persistedSubmission([]), false);
});

test("patient dues and successful/failed/partial submissions are verified from storage after reopen", async (t) => {
 t.mock.method(mongoose.connection,"transaction",async(callback:any)=>callback(undefined));
 t.mock.method(LabSample,"findOne",()=>({exec:async()=>null}) as any);
 t.mock.method(LabBill,"updateOne",()=>({exec:async()=>({matchedCount:1})}) as any);

  const billId = new Types.ObjectId(); const patientId = new Types.ObjectId(); const testId = new Types.ObjectId();
  const p1 = new Types.ObjectId(); const p2 = new Types.ObjectId(); const userId = new Types.ObjectId();
  const bill = { _id: billId, patientId, status: "generated", items: [{ testId }], netAmount: 100, paidAmount: 100, dueAmount: 0 };
  let failSecond = false; let failFirst = false; let failConfirmation = false;
  const rows: any[] = []; const audits: any[] = [];
  const parameters = [p1, p2].map((_id, index) => ({ _id, testId, active: true, parameterName: `P${index}`, resultType: "NUMBER", referenceRange: "5-8" }));
  const query = (value: unknown) => { const q = { exec: async () => value, sort: () => q, select: () => q, lean: () => q }; return q; };
  t.mock.method(LabBill, "findById", () => query(bill));
  t.mock.method(LabBill, "find", () => { throw new Error("Unrelated patient bills must not be queried"); });
  t.mock.method(Patient, "findById", () => query({ gender: "male", age: 21 }));
  t.mock.method(LabTestParameter, "find", () => query(parameters));
  t.mock.method(LabTestResult, "findOne", (filter: any) => query(rows.find((row) => String(row.parameterId) === String(filter.parameterId)) ?? null));
  t.mock.method(LabTestResult, "find", (filter: any) => {
    assert.equal(String(filter.billId), String(billId));
    if (filter.patientId) assert.equal(String(filter.patientId), String(patientId));
    return query(rows);
  });
  t.mock.method(LabTestResult, "create", async (data: any) => {
    if (failFirst) throw new Error("simulated first write failure");
    if (failSecond && String(data.parameterId) === String(p2)) throw new Error("simulated write failure");
    const row = { ...data, _id: data._id ?? new Types.ObjectId(), save: async () => row }; rows.push(row); return row;
  });
  t.mock.method(AuditLog, "create", async (data: any) => {
    const row = { ...data, _id: new Types.ObjectId(), save: async () => {
      if (failConfirmation) { row.action = SUBMISSION_PENDING; throw new Error("confirmation unavailable"); }
      return row;
    }}; audits.push(row); return row;
  });
  t.mock.method(AuditLog, "find", (filter: any) => query(audits.filter((row) => filter.action.$in.includes(row.action) &&
    filter.entity.$in.some((id: Types.ObjectId) => String(id) === String(row.entity))).reverse()));
  const input = { billId: String(billId), testId: String(testId), entries: [{ parameterId: String(p1), result: 13, resultDisplay: "13.0" }, { parameterId: String(p2), result: 7 }] };

  assert.equal((await getResultWorkflow(String(billId))).tests[0].submitted, false);
  await assert.rejects(assertResultReportAllowed(String(billId), [String(testId)]), /Submit/);
  // A patient with due can submit; due affects only report generation.
  bill.dueAmount = 25;
  await submitTestResults(String(userId), input);
  assert.equal(rows[0].resultDisplay, "13.0");
  input.entries[0].resultDisplay = "13.00";
  await submitTestResults(String(userId), input);
  assert.equal(rows[0].result, 13);
  assert.equal(rows[0].resultDisplay, "13.00");
  assert.equal(rows[0].revisions[0].resultDisplay, "13.0");
  await assert.rejects(submitTestResults(String(userId), {...input, entries: [{parameterId:String(p1), result:13, resultDisplay:"13.01"}]}), /exact numeric result/);
  assert.equal((await getResultWorkflow(String(billId))).tests[0].submitted, true);
  await assert.rejects(assertResultReportAllowed(String(billId), [String(testId)]), /outstanding due/);
  await assert.rejects(assertResultReportAllowed(String(billId), [String(testId)], false), /outstanding due/);
  bill.dueAmount = 0;
  assert.equal((await assertResultReportAllowed(String(billId), [String(testId)])).outstandingDue, 0);
  // No temporary client variable: a separate read retains confirmation.
  assert.equal((await getResultWorkflow(String(billId))).tests[0].submitted, true);
  await assert.rejects(assertResultReportAllowed(String(billId), [String(new Types.ObjectId())]), /Submit/);
  await assert.rejects(assertResultReportAllowed(String(billId), [String(new Types.ObjectId())], false), /Submit/);

  rows.length = 0; audits.length = 0; failFirst = true;
  await assert.rejects(submitTestResults(String(userId), input), /simulated first write failure/);
  assert.equal(rows.length, 0);
  assert.equal((await getResultWorkflow(String(billId))).tests[0].submitted, false);
  failFirst = false; audits.length = 0; failSecond = true;
  await assert.rejects(submitTestResults(String(userId), input), /simulated write failure/);
  assert.equal(rows.length, 1); // Partial writes do not masquerade as submitted.
  assert.equal((await getResultWorkflow(String(billId))).tests[0].submitted, false);
  await assert.rejects(assertResultReportAllowed(String(billId), [String(testId)]), /Submit/);
  failSecond = false;
  await submitTestResults(String(userId), input);
  assert.equal((await getResultWorkflow(String(billId))).tests[0].submitted, true);

  failConfirmation = true;
  await assert.rejects(submitTestResults(String(userId), input), /confirmation unavailable/);
  assert.equal((await getResultWorkflow(String(billId))).tests[0].submitted, false);
  failConfirmation = false; bill.dueAmount = NaN;
  await assert.rejects(getResultWorkflow(String(billId)), /could not be verified/);
  assert.equal(bill.netAmount, 100); assert.equal(bill.paidAmount, 100); assert.ok(Number.isNaN(bill.dueAmount));
  assert.equal(rows[0].referenceSnapshot.flag, "OUT_OF_RANGE");
});

 test("configured CBC results are recalculated by the server, audited and preserved across revisions despite dues", async t => {
 t.mock.method(mongoose.connection,"transaction",async(callback:any)=>callback(undefined));
 t.mock.method(LabSample,"findOne",()=>({exec:async()=>null}) as any);
 t.mock.method(LabBill,"updateOne",()=>({exec:async()=>({matchedCount:1})}) as any);

 const billId=new Types.ObjectId(), patientId=new Types.ObjectId(), testId=new Types.ObjectId(), userId=new Types.ObjectId();
 const rbcId=new Types.ObjectId(), mcvId=new Types.ObjectId(), pcvId=new Types.ObjectId();
 const bill={_id:billId,patientId,status:"generated",items:[{testId}],netAmount:100,paidAmount:0,dueAmount:100};
 const parameters=[{_id:rbcId,testId,active:true,parameterName:"Custom RBC",resultType:"NUMBER",unit:"million/µL"},{_id:mcvId,testId,active:true,parameterName:"Custom MCV",resultType:"NUMBER",unit:"fL"},{_id:pcvId,testId,active:true,parameterName:"Custom PCV",resultType:"NUMBER",unit:"%",calculationApproval:{revision:1,formulaVersion:"1",rounding:"HALF_UP",approvedBy:String(userId),approvedAt:new Date()},calculation:{formulaId:"pcv",dependencyIds:[String(rbcId),String(mcvId)]}}];
 const rows:any[]=[];const audits:any[]=[];const query=(value:unknown)=>{const q={exec:async()=>value,sort:()=>q,select:()=>q,lean:()=>q};return q;};
 t.mock.method(LabBill,"findById",()=>query(bill));t.mock.method(Patient,"findById",()=>query({gender:"male",age:30}));t.mock.method(LabTestParameter,"find",()=>query(parameters));
 t.mock.method(LabTestResult,"findOne",(filter:any)=>query(rows.find(row=>String(row.parameterId)===String(filter.parameterId))??null));
 t.mock.method(LabTestResult,"find",()=>query(rows));
 t.mock.method(LabTestResult,"create",async (data:any)=>{const row={...data,_id:data._id??new Types.ObjectId(),save:async()=>row};rows.push(row);return row;});
 t.mock.method(AuditLog,"create",async (data:any)=>{const row={...data,_id:new Types.ObjectId(),save:async()=>row};audits.push(row);return row;});
 const input={billId:String(billId),testId:String(testId),acceptedCalculationIds:[String(pcvId)],acceptedCalculationRevisions:{[String(pcvId)]:1},entries:[{parameterId:String(rbcId),result:4},{parameterId:String(mcvId),result:90},{parameterId:String(pcvId),result:36}]};
  const sourceUnit=parameters[0].unit;parameters[0].unit="cells/µL";
  await assert.rejects(submitTestResults(String(userId),input),/compatible source/);
  parameters[0].unit=sourceUnit;
  // Submitting a matching value without accepting the calculation is allowed (manual entry)
  await submitTestResults(String(userId),{...input,acceptedCalculationIds:[]});
  rows.length=0;
  // Submitting a stale/wrong value without accepting still fails
  await assert.rejects(submitTestResults(String(userId),{...input,acceptedCalculationIds:[],entries:input.entries.map(entry=>entry.parameterId===String(pcvId)?{...entry,result:999}:entry)}),/missing or stale/);
 await submitTestResults(String(userId),input);const pcv=rows.find(row=>String(row.parameterId)===String(pcvId));assert.equal(pcv.result,36);assert.equal(pcv.version,1);assert.equal(audits[0].action,SUBMISSION_CONFIRMED);
 input.entries[0].result=5;input.entries[2].result=45;await submitTestResults(String(userId),input);assert.equal(pcv.result,45);assert.equal(pcv.version,2);assert.equal(pcv.revisions[0].result,36);
 await assert.rejects(submitTestResults(String(userId),{...input,entries:input.entries.filter(entry=>entry.parameterId!==String(rbcId))}),/source values/);assert.equal(pcv.result,45);assert.equal(pcv.version,2);
 assert.equal(bill.dueAmount,100);assert.equal(bill.paidAmount,0);
});
