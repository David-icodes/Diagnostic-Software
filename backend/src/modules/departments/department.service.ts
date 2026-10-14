import { LabClientTariff } from "../../models/lab-client-tariff.model";
import { DoctorCommission } from "../../models/doctor-commission.model";
import { Doctor } from "../../models/doctor.model";
import { LabPackage } from "../../models/lab-package.model";
import { LabSample } from "../../models/lab-sample.model";
import { LabBill } from "../../models/lab-bill.model";
import { Types, type FilterQuery } from "mongoose";
import { ApiError } from "../../utils/api-error";
import {
  Department,
  type DepartmentDoc,
  type IDepartment,
} from "../../models/department.model";
import { LabTest } from "../../models/lab-test.model";

export type CreateDepartmentInput = Omit<
  IDepartment,
  "createdBy" | "createdAt" | "updatedAt"
>;

export type UpdateDepartmentInput = Partial<
  Omit<IDepartment, "createdBy" | "createdAt" | "updatedAt">
>;

// Extends the public department payload with the number of active tests.
export interface DepartmentListItem {
  id: string;
  name: string;
  code: string;
  description?: string;
  type?: string;
  active: boolean;
  sortOrder: number;
  testCount: number;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    error instanceof Error && (error as { code?: number }).code === 11000
  );
}

export async function listDepartments({
  status,
  search,
}: { status?: string; search?: string } = {}): Promise<DepartmentListItem[]> {
  const filter: FilterQuery<IDepartment> = {};
  if (status === "active" || status === "inactive") {
    // Missing legacy status has the same active default as the model and form.
    filter.active = status === "active" ? { $ne: false } : false;
  }
  const keyword = search?.trim();
  if (keyword) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [{ name: { $regex: escaped, $options: "i" } }, { code: { $regex: escaped, $options: "i" } }];
  }

  const [departments, counts] = await Promise.all([
    Department.find(filter).sort({ sortOrder: 1, name: 1 }).exec(),
    LabTest.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { active: true } },
      { $group: { _id: "$departmentId", count: { $sum: 1 } } },
    ]),
  ]);

  const countMap = new Map(counts.map((entry) => [String(entry._id), entry.count]));

  return departments.map((department) => {
    const json = department.toJSON() as unknown as DepartmentListItem;
    json.testCount = countMap.get(String(json.id)) ?? 0;
    return json;
  });
}

export async function getDepartment(id: string): Promise<DepartmentDoc> {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid department ID");
  }
  const department = await Department.findById(id).exec();
  if (!department) {
    throw new ApiError(404, "Department not found");
  }
  return department;
}

export async function createDepartment(
  userId: string,
  input: CreateDepartmentInput,
): Promise<DepartmentDoc> {
  try {
    return await Department.create({ ...input, createdBy: userId });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(409, "A department with this name or code already exists");
    }
    throw error;
  }
}

export async function updateDepartment(
  userId: string,
  id: string,
  input: UpdateDepartmentInput,
): Promise<DepartmentDoc> {
  await getDepartment(id);
  try {
    // Validate edited fields without requiring unrelated missing legacy fields
    // or fabricating a historical creator. Creation remains fully validated.
    const department = await Department.findByIdAndUpdate(id,
      { $set: { ...input, updatedBy: new Types.ObjectId(userId) } },
      { new: true, runValidators: true }).exec();
    if (!department) throw new ApiError(404, "Department not found");
    return department;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(409, "A department with this name or code already exists");
    }
    throw error;
  }
}

export async function isDepartmentReferenced(id: string): Promise<boolean> {
  const testCount = await LabTest.countDocuments({ departmentId: id }).exec();
  return testCount > 0;
}

export async function setDepartmentActive(
  userId: string,
  id: string,
  active: boolean,
): Promise<DepartmentDoc> {
  return updateDepartment(userId, id, { active });
}
/** All references, including inactive masters and historical documents, block deletion. */
export async function deleteDepartment(id: string): Promise<void> {
  const department = await getDepartment(id);
  const checks = [
    ["tests", LabTest], ["bills", LabBill], ["samples", LabSample], ["packages", LabPackage],
    ["doctors", Doctor], ["commissions", DoctorCommission], ["client tariffs", LabClientTariff],
  ] as const;
  const dependencies = await Promise.all(checks.map(async ([label, model]) => {
    const filter = label === "bills" || label === "packages" ? { "items.departmentId": id } : { departmentId: id };
    const exists = await (model as typeof LabTest).exists(filter);
    return exists ? label : undefined;
  }));
  if (dependencies.some(Boolean)) {
    throw new ApiError(409, `Cannot delete: referenced by ${dependencies.filter(Boolean).join(", ")}. Deactivate this department instead to preserve existing records.`);
  }
  await department.deleteOne();
}
