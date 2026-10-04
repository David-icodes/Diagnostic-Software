import type { FilterQuery } from "mongoose";
import { LabBill, type ILabBill } from "../../../models/lab-bill.model";
import { LabSample } from "../../../models/lab-sample.model";
import { LabTestResult } from "../../../models/lab-test-result.model";
import { Patient } from "../../../models/patient.model";
import type {
  LabSummaryApprovalStatus,
  LabSummaryLabStatus,
  LabSummaryResult,
  LabSummaryReportRow,
} from "../types/lab-summary";
import type { LabSummaryQuery } from "../validations/lab-summary";
import { dayRange, emptyPagination, escapeRegExp, round2, slicePage } from "../utils/report-core";

/**
 * No per-test TAT target is configured in the LIS yet, so a documented default
 * threshold is used to decide whether a test was "delayed". Move this into an
 * org-level config setting when one is introduced.
 */
export const DELAYED_TAT_HOURS = 24;

export const LAB_STATUS_OPTIONS: LabSummaryLabStatus[] = ["OPEN", "CLOSED"];
export const APPROVAL_STATUS_OPTIONS: LabSummaryApprovalStatus[] = ["PENDING", "APPROVED"];

/** Shared, single source of truth for how the derived columns are produced. */
const LAB_STATUS_BASIS =
  "Derived from result-entry state (CLOSED = results entered, OPEN = not entered).";
const APPROVAL_STATUS_BASIS =
  "Approval workflow not implemented yet; APPROVED = results entered (CLOSED), PENDING = not entered (OPEN). No approval actor or approval timestamp is stored, so those columns render as an em dash.";

const PATIENT_TYPE_MAP: Record<string, string> = {
  gp: "osp",
  op: "op",
  ip: "ip",
  er: "emergency",
};

/**
 * Lab Summary Report — a per-test listing derived from generated bills and the
 * existing sample/test-result workflow.
 *
 * - "Lab Status" is the existing derived test status: CLOSED when results have
 *   been entered for the (bill, test) pair, otherwise OPEN. (The LIS has no
 *   separate "lab status" field beyond the sample workflow, so this is the
 *   authoritative status used by the sample-collection screens.)
 * - "Approval Status" reflects the same result-entry state (APPROVED = CLOSED,
 *   PENDING = OPEN): an explicit approval/verification workflow does not exist
 *   yet and is clearly flagged in the report meta.
 * - "Delayed TAT" compares the earliest sample-collection time (falling back to
 *   the bill date) against the latest result-entry time.
 * - Sample/result columns are read from the existing records: `UPId` is the lab
 *   sample id, and `Entered By` / `Entered On` come from the latest result row
 *   across the test's parameters. Nothing is invented for fields the LIS does
 *   not record.
 */
