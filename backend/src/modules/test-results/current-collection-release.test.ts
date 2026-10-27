import test from 'node:test';import assert from 'node:assert/strict';import {Types} from 'mongoose';
import {getResultWorkflow,assertPrintableReportAllowed} from './result-workflow.service';import {LabBill} from '../../models/lab-bill.model';import {LabTestResult} from '../../models/lab-test-result.model';import {AuditLog} from '../../models/audit-log.model';import {currentCollectionResult} from '../../utils/current-collection-result';
const chain=(value:unknown)=>{const q:any={select:()=>q,sort:()=>q,exec:async()=>value};return q;};
test('recollection can be selected without making superseded, foreign-collection or pending results printable',async t=>{
 const billId=new Types.ObjectId(),patientId=new Types.ObjectId(),testId=new Types.ObjectId(),current=new Types.ObjectId(),old=new Types.ObjectId(),resultId=new Types.ObjectId();
 const bill={_id:billId,patientId,status:'generated',netAmount:100,paidAmount:100,dueAmount:0,items:[{testId,activeCollectionId:current}]};
 let rows:any[]=[{_id:resultId,billId,patientId,testId,collectionId:old,superseded:true,result:7,version:1,enteredAt:new Date()}],events:any[]=[];
 t.mock.method(LabBill,'findById',()=>chain(bill));t.mock.method(LabTestResult,'find',()=>chain(rows));t.mock.method(AuditLog,'find',()=>chain(events));
 assert.equal((await getResultWorkflow(String(billId))).tests[0].submitted,false);await assert.rejects(assertPrintableReportAllowed(String(billId),[String(testId)]),/Submit/);
 rows[0].superseded=false;assert.equal((await getResultWorkflow(String(billId))).tests[0].submitted,false);
 rows[0].collectionId=current;events=[{entity:resultId,action:'test_result.submission_pending'}];assert.equal((await getResultWorkflow(String(billId))).tests[0].submitted,false);
 events=[{entity:resultId,action:'test_result.submission_confirmed'}];assert.equal((await getResultWorkflow(String(billId))).tests[0].submitted,true);
 assert.equal(currentCollectionResult({},undefined),true);assert.equal(currentCollectionResult({},current),false);assert.equal(currentCollectionResult({superseded:true},undefined),false);
});
