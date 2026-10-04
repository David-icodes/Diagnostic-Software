import { Types, type FilterQuery } from "mongoose";
import { ApiError } from "../../utils/api-error";
import { isValidObjectId } from "../../utils/object-id";
import { Department } from "../../models/department.model";
import { LabTest, type ILabTest } from "../../models/lab-test.model";
import { LabPackage } from "../../models/lab-package.model";

export interface PaginatedTests {
  items: LabTestRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Lab-test row as returned to the UI (includes display-only departmentName). */
export interface LabTestRow {
  id: string;
  testCode: string;
  testName: string;
  shortName: string;
  departmentId: Types.ObjectId | string;
  departmentName: string;
  description?: string;
  sampleType?: string;
  containerType?: string;
  testType?: string;
  price: number;
  priceIp?: number;
  priceInsIp?: number;
  priceEr?: number;
  doctorPrice?: number;
  cghsCode?: string;
  nimsCode?: string;
  railwayCode?: string;
  nfcCode?: string;
  comments?: string;
  referralPercent?: number;
  reportNote1?: string;
  reportNote2?: string;
  active: boolean;
  resultMode: ILabTest["resultMode"];
}

export type CreateLabTestInput = Omit<ILabTest, "createdBy" | "createdAt" | "updatedAt">;
export type UpdateLabTestInput = Partial<Omit<ILabTest, "createdBy" | "createdAt" | "updatedAt">>;

function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof Error && (error as { code?: number }).code === 11000;
}

async function ensureDepartmentExists(id: string): Promise<void> {
  if (!isValidObjectId(id)) {
    throw new ApiError(400, "Invalid department ID");
  }
  const department = await Department.findById(id).exec();
  if (!department) {
    throw new ApiError(422, "Department does not exist");
  }
}

export async function listTests({
  departmentId,
  search,
  status,
  page,
  limit,
}: {
  departmentId?: string;
  search?: string;
  status?: string;
  page: number;
  limit: number;
}): Promise<PaginatedTests> {
  const skip = (page - 1) * limit;
  const filter: FilterQuery<ILabTest> = {};

  if (departmentId) {
    filter.departmentId = isValidObjectId(departmentId)
      ? new Types.ObjectId(departmentId)
      : new Types.ObjectId("000000000000000000000000"); // force empty result
  }
  if (status === "active" || status === "inactive") {
    filter.active = status === "active";
  }
  const keyword = search?.trim();
  if (keyword) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { testName: { $regex: escaped, $options: "i" } },
      { testCode: { $regex: escaped, $options: "i" } },
      { shortName: { $regex: escaped, $options: "i" } },
    ];
  }

  const [tests, total] = await Promise.all([
    LabTest.find(filter).sort({ testName: 1 }).skip(skip).limit(limit).exec(),
    LabTest.countDocuments(filter),
  ]);

  const departmentIds = [
    ...new Set(tests.map((test) => String(test.departmentId))),
  ];
  const departments = await Department.find({ _id: { $in: departmentIds } })
    .select("name")
    .exec();
  const departmentNameMap = new Map(
    departments.map((department) => [String(department._id), department.name]),
  );

  const items = tests.map((test) => toRow(test, departmentNameMap));

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

function toRow(
  test: ILabTest,
  departmentNameMap: Map<string, string>,
): LabTestRow {
  return {
    id: String((test as ILabTest & { _id: unknown })._id),
    testCode: test.testCode,
    testName: test.testName,
    shortName: test.shortName,
    departmentId: test.departmentId,
    departmentName: departmentNameMap.get(String(test.departmentId)) ?? "Unassigned",
    description: test.description,
    sampleType: test.sampleType,
    containerType: test.containerType,
    testType: test.testType,
    price: test.price,
    priceIp: test.priceIp,
    priceInsIp: test.priceInsIp,
    priceEr: test.priceEr,
    doctorPrice: test.doctorPrice,
    cghsCode: test.cghsCode,
    nimsCode: test.nimsCode,
    railwayCode: test.railwayCode,
    nfcCode: test.nfcCode,
    comments: test.comments,
    referralPercent: test.referralPercent,
    reportNote1: test.reportNote1,
    reportNote2: test.reportNote2,
    active: test.active,
    resultMode: test.resultMode,
  };
}

export async function getTest(id: string): Promise<ILabTest> {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid test ID");
  }
  const test = await LabTest.findById(id).populate("departmentId", "name code").exec();
  if (!test) {
    throw new ApiError(404, "Lab test not found");
  }
  return test;
}

export async function listTestSpecimenOptions(): Promise<{
  sampleTypes: string[];
  containerTypes: string[];
}> {
  const rows = await LabTest.find().select("sampleType containerType").exec();
  const sampleTypes = [
    ...new Set(
      rows
        .map((row) => row.sampleType?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const containerTypes = [
    ...new Set(
      rows
        .map((row) => row.containerType?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort((a, b) => a.localeCompare(b));
  return { sampleTypes, containerTypes };
}

/**
 * Soft-deactivates a test. Deactivation is used instead of deletion so bills,
 * results, samples and packages that reference the test keep their history.
 * A test that is part of an active package cannot be deactivated until the
 * package is handled first, otherwise the package composition silently breaks.
 */
export async function setTestActive(
  id: string,
  userId: string,
  active: boolean,
): Promise<ILabTest> {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid test ID");
  }
  const test = await LabTest.findById(id).exec();
  if (!test) {
    throw new ApiError(404, "Lab test not found");
  }
  if (!active && test.active) {
    const packageCount = await LabPackage.countDocuments({
      active: true,
      "items.testId": test._id,
    }).exec();
    if (packageCount > 0) {
      throw new ApiError(
        422,
        `Cannot deactivate: this test is part of ${packageCount} active package(s). Handle the package(s) first.`,
      );
    }
  }
  test.active = active;
  test.updatedBy = new Types.ObjectId(userId);
  await test.save();
  return test;
}

export async function createTest(userId: string, input: CreateLabTestInput): Promise<ILabTest> {
  await ensureDepartmentExists(String(input.departmentId));
  try {
    return await LabTest.create({ ...input, createdBy: userId });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(409, "A test with this code or name already exists");
    }
    throw error;
  }
}

export async function updateTest(id: string, userId: string, input: UpdateLabTestInput): Promise<ILabTest> {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid test ID");
  }
  if (input.departmentId) {
    await ensureDepartmentExists(String(input.departmentId));
  }
  const test = await LabTest.findById(id).exec();
  if (!test) {
    throw new ApiError(404, "Lab test not found");
  }
  try {
    Object.assign(test, input, { updatedBy: new Types.ObjectId(userId) });
    await test.save();
    return test;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(409, "A test with this code or name already exists");
    }
    throw error;
  }
}