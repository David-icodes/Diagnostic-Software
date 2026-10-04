/**
 * Dashboard data.
 *
 * Everything here is derived from the persisted collections — there are no
 * demo rows: the summary counts today's bills and the completion state of their
 * test items, "Today's Bills" lists the bills actually created in the range,
 * "Due Bills" lists the generated bills that still carry a balance, and
 * "Recent Patients" lists the latest active registrations.
 *
 * Date handling reuses the report helpers so every screen treats `from`/`to`
 * (`YYYY-MM-DD`) as an inclusive UTC day range.
 */

import type { FilterQuery, Types } from "mongoose";
import { LabBill, type ILabBill } from "../../models/lab-bill.model";
import { LabTestParameter } from "../../models/lab-test-parameter.model";
import { LabTestResult } from "../../models/lab-test-result.model";
import { Patient, type IPatient } from "../../models/patient.model";
import { dayRange } from "../reports/utils/report-core";
import { formatLocalDate, formatLocalDisplayDate } from "../../utils/date-range";

const DEFAULT_LIMIT = 10;

export interface DashboardSummary {
  labBills: number;
  completedTests: number;
  pendingTests: number;
  date: string;
}

export interface TodayBill {
  id: string;
  billNo: string;
  patientId: string;
  patientName: string;
  age: string;
  gender: string;
}

export interface DueBill {
  id: string;
  billNo: string;
  patientId: string;
  patientName: string;
  net: number;
  paid: number;
  due: number;
}

export interface RecentPatient {
  patientId: string;
  patientName: string;
  age: string;
  gender: string;
  mobile: string;
  /** ISO timestamp of the registration. */
  registeredAt: string;
}

/** `dd-mm-yyyy`, the format the dashboard header displays (local calendar). */
export function formatDashboardDate(date: Date = new Date()): string {
  return formatLocalDisplayDate(date);
}

function ageLabel(patient: Pick<IPatient, "age" | "dateOfBirth">): string {
  if (patient.dateOfBirth) {
    const now = new Date();
    const dob = new Date(patient.dateOfBirth);
    let years = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
      years -= 1;
    }
    if (years >= 0) return `${years} years`;
  }
  if (typeof patient.age === "number" && Number.isFinite(patient.age)) {
    return `${patient.age} years`;
  }
  return "—";
}

function genderLabel(gender: string | undefined): string {
  if (gender === "male") return "Male";
  if (gender === "female") return "Female";
  if (gender === "other") return "Other";
  return "—";
}

type BillWithPatient = ILabBill & {
  _id: Types.ObjectId;
  patientId: IPatient & { _id: unknown };
};

/**
 * Default dashboard window: today. The cards and the "Today's Bills" list are
 * labelled with the current date, so an unfiltered request must not silently
 * aggregate the whole history.
 */
function resolveDayRange(
  fromDate: string | undefined,
  toDate: string | undefined,
): { from?: string; to?: string } {
  if (fromDate || toDate) return { from: fromDate, to: toDate };
  const today = formatLocalDate();
  return { from: today, to: today };
}

async function billsInRange(
  fromDate: string | undefined,
  toDate: string | undefined,
): Promise<FilterQuery<ILabBill>> {
  const { from, to } = resolveDayRange(fromDate, toDate);
  const createdAt = dayRange(from, to);
  const filter: FilterQuery<ILabBill> = { status: { $ne: "cancelled" } };
  if (createdAt) filter.createdAt = createdAt;
  return filter;
}

/**
 * Counts a bill's test item as completed when every active parameter of that
 * test has a saved result on the bill.
 *
 * Completion is deliberately result-based only: samples are created lazily when
 * the sample screen is opened, so requiring a collected sample would make a
 * fully entered result count as pending. A test with no active parameter cannot
 * be completed or pending and is skipped in both figures.
 */
