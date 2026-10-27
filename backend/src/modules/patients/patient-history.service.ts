import {SampleCollection} from "../../models/sample-collection.model";
import {Types} from 'mongoose';
import {ApiError} from '../../utils/api-error';
import {roleHasPermission} from '../../middleware/require-permission';
import type {AuthUser} from '../../types/auth';
import {Patient} from '../../models/patient.model';
import {LabBill} from '../../models/lab-bill.model';
import {LabBillPayment} from '../../models/lab-bill-payment.model';
import {LabTestResult} from '../../models/lab-test-result.model';
import {LabSample} from '../../models/lab-sample.model';

/** Read-only, registration-ID scoped and paginated. Vendors never enter general history. */
export async function patientHistory(actor:AuthUser|undefined,id:string,page=1){
 if(!actor)throw new ApiError(401,'Authentication required');
 if(actor.role==='vendor'||!roleHasPermission(actor.role,'billing.view'))throw new ApiError(403,'Patient history is not permitted');
 if(!Types.ObjectId.isValid(id))throw new ApiError(400,'Invalid patient ID');
 const patient=await Patient.findById(id).select('_id patientId').lean().exec();
 if(!patient)throw new ApiError(404,'Patient not found');
 if(!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger((page-1)*20))throw new ApiError(400,"Invalid history page");
 const current=page,limit=20,filter={patientId:patient._id};
 const [bills,total]=await Promise.all([
  LabBill.find(filter).sort({createdAt:-1,_id:-1}).skip((current-1)*limit).limit(limit).select('billNumber status billType visitId createdAt items totalAmount discountAmount netAmount paidAmount dueAmount paymentMode').lean().exec(),
  LabBill.countDocuments(filter).exec(),
 ]);
 const ids=bills.map(row=>row._id),clinical=roleHasPermission(actor.role,'test_results.view');
 const [payments,results,samples,collections]=ids.length?await Promise.all([
  LabBillPayment.find({billId:{$in:ids}}).select('billId amount discountAmount paymentMode collectedAt remainingBalance').sort({collectedAt:1}).lean().exec(),
  clinical?LabTestResult.find({patientId:patient._id,billId:{$in:ids}}).select('billId testId parameterName result resultDisplay unit referenceRange referenceSnapshot enteredAt version superseded collectionId').sort({enteredAt:-1}).lean().exec():[],
  LabSample.find({patientId:patient._id,billId:{$in:ids}}).select('billId testId sampleId sampleStatus comments lastStatusChangeAt').lean().exec(),
  clinical?SampleCollection.find({patientId:patient._id,billId:{$in:ids}}).select("billId testId reason resultSnapshots createdAt supersededAt").sort({createdAt:1}).lean().exec():[],
 ]):[[],[],[],[]];
 return {clinicalVisible:clinical,pagination:{page:current,total,totalPages:Math.ceil(total/limit)},bills:bills.map(bill=>({
  ...bill,id:String(bill._id),collections:collections.filter(row=>String(row.billId)===String(bill._id)).map(row=>({...row,resultSnapshots:row.resultSnapshots.map((result:any)=>({parameterName:result.parameterName,result:result.result,unit:result.unit}))})),payments:payments.filter(row=>String(row.billId)===String(bill._id)),
  results:results.filter(row=>String(row.billId)===String(bill._id)),samples:samples.filter(row=>String(row.billId)===String(bill._id)),
 }))};
}
