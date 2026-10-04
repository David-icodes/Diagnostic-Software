import { Types, type FilterQuery } from "mongoose";
import { ApiError } from "../../utils/api-error";
import { Doctor, type DoctorDoc, type IDoctor } from "../../models/doctor.model";
import { DoctorCommission } from "../../models/doctor-commission.model";
import { LabBill } from "../../models/lab-bill.model";

export type CreateDoctorInput = Omit<IDoctor, "createdAt" | "updatedAt">;
export type UpdateDoctorInput = Partial<Omit<IDoctor, "createdAt" | "updatedAt">>;

export interface ListDoctorsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof Error && (error as { code?: number }).code === 11000;
}

function composeName(input: CreateDoctorInput | UpdateDoctorInput): string | undefined {
  const explicit = input.name?.trim();
  if (explicit) return explicit;
  const parts = [input.firstName?.trim(), input.middleName?.trim(), input.lastName?.trim()].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(" ") : undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function searchDoctors({ search, limit = 50 }: { search?: string; limit?: number }): Promise<DoctorDoc[]> {
  const filter: FilterQuery<IDoctor> = {};
  const keyword = search?.trim();
  if (keyword) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { specialization: { $regex: escaped, $options: "i" } },
      { designation: { $regex: escaped, $options: "i" } },
      { mobile: { $regex: escaped, $options: "i" } },
    ];
  }
  return Doctor.find(filter).sort({ name: 1 }).limit(limit).exec();
}

export async function listDoctors({
  page = 1,
  limit = 20,
  search,
  status,
}: ListDoctorsParams = {}): Promise<PaginatedResult<DoctorDoc>> {
  const filter: FilterQuery<IDoctor> = {};
  if (status === "active" || status === "inactive") {
    filter.active = status === "active";
  }
  const keyword = search?.trim();
  if (keyword) {
    const escaped = escapeRegExp(keyword);
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { firstName: { $regex: escaped, $options: "i" } },
      { specialization: { $regex: escaped, $options: "i" } },
      { designation: { $regex: escaped, $options: "i" } },
      { mobile: { $regex: escaped, $options: "i" } },
    ];
  }

  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const skip = (safePage - 1) * safeLimit;

  const [total, data] = await Promise.all([
    Doctor.countDocuments(filter),
    Doctor.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .exec(),
  ]);

  return {
    data,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
}

export async function getDoctor(id: string): Promise<DoctorDoc> {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid doctor ID");
  }
  const doctor = await Doctor.findById(id).exec();
  if (!doctor) {
    throw new ApiError(404, "Doctor not found");
  }
  return doctor;
}

export async function createDoctor(userId: string, input: CreateDoctorInput): Promise<DoctorDoc> {
  const name = composeName(input);
  if (!name) {
    throw new ApiError(400, "Doctor name is required");
  }
  try {
    return await Doctor.create({
      ...input,
      name,
      active: input.active ?? true,
      createdBy: userId,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(409, "A doctor with this name already exists");
    }
    throw error;
  }
}

export async function updateDoctor(id: string, userId: string, input: UpdateDoctorInput): Promise<DoctorDoc> {
  const doctor = await getDoctor(id);
  const name = composeName({
    name: input.name,
    firstName: input.firstName ?? doctor.firstName,
    middleName: input.middleName ?? doctor.middleName,
    lastName: input.lastName ?? doctor.lastName,
  });
  try {
    Object.assign(doctor, input, {
      ...(name ? { name } : {}),
      updatedBy: new Types.ObjectId(userId),
    });
    await doctor.save();
    return doctor;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(409, "A doctor with this name already exists");
    }
    throw error;
  }
}

export async function isDoctorReferenced(id: string): Promise<boolean> {
  const [commissionCount, billCount] = await Promise.all([
    DoctorCommission.countDocuments({ doctorId: id }).exec(),
    LabBill.countDocuments({ referringDoctorId: id }).exec(),
  ]);
  return commissionCount + billCount > 0;
}

export async function setDoctorActive(
  id: string,
  userId: string,
  active: boolean,
): Promise<DoctorDoc> {
  const doctor = await getDoctor(id);
  if (!active && (await isDoctorReferenced(id))) {
    throw new ApiError(
      409,
      "Cannot deactivate: this doctor is referenced by bills or commission records",
    );
  }
  doctor.active = active;
  Object.assign(doctor, { updatedBy: new Types.ObjectId(userId) });
  await doctor.save();
  return doctor;
}