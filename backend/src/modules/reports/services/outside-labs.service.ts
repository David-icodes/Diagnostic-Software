import { Types } from "mongoose";
import { z } from "zod";
import { ApiError } from "../../../utils/api-error";
import { LabBill } from "../../../models/lab-bill.model";
import { LabSample } from "../../../models/lab-sample.model";
import { OutsideLab } from "../../../models/outside-lab.model";

export interface OutsideLabOption {
  id: string;
  code: string;
  name: string;
  city?: string;
  address?: string;
  phone?: string;
}

export async function listOutsideLabs(): Promise<OutsideLabOption[]> {
  const labs = await OutsideLab.find({ active: true })
    .sort({ name: 1 })
    .select("code name city address phone")
    .exec();
  return labs.map((lab) => ({
    id: lab.id,
    code: lab.code,
    name: lab.name,
    city: lab.city,
    address: lab.address,
    phone: lab.phone,
  }));
}
export const outsideLabInputSchema = z.object({
  code: z.string().trim().min(2).max(30).transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(30).optional(),
}).strict();
export type OutsideLabInput = z.infer<typeof outsideLabInputSchema>;

export async function saveOutsideLab(userId: string, input: OutsideLabInput, id?: string) {
  if (id && !Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid outside lab ID");
  try {
    if (!id) return await OutsideLab.create({ ...input, createdBy: userId });
    const lab = await OutsideLab.findById(id).exec();
    if (!lab) throw new ApiError(404, "Outside lab not found");
    Object.assign(lab, input, { updatedBy: new Types.ObjectId(userId) });
    return await lab.save();
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new ApiError(409, "An outside lab with this name or code already exists");
    throw error;
  }
}
export async function deleteOutsideLab(id: string): Promise<void> {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid outside lab ID");
  const lab = await OutsideLab.findById(id).exec();
  if (!lab) throw new ApiError(404, "Outside lab not found");
  const references = await Promise.all([
    LabBill.exists({ "items.outsideLabId": id }), LabSample.exists({ outsideLabId: id }),
  ]);
  if (references.some(Boolean)) throw new ApiError(409, "Cannot delete: this outside lab is referenced by existing bills or samples. Historical assignments must be preserved.");
  await lab.deleteOne();
}
