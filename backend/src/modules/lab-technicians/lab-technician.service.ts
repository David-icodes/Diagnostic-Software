import { ApiError } from "../../utils/api-error";
import { LabTechnician } from "../../models/lab-technician.model";

export async function listActiveTechnicians() {
  return LabTechnician.find({ active: true })
    .sort({ name: 1 })
    .select("name designation qualification signatureNote")
    .exec();
}

export async function getTechnician(id: string) {
  const technician = await LabTechnician.findById(id)
    .select("name designation qualification signatureNote")
    .exec();
  if (!technician) {
    throw new ApiError(404, "Lab technician not found");
  }
  return technician;
}