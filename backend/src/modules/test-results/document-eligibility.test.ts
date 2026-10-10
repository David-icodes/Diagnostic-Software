import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { LabBill } from "../../models/lab-bill.model";
import { verifiedOutstandingDue, assertBillDocumentAllowed } from "./result-workflow.service";
test("document guard reconciles stored dues with net/paid and fails closed without financial writes",async t=>{
 const bill:any={_id:new Types.ObjectId(),patientId:new Types.ObjectId(),status:"generated",netAmount:100,paidAmount:75,dueAmount:0};
 t.mock.method(LabBill,"findById",()=>({exec:async()=>bill}));
 assert.equal(verifiedOutstandingDue(bill),25);await assert.rejects(assertBillDocumentAllowed(String(bill._id)),/outstanding due/);
 bill.paidAmount=100;bill.dueAmount=1;await assert.rejects(assertBillDocumentAllowed(String(bill._id)),/outstanding due/);
 bill.dueAmount=0;assert.equal((await assertBillDocumentAllowed(String(bill._id))).outstandingDue,0);
 bill.status="cancelled";await assert.rejects(assertBillDocumentAllowed(String(bill._id)),/non-cancelled/);
 for(const value of [NaN,Infinity,-1])assert.throws(()=>verifiedOutstandingDue({...bill,dueAmount:value}),/verified/);
 assert.throws(()=>verifiedOutstandingDue({...bill,paidAmount:NaN}),/verified/);assert.equal(bill.netAmount,100);assert.equal(bill.paidAmount,100);
});
