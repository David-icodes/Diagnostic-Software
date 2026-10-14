import mongoose from "mongoose";
import { LabSample } from "../../models/lab-sample.model";
import test from "node:test";
import assert from "node:assert/strict";
import {Types} from "mongoose";
import {LabBill} from "../../models/lab-bill.model";
import {LabTestResult} from "../../models/lab-test-result.model";
import {LabTestParameter} from "../../models/lab-test-parameter.model";
import {Patient} from "../../models/patient.model";
import {AuditLog} from "../../models/audit-log.model";
import {submitTestResults} from "./test-result.service";
test("submission rejects a one-time edit outside the isolated synthetic context before any result or audit write",async t=>{
 t.mock.method(mongoose.connection,"transaction",async(callback:any)=>callback(undefined));
 t.mock.method(LabSample,"findOne",()=>({exec:async()=>null}) as any);
 t.mock.method(LabBill,"updateOne",()=>({exec:async()=>({matchedCount:1})}) as any);

 const billId=new Types.ObjectId(),patientId=new Types.ObjectId(),testId=new Types.ObjectId(),hb=new Types.ObjectId(),rbc=new Types.ObjectId(),mch=new Types.ObjectId();
 const bill={_id:billId,patientId,billNumber:"DEV-EDITOR-1234abcd",status:"generated",items:[{testId}]};
 const parameters=[{_id:hb,testId,active:true,resultType:"NUMBER",parameterName:"Hemoglobin (Hb)",unit:"g/dL"},{_id:rbc,testId,active:true,resultType:"NUMBER",parameterName:"RBC Count",unit:"million/ul"},{_id:mch,testId,active:true,resultType:"NUMBER",parameterName:"MCH",unit:"pg"}];
 const query=<T>(value:T)=>{const result={exec:async()=>value,sort:()=>result,select:()=>result,lean:()=>result};return result;};
 t.mock.method(LabBill,"findById",()=>query(bill) as unknown as ReturnType<typeof LabBill.findById>);
 t.mock.method(LabTestParameter,"find",()=>query(parameters) as unknown as ReturnType<typeof LabTestParameter.find>);
 t.mock.method(LabTestResult,"find",()=>query([]) as unknown as ReturnType<typeof LabTestResult.find>);
 t.mock.method(Patient,"findById",()=>query({patientId:"DEV-EDITOR-1234abcd"}) as unknown as ReturnType<typeof Patient.findById>);
 t.mock.method(LabTestResult,"create",()=>{throw new Error("unexpected result write");});
 t.mock.method(AuditLog,"create",()=>{throw new Error("unexpected audit write");});
 const original=process.env.NODE_ENV;process.env.NODE_ENV="production";
 try{await assert.rejects(submitTestResults(String(new Types.ObjectId()),{billId:String(billId),testId:String(testId),acceptedCalculationIds:[String(mch)],calculationProposals:[{parameterId:String(mch),formulaId:"mch",dependencyIds:[String(hb),String(rbc)],expression:"S1 * 12 / S2"}],entries:[{parameterId:String(hb),result:15},{parameterId:String(rbc),result:5},{parameterId:String(mch),result:36}]}),/restricted to the isolated development database/);}finally{if(original===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=original;}
});
