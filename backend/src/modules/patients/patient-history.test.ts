import {SampleCollection} from "../../models/sample-collection.model";
import test from 'node:test';import assert from 'node:assert/strict';import {Types} from 'mongoose';
import {patientHistory} from './patient-history.service';import {Patient} from '../../models/patient.model';import {LabBill} from '../../models/lab-bill.model';import {LabBillPayment} from '../../models/lab-bill-payment.model';import {LabTestResult} from '../../models/lab-test-result.model';import {LabSample} from '../../models/lab-sample.model';
const chain=(value:unknown)=>{const q:any={select:()=>q,sort:()=>q,skip:()=>q,limit:()=>q,lean:()=>q,exec:async()=>value};return q;};
test('history rejects anonymous/vendors and invalid identities before reads; authorized history scopes all children by registration and bill',async t=>{
 const id=new Types.ObjectId(),billId=new Types.ObjectId();let reads=0;
 t.mock.method(Patient,'findById',()=>{reads++;return chain({_id:id,patientId:'SYN'});});
 await assert.rejects(patientHistory(undefined,String(id)),/Authentication/);await assert.rejects(patientHistory({role:'vendor'} as any,String(id)),/not permitted/);await assert.rejects(patientHistory({role:'admin'} as any,'not-an-id'),/Invalid/);assert.equal(reads,0);
 t.mock.method(LabBill,'find',(filter:any)=>{assert.equal(String(filter.patientId),String(id));return chain([{_id:billId,billNumber:'SYN',items:[]}]);});t.mock.method(LabBill,'countDocuments',()=>chain(1));
 t.mock.method(LabBillPayment,'find',(filter:any)=>{assert.deepEqual(filter.billId.$in.map(String),[String(billId)]);return chain([{billId,amount:40}]);});
 for(const model of [LabTestResult,LabSample,SampleCollection])t.mock.method(model,'find',(filter:any)=>{assert.equal(String(filter.patientId),String(id));assert.deepEqual(filter.billId.$in.map(String),[String(billId)]);return chain([]);});
 for(const role of ['admin','staff','operator']){const history=await patientHistory({role} as any,String(id));assert.equal(history.bills.length,1);assert.equal(history.bills[0].payments[0].amount,40);assert.equal(history.pagination.total,1);}
});
