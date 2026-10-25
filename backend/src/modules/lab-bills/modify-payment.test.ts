import test from "node:test";
import assert from "node:assert/strict";
import mongoose,{Types} from "mongoose";
import {LabBill} from "../../models/lab-bill.model";
import {LabBillPayment} from "../../models/lab-bill-payment.model";
import {LabTest} from "../../models/lab-test.model";
import {Department} from "../../models/department.model";
import {LabSample} from "../../models/lab-sample.model";
import {AuditLog} from "../../models/audit-log.model";
import {modifyLabBill} from "./lab-bill.service";
import {modifyLabBillSchema} from "../../validations/lab-bill";
const query=(value:unknown)=>{const q:any={session:()=>q,exec:async()=>value,select:()=>q,lean:()=>q,populate:()=>q};return q;};
for(const amount of [100,40,101])test(`modification records new payment ${amount} atomically and replay is idempotent`,async t=>{
 const actor=new Types.ObjectId(),a=new Types.ObjectId(),b=new Types.ObjectId(),dept=new Types.ObjectId(),session={synthetic:true};
 const item=(testId:Types.ObjectId,price:number)=>({testId,testCode:'SYN',testName:'Synthetic',departmentId:dept,departmentName:'Synthetic',unitPrice:price,quantity:1,total:price});
 const bill=new LabBill({billNumber:'SYNTHETIC-PAYMENT',patientId:new Types.ObjectId(),items:[item(a,400)],totalAmount:400,discountPercent:0,discountAmount:0,netAmount:400,paidAmount:400,dueAmount:0,createdBy:actor,status:'generated',paymentMode:'cash'});
 t.mock.method(mongoose.connection,'transaction',async(callback:any)=>callback(session));t.mock.method(LabBill,'findById',()=>query(bill));t.mock.method(bill,'save',async(options:any)=>{assert.equal(options.session,session);return bill;});
 t.mock.method(LabSample,'find',()=>query([]));t.mock.method(LabTest,'find',()=>query([{_id:a,testName:'Synthetic A',testCode:'A',departmentId:dept,active:true,price:400},{_id:b,testName:'Synthetic B',testCode:'B',departmentId:dept,active:true,price:100}]));t.mock.method(Department,'find',()=>query([{_id:dept,name:'Synthetic'}]));
 const receipts:any[]=[],audits:any[]=[];t.mock.method(LabBillPayment,'create',async(rows:any,options:any)=>{assert.equal(options.session,session);receipts.push(...rows);return rows;});t.mock.method(AuditLog,'create',async(rows:any,options:any)=>{assert.equal(options.session,session);audits.push(...rows);return rows;});
 const input=modifyLabBillSchema.parse({items:[{testId:String(a),quantity:1},{testId:String(b),quantity:1}],discountPercent:0,paymentMode:'cash',payment:{requestId:'123e4567-e89b-42d3-a456-426614174000',amount}});
 bill.status='draft';await assert.rejects(modifyLabBill(String(actor),String(bill._id),input,{allowPaymentCollection:true}),/generated/);bill.status='generated';
 await assert.rejects(modifyLabBill(String(actor),String(bill._id),input),/billing.collect_due/);assert.equal(receipts.length,0);
 if(amount>100){await assert.rejects(modifyLabBill(String(actor),String(bill._id),input,{allowPaymentCollection:true}),/outstanding balance/);assert.equal(receipts.length,0);assert.equal(bill.paidAmount,400);return;}
 await modifyLabBill(String(actor),String(bill._id),input,{allowPaymentCollection:true});assert.equal(bill.totalAmount,500);assert.equal(bill.paidAmount,400+amount);assert.equal(bill.dueAmount,100-amount);assert.equal(receipts.length,1);assert.equal(receipts[0].amount,amount);assert.ok(audits.some(row=>row.action==='lab_bill.payment_collected'));
 await modifyLabBill(String(actor),String(bill._id),input,{allowPaymentCollection:true});assert.equal(receipts.length,1);assert.equal(bill.paidAmount,400+amount);
 await assert.rejects(modifyLabBill(String(actor),String(bill._id),{...input,payment:{...input.payment!,amount:amount+1}},{allowPaymentCollection:true}),/already used/);assert.equal(receipts.length,1);
});
test('payment amendment rejects invalid payment payloads without allowing paid-total rewriting',()=>{
 const base={items:[{testId:'507f1f77bcf86cd799439011',quantity:1}],discountPercent:0};
 for(const payment of [{requestId:'invalid',amount:10},{requestId:'123e4567-e89b-42d3-a456-426614174000',amount:-1},{requestId:'123e4567-e89b-42d3-a456-426614174000',amount:0}])assert.equal(modifyLabBillSchema.safeParse({...base,payment}).success,false);
 assert.equal(modifyLabBillSchema.safeParse({...base,paidAmount:500}).success,false);
});
