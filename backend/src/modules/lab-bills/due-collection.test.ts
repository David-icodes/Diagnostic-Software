import test from 'node:test';import assert from 'node:assert/strict';import mongoose,{Types} from 'mongoose';
import {LabBill} from '../../models/lab-bill.model';import {LabBillPayment} from '../../models/lab-bill-payment.model';import {AuditLog} from '../../models/audit-log.model';import {collectLabDue} from './lab-bill.service';import {collectLabDueSchema} from '../../validations/lab-bill';import {dueCollectionPlan} from './due-collection-plan';
test('collection records one atomic receipt, exact replay cannot double-charge, changed retries and stale balances fail',async t=>{
 const actor=new Types.ObjectId(),id=new Types.ObjectId(),session={synthetic:true};const bill=new LabBill({_id:id,patientId:new Types.ObjectId(),billNumber:'SYN',patientType:'osp',status:'generated',createdBy:actor,items:[],totalAmount:100,discountAmount:0,netAmount:100,paidAmount:0,dueAmount:100});let payments:any[]=[],audits:any[]=[],fail=false;
 t.mock.method(mongoose.connection,'transaction',async(work:any)=>{const before=bill.toObject(),p=payments.length,a=audits.length;try{return await work(session);}catch(e){Object.assign(bill,before);payments=payments.slice(0,p);audits=audits.slice(0,a);throw e;}});
 const query=()=>{const q:any={session:()=>q,populate:()=>q,exec:async()=>bill};return q;};t.mock.method(LabBill,'findById',query);t.mock.method(bill,'save',async(options:any)=>{assert.equal(options.session,session);return bill;});
 t.mock.method(LabBillPayment,'create',async(rows:any,options:any)=>{assert.equal(options.session,session);if(fail)throw Error('Synthetic failure');payments.push(...rows);return rows;});t.mock.method(AuditLog,'create',async(rows:any,options:any)=>{assert.equal(options.session,session);audits.push(...rows);return rows;});
 const input=collectLabDueSchema.parse({requestId:'123e4567-e89b-42d3-a456-426614174000',amount:40,discountAmount:10,paymentMode:'cash',expectedDueAmount:100});
 await collectLabDue(String(actor),String(id),input);assert.equal(bill.dueAmount,50);assert.equal(payments.length,1);assert.equal(bill.dueCollections?.[0].remainingBalance,50);assert.equal(payments[0].remainingBalance,50);
 await collectLabDue(String(actor),String(id),input);assert.equal(payments.length,1);assert.equal(bill.paidAmount,40);assert.equal(audits.length,1);
 await assert.rejects(collectLabDue(String(actor),String(id),{...input,amount:41}),/already used/);
 const next={...input,requestId:'223e4567-e89b-42d3-a456-426614174000'};await assert.rejects(collectLabDue(String(actor),String(id),next),/balance changed/);
 fail=true;await assert.rejects(collectLabDue(String(actor),String(id),{...next,amount:20,discountAmount:0,expectedDueAmount:50}),/Synthetic failure/);assert.equal(bill.paidAmount,40);assert.equal(payments.length,1);
});
test('invalid balances, amounts and request IDs fail without a collection plan',()=>{
 const bill={status:'generated',totalAmount:100,netAmount:100,paidAmount:0,dueAmount:100,discountAmount:0};
 for(const amount of [-1,0,NaN,101])assert.throws(()=>dueCollectionPlan(bill,{amount,paymentMode:'cash'}));
 assert.throws(()=>dueCollectionPlan({...bill,status:'cancelled'},{amount:10,paymentMode:'cash'}));
 assert.equal(collectLabDueSchema.safeParse({requestId:'bad',amount:10,paymentMode:'cash'}).success,false);
});
