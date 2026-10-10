import { Types, type FilterQuery } from "mongoose";
import { ApiError } from "../../utils/api-error";
import {
  DoctorSpecialisation,
  type DoctorSpecialisationDoc,
  type IDoctorSpecialisation,
} from "../../models/doctor-specialisation.model";
import { Doctor } from "../../models/doctor.model";

export type CreateDoctorSpecialisationInput = Omit<
  IDoctorSpecialisation,
  "createdBy" | "createdAt" | "updatedAt"
>;

export type UpdateDoctorSpecialisationInput = Partial<
  Omit<IDoctorSpecialisation, "createdBy" | "createdAt" | "updatedAt">
>;

export interface ListDoctorSpecialisationsParams {
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof Error && (error as { code?: number }).code === 11000;
}

export async function listDoctorSpecialisations({
  page = 1,
  limit = 20,
  search,
  status,
}: ListDoctorSpecialisationsParams = {}): Promise<PaginatedResult<DoctorSpecialisationDoc>> {
  const filter: FilterQuery<IDoctorSpecialisation> = {};

  if (status === "active" || status === "inactive") {
    filter.active = status === "active";
  }

  const keyword = search?.trim();
  if (keyword) {
    filter.name = { $regex: escapeRegExp(keyword), $options: "i" };
  }

  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(200, Math.max(1, Math.floor(limit)));
  const skip = (safePage - 1) * safeLimit;

  const [total, data] = await Promise.all([
    DoctorSpecialisation.countDocuments(filter),
    DoctorSpecialisation.find(filter)
      .sort({ name: 1 })
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

export async function getDoctorSpecialisation(id: string): Promise<DoctorSpecialisationDoc> {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid specialisation ID");
  }
  const record = await DoctorSpecialisation.findById(id).exec();
  if (!record) {
    throw new ApiError(404, "Doctor specialisation not found");
  }
  return record;
}

export async function createDoctorSpecialisation(
  userId: string,
  input: CreateDoctorSpecialisationInput,
): Promise<DoctorSpecialisationDoc> {
  try {
    return await DoctorSpecialisation.create({
      ...input,
      active: input.active ?? true,
      createdBy: userId,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(409, "This doctor specialisation already exists");
    }
    throw error;
  }
}

export async function updateDoctorSpecialisation(
  id: string,
  userId: string,
  input: UpdateDoctorSpecialisationInput,
): Promise<DoctorSpecialisationDoc> {
  const record = await getDoctorSpecialisation(id);
  try {
    Object.assign(record, input, { updatedBy: new Types.ObjectId(userId) });
    await record.save();
    return record;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(409, "This doctor specialisation already exists");
    }
    throw error;
  }
}

export async function isDoctorSpecialisationReferenced(id: string): Promise<boolean> {
  const count = await Doctor.countDocuments({ specialisationId: id }).exec();
  return count > 0;
}

export async function setDoctorSpecialisationActive(
  id: string,
  userId: string,
  active: boolean,
): Promise<DoctorSpecialisationDoc> {
  const record = await getDoctorSpecialisation(id);
  if (!active && (await isDoctorSpecialisationReferenced(id))) {
    throw new ApiError(
      409,
      "Cannot deactivate: this specialisation is assigned to one or more doctors",
    );
  }
  record.active = active;
  Object.assign(record, { updatedBy: new Types.ObjectId(userId) });
  await record.save();
  return record;
}