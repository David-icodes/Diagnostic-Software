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
 * (`YYYY-MM-DD`) as an inclusive local calendar day range.
 */

import { billCompletion } from "./bill-completion";
import type { FilterQuery, Types } from "mongoose";
import { LabBill, type ILabBill } from "../../models/lab-bill.model";
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
  completed: boolean;
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

/** Shared derived bill state; no persisted completion status is introduced. */
async function completionByBill(bills: BillWithPatient[]): Promise<Map<string, boolean>> {
  if (!bills.length) return new Map();
  const billIds = bills.map((bill) => bill._id);
  const results = await LabTestResult.find({ billId: { $in: billIds } }).select("billId patientId testId parameterId result").lean().exec();
  return billCompletion(
    bills.map((bill) => ({ id: String(bill._id), patientId: String(bill.patientId?._id ?? ""), testIds: bill.items.map((item) => String(item.testId)) })),
    results.map((result) => ({ ...result, billId: String(result.billId), patientId: String(result.patientId), testId: String(result.testId), parameterId: String(result.parameterId) })),
  );
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

  const states = await completionByBill(bills);
  const completed = [...states.values()].filter(Boolean).length;

  return {
    labBills: bills.length,
    completedTests: completed,
    pendingTests: Math.max(0, bills.length - completed),
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

  const states = await completionByBill(bills);

  return bills.map((bill) => {
    const patient = bill.patientId as unknown as IPatient | null;
    return {
      id: String(bill._id),
      billNo: bill.billNumber,
      patientId: patient?.patientId ?? "—",
      patientName: patient?.fullName ?? "—",
      age: patient ? ageLabel(patient) : "—",
      gender: genderLabel(patient?.gender),
      completed: states.get(String(bill._id)) ?? false,
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
