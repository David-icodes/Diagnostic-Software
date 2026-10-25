import { createHash } from "node:crypto";
import { z } from "zod";
import { VendorSubmission } from "../../models/vendor-submission.model";
import { LabTest } from "../../models/lab-test.model";
import { ApiError } from "../../utils/api-error";
import { vendorPatientSchema } from "../../validations/patient";
import { createLabBillSchema } from "../../validations/lab-bill";
import { createPatient } from "../patients/patient.service";
import { createLabBill,buildSnapshotItems } from "../lab-bills/lab-bill.service";
import { Doctor } from "../../models/doctor.model";
import { vendorClientId } from "../../utils/vendor-access";
import type { AuthUser } from "../../types/auth";
const orderSchema=createLabBillSchema.pick({items:true,referringDoctorId:true,comments:true}).superRefine((order,context)=>{if(order.items.some(item=>item.packageId||item.out!==undefined||item.outsideLabId!==undefined))context.addIssue({code:z.ZodIssueCode.custom,path:["items"],message:"Vendor requests select individually tariffed tests; laboratory staff control outside assignments"});});
export const vendorSubmissionSchema=z.object({requestKey:z.string().uuid(),patient:vendorPatientSchema,order:orderSchema}).strict();
export async function submitVendorPatient(user:AuthUser,input:z.infer<typeof vendorSubmissionSchema>){
 const clientId=vendorClientId(user);const fingerprint=createHash("sha256").update(JSON.stringify({patient:input.patient,order:input.order})).digest("hex");
 const existing=await VendorSubmission.findOne({clientId,requestKey:input.requestKey}).exec();
 if(existing){if(existing.fingerprint!==fingerprint)throw new ApiError(409,"Submission reference was already used for different details");if(existing.state!=="completed")throw new ApiError(409,"This submission requires staff review. Do not submit it again.");return {billId:String(existing.billId),patientId:String(existing.patientId),billNumber:existing.billNumber,reused:true};}
 // Validate the requested catalogue before creating any patient record.
 const ids=input.order.items.map(item=>item.testId);
 if(new Set(ids).size!==ids.length)throw new ApiError(422,"Select each test only once");
 if(await LabTest.countDocuments({_id:{$in:ids},active:{$ne:false}})!==ids.length)throw new ApiError(422,"One or more selected tests are unavailable");
 await buildSnapshotItems(input.order.items,"osp",[],clientId);
 if(input.order.referringDoctorId&&!await Doctor.exists({_id:input.order.referringDoctorId,active:{$ne:false}}))throw new ApiError(422,"Select an active referring doctor");
 let checkpoint;
 try{checkpoint=await VendorSubmission.create({clientId,submittedBy:user.id,requestKey:input.requestKey,fingerprint});}catch(error){if((error as {code?:number}).code===11000)throw new ApiError(409,"Submission already in progress. Refresh Vendor Data before retrying.");throw error;}
 try{
  const patient=await createPatient(user.id,{...input.patient,lastName:input.patient.lastName??""});checkpoint.patientId=patient._id;await checkpoint.save();
  const bill=await createLabBill(user.id,{...input.order,patientId:String(patient._id),clientId,billType:"vendor",patientType:"osp",paidAmount:0,status:"generated"});
  checkpoint.billId=(bill as unknown as {_id:import("mongoose").Types.ObjectId})._id;checkpoint.billNumber=bill.billNumber;checkpoint.state="completed";await checkpoint.save();
  return {billId:String(checkpoint.billId),patientId:String(patient._id),billNumber:bill.billNumber,reused:false};
 }catch(error){checkpoint.state="review_required";await checkpoint.save().catch(()=>{});throw error;}
}
