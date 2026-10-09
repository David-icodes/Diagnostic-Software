import type { FilterQuery } from "mongoose";
import { LabTest, type ILabTest } from "../../../models/lab-test.model";
import { Department } from "../../../models/department.model";
import type { HospitalPriceCardQuery } from "../validations/hospital-price-card";
import { EXPORT_LIMIT } from "../utils/report-core";
import type {
  HospitalPriceCardMeta,
  HospitalPriceCardResult,
  HospitalPriceCardRow,
} from "../types/hospital-price-card";

const TARIFFS_PARTIAL_NOTE =
  "Tariffs are read from the current lab-tariff master. Unconfigured tiers are shown as —.";
const TARIFFS_UNAVAILABLE_NOTE =
  "The LIS stores a single out-patient tariff per test. In-patient, insured-in-patient, emergency and insured-emergency tariffs are not configured yet and are shown as —.";

/**
 * Hospital Price Card Report — the organisation's published price list.
 * Tariff tiers (OP/IP/ins-IP/ER) come from the lab-tariff master; a missing
 * tier is returned as `null` so the UI renders "—" instead of inventing
 * values. Unconfigured tiers remain null; no OP-price substitutions are made.
 */
export async function listHospitalPriceCard(
  input: HospitalPriceCardQuery,
): Promise<HospitalPriceCardResult> {
  const { page, limit } = input;
  const isExport = input.export === "1";

  const filter: FilterQuery<ILabTest> = {};
  if (input.departmentId) filter.departmentId = input.departmentId;
  if (input.status === "active") filter.active = true;
  if (input.status === "inactive") filter.active = false;

  const departments = await Department.find().select("name").exec();
  const departmentNameMap = new Map(
    departments.map((department) => [String(department._id), department.name]),
  );

  const [total, tests] = await Promise.all([
    LabTest.countDocuments(filter),
    LabTest.find(filter)
      .sort({ testName: 1 })
      .limit(isExport ? EXPORT_LIMIT : limit)
      .skip(isExport ? 0 : (page - 1) * limit)
      .exec(),
  ]);

  const hasExtraTier = tests.some(
    (test) =>
      test.priceIp !== undefined ||
      test.priceEr !== undefined ||
      test.priceInsIp !== undefined,
  );

  const data: HospitalPriceCardRow[] = tests.map((test) => ({
    id: test.id,
    departmentName: departmentNameMap.get(String(test.departmentId)) ?? "Unassigned",
    testName: test.testName,
    opAmount: test.price,
    ipAmount: test.priceIp ?? null,
    insIpAmount: test.priceInsIp ?? null,
    erAmount: test.priceEr ?? null,
    insErAmount: null,
  }));

  const meta: HospitalPriceCardMeta = {
    tariffsUnavailable: !hasExtraTier,
    tariffsNote: hasExtraTier ? TARIFFS_PARTIAL_NOTE : TARIFFS_UNAVAILABLE_NOTE,
  };

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    summary: { totalTests: total },
    meta,
  };
}