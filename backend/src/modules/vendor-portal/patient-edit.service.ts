import { z } from "zod";
import mongoose from "mongoose";
import { Patient } from "../../models/patient.model";
import { LabBill } from "../../models/lab-bill.model";
import { VendorSubmission } from "../../models/vendor-submission.model";
import { AuditLog } from "../../models/audit-log.model";
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
