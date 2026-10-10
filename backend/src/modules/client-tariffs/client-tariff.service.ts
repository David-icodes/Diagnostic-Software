import { Types } from "mongoose";
import { ApiError } from "../../utils/api-error";
import { isValidObjectId } from "../../utils/object-id";
import { LabTest } from "../../models/lab-test.model";
import { LabClient } from "../../models/lab-client.model";
import { Department } from "../../models/department.model";
import { LabClientTariff } from "../../models/lab-client-tariff.model";
import { recordAudit } from "../audit/audit.service";

export interface ClientTariffRow {
  testId: string;
  departmentId: string;
  departmentName: string;
  testName: string;
  /** Current out-patient price of the test (display / default). */
  price: number;
  clientPrice?: number;
  configured: boolean;
}

export async function listClientTariffs(
  clientId: string,
  departmentId: string,
): Promise<{ data: ClientTariffRow[] }> {
  if (!isValidObjectId(clientId) || !isValidObjectId(departmentId)) {
    throw new ApiError(400, "Invalid client or department ID");
  }
  const [client, department, tests, tariffs] = await Promise.all([
    LabClient.findById(clientId).exec(),
    Department.findById(departmentId).exec(),
    LabTest.find({ departmentId, active: true }).sort({ testName: 1 }).exec(),
    LabClientTariff.find({ clientId, departmentId, active: true }).exec(),
  ]);

  if (!client) throw new ApiError(404, "Client not found");
  if (!department) throw new ApiError(404, "Department not found");

  const tariffMap = new Map(
    tariffs.map((tariff) => [String(tariff.testId), tariff]),
  );

  const data: ClientTariffRow[] = tests.map((test) => {
    const tariff = tariffMap.get(String(test._id));
    return {
      testId: String(test._id),
      departmentId: String(test.departmentId),
      departmentName: department.name,
      testName: test.testName,
      price: test.price,
      clientPrice: tariff?.price,
      configured: Boolean(tariff),
    };
  });

  return { data };
}

/**
 * Applies client-specific prices for one client + department.
 *
 * - Rows always carry their own price so a saved value never depends on the
 *   current catalogue OP price.
 * - Existing client tariffs are never overwritten implicitly: when any exist
 *   and `overwrite` is not explicitly `true` a 409 is returned.
 * - Removed rows are soft-deactivated instead of deleted.
 * - Historical bills keep their own unit-price snapshots, so nothing here
 *   mutates already-generated bills.
 */
export async function applyClientTariffs(
  userId: string,
  input: {
    clientId: string;
    departmentId: string;
    overwrite?: boolean;
    rows: Array<{ testId: string; price: number }>;
  },
): Promise<{ applied: number; removed: number }> {
  const client = await LabClient.findById(input.clientId).exec();
  if (!client) throw new ApiError(404, "Client not found");
  const department = await Department.findById(input.departmentId).exec();
  if (!department) throw new ApiError(404, "Department not found");

  const tests = await LabTest.find({
    _id: { $in: input.rows.map((row) => row.testId) },
    departmentId: input.departmentId,
  }).exec();
  const validTestIds = new Set(tests.map((test) => String(test._id)));
  const invalidCount = input.rows.filter(
    (row) => !validTestIds.has(row.testId),
  ).length;
  if (invalidCount > 0) {
    throw new ApiError(
      422,
      "One or more selected tests do not belong to the selected department",
    );
  }

  const existing = await LabClientTariff.find({
    clientId: input.clientId,
    departmentId: input.departmentId,
    active: true,
    testId: { $in: input.rows.map((row) => row.testId) },
  }).exec();

  if (!input.overwrite && existing.length > 0) {
    throw new ApiError(
      409,
      `This client already has ${existing.length} tariff(s) for this department. Tick "Copy The Above Tariff Set" and confirm to replace them.`,
    );
  }

  const submittedIds = new Set(input.rows.map((row) => row.testId));
  const toDeactivate = existing.filter(
    (tariff) => !submittedIds.has(String(tariff.testId)),
  );

  await Promise.all(
    toDeactivate.map(async (tariff) => {
      tariff.active = false;
      tariff.updatedBy = new Types.ObjectId(userId);
      await tariff.save();
    }),
  );

  // Sequential upsert (not Promise.all): rows targeting the same test must not
  // race each other, otherwise duplicate documents could be created.
  for (const row of input.rows) {
    const existingForTest = await LabClientTariff.findOne({
      clientId: input.clientId,
      testId: row.testId,
    }).exec();
    if (existingForTest) {
      existingForTest.departmentId = new Types.ObjectId(input.departmentId);
      existingForTest.price = row.price;
      existingForTest.active = true;
      existingForTest.updatedBy = new Types.ObjectId(userId);
      await existingForTest.save();
      continue;
    }
    await LabClientTariff.create({
      clientId: input.clientId,
      departmentId: input.departmentId,
      testId: row.testId,
      price: row.price,
      active: true,
      createdBy: userId,
    });
  }

  await recordAudit({
    user: userId,
    action: "client_tariff.applied",
    entityType: "LabClientTariff",
    entity: client._id,
  });

  return { applied: input.rows.length, removed: toDeactivate.length };
}