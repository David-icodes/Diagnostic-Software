import { Types, type FilterQuery } from "mongoose";
import { ApiError } from "../../utils/api-error";
import { isValidObjectId } from "../../utils/object-id";
import { Department } from "../../models/department.model";
import { LabTest, type ILabTest } from "../../models/lab-test.model";
import { recordAudit } from "../audit/audit.service";

export interface TariffRow {
  id: string;
  testId: string;
  departmentId: string;
  departmentName: string;
  testName: string;
  price: number;
  priceIp?: number;
  priceInsIp?: number;
  priceEr?: number;
}

export interface PaginatedTariffs {
  data: TariffRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function listTariffs({
  departmentId,
  search,
  page,
  limit,
}: {
  departmentId?: string;
  search?: string;
  page: number;
  limit: number;
}): Promise<PaginatedTariffs> {
  const filter: FilterQuery<ILabTest> = {};
  if (departmentId) {
    filter.departmentId = isValidObjectId(departmentId)
      ? new Types.ObjectId(departmentId)
      : new Types.ObjectId("000000000000000000000000");
  }
  const keyword = search?.trim();
  if (keyword) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { testName: { $regex: escaped, $options: "i" } },
      { testCode: { $regex: escaped, $options: "i" } },
    ];
  }

  const [tests, total] = await Promise.all([
    LabTest.find(filter).sort({ testName: 1 }).skip((page - 1) * limit).limit(limit).exec(),
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

  const data: TariffRow[] = tests.map((test) => ({
    id: test.id,
    testId: String(test._id),
    departmentId: String(test.departmentId),
    departmentName: departmentNameMap.get(String(test.departmentId)) ?? "Unassigned",
    testName: test.testName,
    price: test.price,
    priceIp: test.priceIp,
    priceInsIp: test.priceInsIp,
    priceEr: test.priceEr,
  }));

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/**
 * Bulk-updates tariff prices for the selected tests. History is safe by
 * design: bills snapshot their own `unitPrice` at creation time, so changing
 * the catalogue here never mutates already-generated bills.
 */
export async function updateTariffs(
  userId: string,
  rows: Array<{
    testId: string;
    price: number;
    priceIp?: number;
    priceInsIp?: number;
    priceEr?: number;
  }>,
): Promise<{ updated: number }> {
  const testIds = rows.map((row) => row.testId);
  if (!testIds.every(isValidObjectId)) {
    throw new ApiError(400, "Invalid test ID in tariff update");
  }

  const tests = await LabTest.find({ _id: { $in: testIds } }).exec();
  const testMap = new Map(tests.map((test) => [String(test._id), test]));
  const missing = rows.filter((row) => !testMap.has(row.testId));
  if (missing.length > 0) {
    throw new ApiError(422, "One or more selected tests no longer exist");
  }

  const operations = rows.map((row) => {
    const setFields: Record<string, unknown> = {
      price: row.price,
      updatedBy: new Types.ObjectId(userId),
    };
    const unsetFields: Record<string, ""> = {};
    if (row.priceIp === undefined) {
      unsetFields.priceIp = "";
    } else {
      setFields.priceIp = row.priceIp;
    }
    if (row.priceInsIp === undefined) {
      unsetFields.priceInsIp = "";
    } else {
      setFields.priceInsIp = row.priceInsIp;
    }
    if (row.priceEr === undefined) {
      unsetFields.priceEr = "";
    } else {
      setFields.priceEr = row.priceEr;
    }

    return {
      updateOne: {
        filter: { _id: new Types.ObjectId(row.testId) },
        update: {
          $set: setFields,
          $unset: unsetFields,
        } as FilterQuery<ILabTest>,
      },
    };
  });

  const result = await LabTest.bulkWrite(operations);

  await recordAudit({
    user: userId,
    action: "lab_tariff.bulk_updated",
    entityType: "LabTest",
    entity: testIds[0],
  });

  return { updated: result.modifiedCount + result.upsertedCount };
}