async function completedTestCount(
  bills: BillWithPatient[],
): Promise<{ completed: number; countable: number }> {
  if (bills.length === 0) return { completed: 0, countable: 0 };

  const billIds = bills.map((bill) => bill._id as unknown);
  const billTestKeys = bills.flatMap((bill) =>
    bill.items.map((item) => ({ billId: bill._id, testId: item.testId })),
  );
  const itemTestIds = bills.flatMap((bill) => bill.items.map((item) => item.testId));

  const [expected, saved] = await Promise.all([
    LabTestParameter.aggregate<{ _id: string; count: number }>([
      { $match: { testId: { $in: itemTestIds }, active: true } },
      { $group: { _id: "$testId", count: { $sum: 1 } } },
    ]),
    LabTestResult.find({ billId: { $in: billIds } })
      .select("billId testId parameterId")
      .lean()
      .exec(),
  ]);

  const expectedByTest = new Map(expected.map((row) => [String(row._id), row.count]));

  const savedByBillTest = new Map<string, Set<string>>();
  for (const row of saved) {
    const key = `${String(row.billId)}|${String(row.testId)}`;
    const set = savedByBillTest.get(key) ?? new Set<string>();
    set.add(String(row.parameterId));
    savedByBillTest.set(key, set);
  }

  let completed = 0;
  let countable = 0;
  for (const { billId, testId } of billTestKeys) {
    const expectedCount = expectedByTest.get(String(testId)) ?? 0;
    // A test with no parameters configured cannot be completed or pending.
    if (expectedCount === 0) continue;
    countable += 1;
    const savedCount = savedByBillTest.get(`${String(billId)}|${String(testId)}`)?.size ?? 0;
    if (savedCount >= expectedCount) completed += 1;
  }

  return { completed, countable };
}

export async function getSummary({
  fromDate,
  toDate,
}: {
  fromDate?: string;
  toDate?: string;
}): Promise<DashboardSummary> {
  const filter = await billsInRange(fromDate, toDate);

  const bills = (await LabBill.find(filter)
    .populate("patientId")
    .lean()
    .exec()) as unknown as BillWithPatient[];

  // A bill-test pair is one unit of work on this dashboard: results are stored
  // per bill + test + parameter, so item quantities are not counted here. Both
  // figures therefore come from the same unit and can never drift apart.
  const { completed, countable } = await completedTestCount(bills);

  return {
    labBills: bills.length,
    completedTests: completed,
    pendingTests: Math.max(0, countable - completed),
    date: formatDashboardDate(),
  };
}

export async function getTodayBills({
  fromDate,
  toDate,
  limit = DEFAULT_LIMIT,
}: {
  fromDate?: string;
  toDate?: string;
  limit?: number;
}): Promise<TodayBill[]> {
  const filter = await billsInRange(fromDate, toDate);

  const bills = (await LabBill.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("patientId")
    .lean()
    .exec()) as unknown as BillWithPatient[];

  return bills.map((bill) => {
    const patient = bill.patientId as unknown as IPatient | null;
    return {
      id: String(bill._id),
      billNo: bill.billNumber,
      patientId: patient?.patientId ?? "—",
      patientName: patient?.fullName ?? "—",
      age: patient ? ageLabel(patient) : "—",
      gender: genderLabel(patient?.gender),
    };
  });
}

export async function getDueBills({
  limit = DEFAULT_LIMIT,
}: {
  limit?: number;
}): Promise<DueBill[]> {
  const bills = (await LabBill.find({
    status: "generated",
    dueAmount: { $gt: 0 },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("patientId")
    .lean()
    .exec()) as unknown as BillWithPatient[];

  return bills.map((bill) => {
    const patient = bill.patientId as unknown as IPatient | null;
    return {
      id: String(bill._id),
      billNo: bill.billNumber,
      patientId: patient?.patientId ?? "—",
      patientName: patient?.fullName ?? "—",
      net: bill.netAmount,
      paid: bill.paidAmount,
      due: bill.dueAmount,
    };
  });
}

/**
 * Most recently registered patients, newest first.
 *
 * Only `status: "active"` registrations are listed: deleting a registration
 * archives the patient instead of removing the row, and the dashboard must not
 * resurface an archived registration. Values come from the stored patient
 * record, and the age is derived from the stored date of birth rather than a
 * duplicated field.
 */
export async function getRecentPatients({
  limit = DEFAULT_LIMIT,
  fromDate,
  toDate,
}: {
  limit?: number;
  fromDate?: string;
  toDate?: string;
} = {}): Promise<RecentPatient[]> {
  const filter: FilterQuery<IPatient> = { status: "active" };
  const createdAt = dayRange(fromDate, toDate);
  if (createdAt) filter.createdAt = createdAt;

  const patients = await Patient.find(filter)
    .select("patientId fullName gender dateOfBirth age mobile createdAt")
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean()
    .exec();

  return patients.map((patient) => ({
    patientId: patient.patientId,
    patientName: patient.fullName,
    age: ageLabel(patient),
    gender: genderLabel(patient.gender),
    mobile: patient.mobile,
    registeredAt: (patient.createdAt ?? new Date(0)).toISOString(),
  }));
}