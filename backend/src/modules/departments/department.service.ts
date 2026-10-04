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
    filter.active = status === "active";
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
  const department = await getDepartment(id);

  try {
    Object.assign(department, input, { updatedBy: new Types.ObjectId(userId) });
    await department.save();
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
  const department = await getDepartment(id);
  if (!active && (await isDepartmentReferenced(id))) {
    throw new ApiError(
      409,
      "Cannot deactivate: this department has lab tests assigned to it",
    );
  }
  department.active = active;
  Object.assign(department, { updatedBy: new Types.ObjectId(userId) });
  await department.save();
  return department;
}