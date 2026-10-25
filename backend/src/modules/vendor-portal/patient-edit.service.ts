import { z } from "zod";
import mongoose from "mongoose";
import { Patient } from "../../models/patient.model";
import { LabBill } from "../../models/lab-bill.model";
import { VendorSubmission } from "../../models/vendor-submission.model";
import { AuditLog } from "../../models/audit-log.model";
import {LabReportUpload} from "../../models/lab-report-upload.model";
import {LabTestResult} from "../../models/lab-test-result.model";
import {hasRecordedPatientAge} from "../../utils/patient-age";
import { updatePatientSchema } from "../../validations/patient";
import { vendorClientId } from "../../utils/vendor-access";
import { ApiError } from "../../utils/api-error";
import type { AuthUser } from "../../types/auth";

// Contact edits cannot change demographics used by clinical range resolution.
export const vendorContactSchema = updatePatientSchema.pick({ mobile: true, email: true, address: true })
  .extend({ expectedUpdatedAt: z.string().datetime() }).strict()
  .refine(value => ["mobile", "email", "address"].some(key => key in value), "Provide a contact field to update");

export async function editVendorContact(user: AuthUser, billId: string, input: z.infer<typeof vendorContactSchema>) {
  const clientId = vendorClientId(user);
  return mongoose.connection.transaction(async session => {
    const bill = await LabBill.findOne({ _id: billId, clientId, billType: "vendor", status: "generated" }).session(session).exec();
    if (!bill || !await VendorSubmission.exists({ billId: bill._id, patientId: bill.patientId, clientId, state: "completed" }).session(session)) {
      throw new ApiError(404, "Editable vendor submission not found");
    }
    // A shared patient cannot be edited through one vendor's order.
    if (await LabBill.exists({ patientId: bill.patientId, $or: [{ clientId: { $ne: bill.clientId } }, { billType: { $ne: "vendor" } }] }).session(session)) {
      throw new ApiError(409, "Contact changes for this patient require administrator review");
    }
    const { expectedUpdatedAt, ...fields } = input;
    const patient = await Patient.findOneAndUpdate({ _id: bill.patientId, updatedAt: new Date(expectedUpdatedAt) },
      { $set: { ...fields, updatedBy: user.id } }, { new: true, runValidators: true, session }).exec();
    if (!patient) throw new ApiError(409, "Patient details changed. Reload before editing");
    await AuditLog.create([{ user: user.id, action: "vendor.patient_contact_updated", entityType: "Patient", entity: patient._id,
      timestamp: new Date(), details: { billId: String(bill._id), fields: Object.keys(fields) } }], { session });
    return { mobile: patient.mobile, email: patient.email, address: patient.address, updatedAt: patient.updatedAt };
  });
}

export const vendorPatientEditSchema=updatePatientSchema.pick({title:true,firstName:true,lastName:true,gender:true,age:true,dateOfBirth:true,mobile:true,email:true,address:true}).extend({expectedUpdatedAt:z.string().datetime()}).strict();
export async function editVendorPatient(user:AuthUser,billId:string,input:z.infer<typeof vendorPatientEditSchema>){
 const clientId=vendorClientId(user);
 return mongoose.connection.transaction(async session=>{
  const bill=await LabBill.findOne({_id:billId,clientId,billType:"vendor",status:"generated"}).session(session).exec();
  if(!bill)throw new ApiError(404,"Bill not found");
  if(await LabBill.exists({patientId:bill.patientId,$or:[{clientId:{$ne:bill.clientId}},{billType:{$ne:"vendor"}}]}).session(session))throw new ApiError(409,"Shared patient changes require administrator review");
  const patient=await Patient.findById(bill.patientId).session(session).exec();
  if(!patient || patient.updatedAt?.getTime()!==new Date(input.expectedUpdatedAt).getTime())throw new ApiError(409,"Patient details changed. Reload before editing");
  const {expectedUpdatedAt,...fields}=input;
  const changed=Object.entries(fields).filter(([key,value])=>(value!==undefined || ["email","address","lastName"].includes(key)) && String(patient.get(key)??"")!==String(value??""));
  const demographic=changed.some(([key])=>["firstName","lastName","gender","age","dateOfBirth"].includes(key));
  if(demographic && (await LabTestResult.exists({patientId:bill.patientId}).session(session) || await LabReportUpload.exists({patientId:bill.patientId,size:{$gt:0}}).session(session)))throw new ApiError(409,"Demographic changes after results or uploaded reports exist require administrator review. Contact details can still be edited separately.");
  const before=Object.fromEntries(changed.map(([key])=>[key,patient.get(key)]));
  Object.assign(patient,Object.fromEntries(changed),{updatedBy:user.id});
  // Validate age without replacing stored clinical history or reference snapshots.
  if((fields.age!==undefined || fields.dateOfBirth!==undefined) && !hasRecordedPatientAge(patient))throw new ApiError(422,"A valid age or date of birth is required");
  void expectedUpdatedAt;
  await patient.save({session});
  await AuditLog.create([{user:user.id,action:"vendor.patient_updated",entityType:"Patient",entity:patient._id,timestamp:new Date(),details:{billId:String(bill._id),before,after:Object.fromEntries(changed.map(([key,value])=>[key,value??null]))}}],{session});
  return {updatedAt:patient.updatedAt};
 });
}
