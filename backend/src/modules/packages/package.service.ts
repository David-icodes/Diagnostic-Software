import { Types, type FilterQuery } from "mongoose";
import { ApiError } from "../../utils/api-error";
import {
  LabPackage,
  type ILabPackage,
  type IPackageItem,
  type LabPackageDoc,
} from "../../models/lab-package.model";
import { LabTest } from "../../models/lab-test.model";
import { Department } from "../../models/department.model";

export interface PackageItemInput {
  testId: string;
  departmentId: string;
}

export type CreatePackageInput = Omit<
  ILabPackage,
  "createdBy" | "createdAt" | "updatedAt" | "seedKey"
>;

export type UpdatePackageInput = Partial<
  Omit<ILabPackage, "createdBy" | "createdAt" | "updatedAt" | "seedKey">
>;

export interface PackageItemView {
  testId: string;
  testCode: string;
  testName: string;
  departmentId: string;
  departmentName: string;
}

export interface PackageView {
  id: string;
  name: string;
  packageType: string;
  amount: number;
  insAmount?: number;
  active: boolean;
  items: PackageItemView[];
  createdAt?: Date;
  updatedAt?: Date;
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

export interface ListPackagesParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof Error && (error as { code?: number }).code === 11000;
}

async function toView(doc: LabPackageDoc): Promise<PackageView> {
  const itemIds = doc.items.map((item) => item.testId);
  const deptIds = doc.items.map((item) => item.departmentId);

  const [tests, departments] = await Promise.all([
    itemIds.length > 0
      ? LabTest.find({ _id: { $in: itemIds } }).select("_id testCode testName").exec()
      : Promise.resolve([]),
    deptIds.length > 0
      ? Department.find({ _id: { $in: deptIds } }).select("_id name").exec()
      : Promise.resolve([]),
  ]);

  const testMap = new Map(tests.map((test) => [String(test._id), test]));
  const deptMap = new Map(departments.map((dept) => [String(dept._id), dept]));

  const items: PackageItemView[] = doc.items.map((item) => {
    const test = testMap.get(String(item.testId));
    const department = deptMap.get(String(item.departmentId));
    return {
      testId: String(item.testId),
      testCode: test?.testCode ?? "",
      testName: test?.testName ?? "Unknown test",
      departmentId: String(item.departmentId),
      departmentName: department?.name ?? "Unknown department",
    };
  });

  const json = doc.toJSON() as unknown as PackageView;
  json.items = items;
  return json;
}

export async function listPackages({
  page = 1,
  limit = 20,
  search,
  status,
}: ListPackagesParams = {}): Promise<PaginatedResult<PackageView>> {
  const filter: FilterQuery<ILabPackage> = {};
  if (status === "active" || status === "inactive") {
    filter.active = status === "active";
  }
  const keyword = search?.trim();
  if (keyword) {
    filter.name = { $regex: escapeRegExp(keyword), $options: "i" };
  }

  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const skip = (safePage - 1) * safeLimit;

  const [total, docs] = await Promise.all([
    LabPackage.countDocuments(filter),
    LabPackage.find(filter)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(safeLimit)
      .exec(),
  ]);

  const data = await Promise.all(docs.map((doc) => toView(doc)));

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

export async function getPackage(id: string): Promise<PackageView> {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid package ID");
  }
  const doc = await LabPackage.findById(id).exec();
  if (!doc) {
    throw new ApiError(404, "Package not found");
  }
  return toView(doc);
}

function normalizeItems(items: Array<PackageItemInput | IPackageItem>): ILabPackage["items"] {
  return items.map((item) => ({
    testId: new Types.ObjectId(String(item.testId)),
    departmentId: new Types.ObjectId(String(item.departmentId)),
  }));
}

export async function createPackage(
  userId: string,
  input: CreatePackageInput,
): Promise<PackageView> {
  try {
    const doc = await LabPackage.create({
      ...input,
      items: normalizeItems(input.items ?? []),
      active: input.active ?? true,
      createdBy: new Types.ObjectId(userId),
    });
    return toView(doc);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(409, "This package record already exists");
    }
    throw error;
  }
}

export async function updatePackage(
  id: string,
  userId: string,
  input: UpdatePackageInput,
): Promise<PackageView> {
  const doc = await LabPackage.findById(id).exec();
  if (!doc) {
    throw new ApiError(404, "Package not found");
  }
  const changes: Record<string, unknown> = {
    ...input,
    updatedBy: new Types.ObjectId(userId),
  };
  if (input.items !== undefined) {
    changes.items = normalizeItems(input.items);
  }
  try {
    Object.assign(doc, changes);
    await doc.save();
    return toView(doc);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(409, "This package record already exists");
    }
    throw error;
  }
}

export async function setPackageActive(
  id: string,
  userId: string,
  active: boolean,
): Promise<PackageView> {
  const doc = await LabPackage.findById(id).exec();
  if (!doc) {
    throw new ApiError(404, "Package not found");
  }
  doc.active = active;
  doc.updatedBy = new Types.ObjectId(userId);
  await doc.save();
  return toView(doc);
}