import { Types } from "mongoose";
import { ApiError } from "../../utils/api-error";
import { isValidObjectId } from "../../utils/object-id";
import { LabTest } from "../../models/lab-test.model";
import { Doctor } from "../../models/doctor.model";
import { Department } from "../../models/department.model";
import {
  DoctorCommission,
  type IDoctorCommission,
} from "../../models/doctor-commission.model";
import { recordAudit } from "../audit/audit.service";

export interface CommissionMappingRow {
  testId: string;
  testName: string;
  /** Current out-patient price of the test (display only). */
  amount: number;
  commissionPercent?: number;
  commissionAmount?: number;
  configured: boolean;
}

export async function listCommissionMappings(
  doctorId: string,
  departmentId: string,
): Promise<{ data: CommissionMappingRow[] }> {
  if (!isValidObjectId(doctorId) || !isValidObjectId(departmentId)) {
    throw new ApiError(400, "Invalid doctor or department ID");
  }
  const [doctor, department, tests, mappings] = await Promise.all([
    Doctor.findById(doctorId).exec(),
    Department.findById(departmentId).exec(),
    LabTest.find({ departmentId, active: true }).sort({ testName: 1 }).exec(),
    DoctorCommission.find({
      doctorId,
      departmentId,
      scope: "test",
      active: true,
    }).exec(),
  ]);

  if (!doctor) throw new ApiError(404, "Doctor not found");
  if (!department) throw new ApiError(404, "Department not found");

  const mappingMap = new Map(
    mappings.map((mapping) => [String(mapping.testId), mapping]),
  );

  const data: CommissionMappingRow[] = tests.map((test) => {
    const mapping = mappingMap.get(String(test._id));
    return {
      testId: String(test._id),
      testName: test.testName,
      amount: test.price,
      commissionPercent: mapping?.commissionPercent,
      commissionAmount: mapping?.commissionAmount,
      configured: Boolean(mapping),
    };
  });

  return { data };
}

/**
 * Applies the selected commission set for a doctor + department combination.
 *
 * - Precedence: when both values are stored, the fixed rupee amount wins over
 *   the percentage (a fixed fee is treated as the exact commission for that
 *   test). Department-level and doctor-level records are untouched.
 * - Existing test mappings are never overwritten implicitly: when mappings
 *   already exist and `overwrite` is not explicitly `true` a 409 is returned.
 * - Removed rows are soft-deactivated (`active:false`) instead of deleted so
 *   configuration history is preserved for financial reporting.
 */
export async function assignCommissionMappings(
  userId: string,
  input: {
    doctorId: string;
    departmentId: string;
    overwrite?: boolean;
    mappings: Array<{
      testId: string;
      commissionPercent?: number;
      commissionAmount?: number;
    }>;
  },
): Promise<{ assigned: number; removed: number }> {
  const doctor = await Doctor.findById(input.doctorId).exec();
  if (!doctor) throw new ApiError(404, "Doctor not found");
  const department = await Department.findById(input.departmentId).exec();
  if (!department) throw new ApiError(404, "Department not found");

  const tests = await LabTest.find({
    _id: { $in: input.mappings.map((row) => row.testId) },
    departmentId: input.departmentId,
  }).exec();
  const validTestIds = new Set(tests.map((test) => String(test._id)));
  const invalidCount = input.mappings.filter(
    (row) => !validTestIds.has(row.testId),
  ).length;
  if (invalidCount > 0) {
    throw new ApiError(
      422,
      "One or more selected tests do not belong to the selected department",
    );
  }

  const existing = await DoctorCommission.find({
    doctorId: input.doctorId,
    departmentId: input.departmentId,
    scope: "test",
    active: true,
    testId: { $in: input.mappings.map((row) => row.testId) },
  }).exec();

  if (!input.overwrite && existing.length > 0) {
    throw new ApiError(
      409,
      `This doctor already has ${existing.length} commission mapping(s) for this department. Tick "Copy The Above Tariff Set" and confirm to replace them.`,
    );
  }

  const submittedIds = new Set(input.mappings.map((row) => row.testId));
  const toDeactivate = existing.filter(
    (mapping) => !submittedIds.has(String(mapping.testId)),
  );

  await Promise.all(
    toDeactivate.map(async (mapping) => {
      mapping.active = false;
      mapping.updatedBy = new Types.ObjectId(userId);
      await mapping.save();
    }),
  );

  // Sequential upsert (not Promise.all): rows targeting the same test must not
  // race each other, otherwise duplicate documents could be created.
  for (const row of input.mappings) {
    const existingForTest = await DoctorCommission.findOne({
      doctorId: input.doctorId,
      departmentId: input.departmentId,
      scope: "test",
      testId: row.testId,
    }).exec();
    if (existingForTest) {
      existingForTest.commissionPercent = row.commissionPercent ?? 0;
      existingForTest.commissionAmount = row.commissionAmount;
      existingForTest.active = true;
      existingForTest.updatedBy = new Types.ObjectId(userId);
      await existingForTest.save();
      continue;
    }
    await DoctorCommission.create({
      scope: "test",
      doctorId: input.doctorId,
      departmentId: input.departmentId,
      testId: row.testId,
      commissionPercent: row.commissionPercent ?? 0,
      commissionAmount: row.commissionAmount,
      active: true,
      createdBy: userId,
    });
  }

  await recordAudit({
    user: userId,
    action: "doctor_commission.mappings_assigned",
    entityType: "DoctorCommission",
    entity: doctor._id,
  });

  return { assigned: input.mappings.length, removed: toDeactivate.length };
}

export type { IDoctorCommission };