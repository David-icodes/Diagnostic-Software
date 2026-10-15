import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { PDFDocument, degrees } from "pdf-lib";
import { LabBill } from "../../models/lab-bill.model";
import { LabTestResult } from "../../models/lab-test-result.model";
import { LabReportUpload } from "../../models/lab-report-upload.model";
import { getResultWorkflow, assertPrintableReportAllowed, assertResultReportAllowed } from "./result-workflow.service";
import { mergePrintedReports } from "./report-pdf-merge";

const q=(value:unknown)=>{const chain={exec:async()=>value,select:()=>chain,sort:()=>chain,lean:()=>chain};return chain;};
test("current outside PDF enables normal print, not clinical submission; stale and removed reports cannot enable it",async t=>{
  const billId=new Types.ObjectId(),patientId=new Types.ObjectId(),testId=new Types.ObjectId(),collectionId=new Types.ObjectId();
  const bill={_id:billId,patientId,status:"generated",dueAmount:0,items:[{testId,outsideLabId:new Types.ObjectId(),activeCollectionId:collectionId}]};
  let rows:any[]=[{_id:new Types.ObjectId(),testId,collectionId,size:100}];
  t.mock.method(LabBill,"findById",()=>q(bill) as any);
  t.mock.method(LabTestResult,"find",()=>q([]) as any);
  t.mock.method(LabReportUpload,"find",(filter:any)=>{
    assert.equal(filter.billId,billId);assert.equal(filter.patientId,patientId);assert.deepEqual(filter.testId.$in,[testId]);
    return q(rows) as any;
  });
  const workflow=await getResultWorkflow(String(billId));
  assert.equal(workflow.tests[0].submitted,false);
  assert.equal(workflow.tests[0].uploadedReportId,String(rows[0]._id));
  await assertPrintableReportAllowed(String(billId),[String(testId)]);
  await assert.rejects(assertResultReportAllowed(String(billId),[String(testId)]),/Submit/);
  bill.dueAmount=10;await assert.rejects(assertPrintableReportAllowed(String(billId),[String(testId)]),/outstanding due/);
  bill.dueAmount=0;rows=[{...rows[0],collectionId:new Types.ObjectId()}];
  await assert.rejects(assertPrintableReportAllowed(String(billId),[String(testId)]),/upload the outside/);
  rows=[];await assert.rejects(assertPrintableReportAllowed(String(billId),[String(testId)]),/upload the outside/);
  bill.items=[];await assert.rejects(assertPrintableReportAllowed(String(billId),[String(testId)]),/upload the outside/);
});

test("mixed print parts retain order and source page geometry",async()=>{
  const parts:Buffer[]=[];
  for(const [index,size]of [[595.28,841.89],[792,612],[612,792]].entries()){
    const pdf=await PDFDocument.create();const page=pdf.addPage(size as [number,number]);page.drawText(`Synthetic part ${index}`);
    if(index===2)page.setRotation(degrees(90));parts.push(Buffer.from(await pdf.save()));
  }
  const merged=await PDFDocument.load(await mergePrintedReports(parts));
  assert.equal(merged.getPageCount(),3);
  for(const [index,part] of parts.entries()){
    const original=(await PDFDocument.load(part)).getPage(0);
    assert.deepEqual(merged.getPage(index).getSize(),original.getSize());
    assert.deepEqual(merged.getPage(index).getRotation(),original.getRotation());
  }
});
