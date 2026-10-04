import { Types, type FilterQuery } from "mongoose";
import { ApiError } from "../../utils/api-error";
import {
  DoctorDesignation,
  type DoctorDesignationDoc,
  type IDoctorDesignation,
} from "../../models/doctor-designation.model";
import { Doctor } from "../../models/doctor.model";

export type CreateDoctorDesignationInput = Omit<
  IDoctorDesignation,
  "createdBy" | "createdAt" | "updatedAt"
>;

export type UpdateDoctorDesignationInput = Partial<
  Omit<IDoctorDesignation, "createdBy" | "createdAt" | "updatedAt">
>;

export interface ListDoctorDesignationsParams {
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

export async function listDoctorDesignations({
  page = 1,
  limit = 20,
  search,
  status,
}: ListDoctorDesignationsParams = {}): Promise<PaginatedResult<DoctorDesignationDoc>> {
  const filter: FilterQuery<IDoctorDesignation> = {};

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
    DoctorDesignation.countDocuments(filter),
    DoctorDesignation.find(filter)
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

export async function getDoctorDesignation(id: string): Promise<DoctorDesignationDoc> {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid designation ID");
  }
  const record = await DoctorDesignation.findById(id).exec();
  if (!record) {
    throw new ApiError(404, "Doctor designation not found");
  }
  return record;
}

export async function createDoctorDesignation(
  userId: string,
  input: CreateDoctorDesignationInput,
): Promise<DoctorDesignationDoc> {
  try {
    return await DoctorDesignation.create({
      ...input,
      active: input.active ?? true,
      createdBy: userId,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(409, "This doctor designation already exists");
    }
    throw error;
  }
}

export async function updateDoctorDesignation(
  id: string,
  userId: string,
  input: UpdateDoctorDesignationInput,
): Promise<DoctorDesignationDoc> {
  const record = await getDoctorDesignation(id);
  try {
    Object.assign(record, input, { updatedBy: new Types.ObjectId(userId) });
    await record.save();
    return record;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(409, "This doctor designation already exists");
    }
    throw error;
  }
}

export async function isDoctorDesignationReferenced(id: string): Promise<boolean> {
  const count = await Doctor.countDocuments({ designationId: id }).exec();
  return count > 0;
}

export async function setDoctorDesignationActive(
  id: string,
  userId: string,
  active: boolean,
): Promise<DoctorDesignationDoc> {
  const record = await getDoctorDesignation(id);
  if (!active && (await isDoctorDesignationReferenced(id))) {
    throw new ApiError(
      409,
      "Cannot deactivate: this designation is assigned to one or more doctors",
    );
  }
  record.active = active;
  Object.assign(record, { updatedBy: new Types.ObjectId(userId) });
  await record.save();
  return record;
}