export async function listLabSummary(input: LabSummaryQuery): Promise<LabSummaryResult> {
  const { page, limit, export: isExport } = input;
  const range = dayRange(input.fromDate, input.toDate);

  const filter: FilterQuery<ILabBill> = { status: "generated" };
  if (range) filter.createdAt = range;

  const billNoKeyword = input.billNumber?.trim();
  if (billNoKeyword) {
    filter.billNumber = { $regex: escapeRegExp(billNoKeyword), $options: "i" };
  }

  if (input.patientTypes?.length) {
    filter.patientType = { $in: input.patientTypes.map((t) => PATIENT_TYPE_MAP[t]) };
  }
  if (input.departmentIds?.length) {
    filter["items.departmentId"] = { $in: input.departmentIds };
  }
  if (input.testIds?.length) {
    filter["items.testId"] = { $in: input.testIds };
  }

  const bills = await LabBill.find(filter).sort({ createdAt: 1 }).exec();
  if (bills.length === 0) {
    return {
      data: [],
      pagination: emptyPagination(page, limit) as LabSummaryResult["pagination"],
      summary: { totalTests: 0, totalDelayed: 0, totalAmount: 0 },
      meta: {
        delayedTatHours: DELAYED_TAT_HOURS,
        labStatusBasis: LAB_STATUS_BASIS,
        approvalStatusBasis: APPROVAL_STATUS_BASIS,
      },
    };
  }

  const billIds = bills.map((b) => b._id);
  const [samples, results] = await Promise.all([
    LabSample.find({ billId: { $in: billIds } })
      .select("billId testId sampleId sampleStatus collectedAt")
      .exec(),
    LabTestResult.find({ billId: { $in: billIds } })
      .select("billId testId enteredBy enteredAt")
      .populate("enteredBy", "name")
      .sort({ enteredAt: 1 })
      .exec(),
  ]);

  const sampleMap = new Map<string, { sampleId?: string; sampleStatus?: string; collectedAt?: Date }>();
  for (const sample of samples) {
    sampleMap.set(`${sample.billId}:${sample.testId}`, sample);
  }
  // `results` is ordered by enteredAt asc, so the last write wins for each pair.
  // A test carries one result row per parameter, so the latest entry across the
  // test's parameters is the authoritative "Entered By / Entered On" pair.
  const latestResult = new Map<
    string,
    { enteredAt: Date; enteredByName: string }
  >();
  for (const result of results) {
    const enteredBy = result.enteredBy as unknown as { name?: string } | null;
    latestResult.set(`${result.billId}:${result.testId}`, {
      enteredAt: result.enteredAt,
      enteredByName: enteredBy?.name ?? "",
    });
  }
  const latestResultAt = new Map<string, Date>(
    [...latestResult.entries()].map(([key, value]) => [key, value.enteredAt]),
  );

  const patientIds = bills.map((b) => b.patientId);
  const patients = await Patient.find({ _id: { $in: patientIds } })
    .select("patientId fullName")
    .exec();
  const patientMap = new Map<string, { patientId?: string; fullName?: string }>();
  for (const patient of patients) {
    patientMap.set(String(patient._id), patient);
  }

  const rows: LabSummaryReportRow[] = [];
  for (const bill of bills) {
    const billCreatedAt = bill.createdAt ?? new Date();
    const matchedItems = bill.items.filter(
      (item) =>
        (!input.departmentIds?.length || input.departmentIds.includes(String(item.departmentId))) &&
        (!input.testIds?.length || input.testIds.includes(String(item.testId))),
    );

    for (const item of matchedItems) {
      const pairKey = `${bill._id}:${item.testId}`;
      const hasResults = latestResultAt.has(pairKey);
      const labStatus: LabSummaryLabStatus = hasResults ? "CLOSED" : "OPEN";
      const approvalStatus: LabSummaryApprovalStatus = hasResults ? "APPROVED" : "PENDING";

      const sample = sampleMap.get(pairKey);
      const startedAt = sample?.collectedAt ?? billCreatedAt;
      let delayed = false;
      if (hasResults) {
        const endedAt = latestResultAt.get(pairKey) ?? billCreatedAt;
        const hours = Math.max(0, (endedAt.getTime() - startedAt.getTime()) / 3_600_000);
        delayed = hours > DELAYED_TAT_HOURS;
      }

      if (input.labStatus && input.labStatus !== labStatus) continue;
      if (input.approvalStatus && input.approvalStatus !== approvalStatus) continue;
      if (input.delayedTat === "1" && !delayed) continue;

      const patient = patientMap.get(String(bill.patientId));
      const latest = latestResult.get(pairKey);
      rows.push({
        id: `${bill.id}-${item.testId}`,
        billNumber: bill.billNumber,
        reportDate: billCreatedAt.toISOString(),
        patientId: patient?.patientId ?? "—",
        patientName: patient?.fullName ?? "—",
        patientType: bill.patientType,
        departmentName: item.departmentName,
        testName: item.testName,
        upId: sample?.sampleId ?? "",
        sampleStatus: sample?.sampleStatus ?? "",
        collectedOn: sample?.collectedAt?.toISOString() ?? "",
        labStatus,
        approvalStatus,
        enteredBy: latest?.enteredByName ?? "",
        enteredOn: latest?.enteredAt?.toISOString() ?? "",
        delayedTat: delayed,
        amount: round2(item.total),
      });
    }
  }

  const totalDelayed = rows.reduce((count, row) => count + (row.delayedTat ? 1 : 0), 0);
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

  const { data, pagination } = slicePage(rows, rows.length, page, limit, isExport === "1");

  return {
    data,
    pagination,
    summary: {
      totalTests: rows.length,
      totalDelayed,
      totalAmount: round2(totalAmount),
    },
    meta: {
      delayedTatHours: DELAYED_TAT_HOURS,
      labStatusBasis: LAB_STATUS_BASIS,
      approvalStatusBasis: APPROVAL_STATUS_BASIS,
    },
  };
}