import type { FilterQuery } from "mongoose";
import { LabBill, type ILabBill } from "../../../models/lab-bill.model";
import { Patient, type IPatient } from "../../../models/patient.model";
import type { GeneratedLabBillsQuery } from "../validations/generated-lab-bills";
import { payModeLabel } from "../utils/report-labels";
import { allValidIds, escapeRegExp, parseStartOfDay, round2, splitCsv } from "../utils/report-core";
import type {
  GeneratedLabBillReportRow,
  GeneratedLabBillsResult,
  ReportPaymentStatus,
} from "../types/generated-lab-bills";

function paymentStatusOf(bill: Pick<ILabBill, "paidAmount" | "dueAmount">): ReportPaymentStatus | "free" {
  if (bill.paidAmount > 0 && bill.dueAmount === 0) return "paid";
  if (bill.paidAmount > 0 && bill.dueAmount > 0) return "partial";
  if (bill.dueAmount > 0) return "unpaid";
  return "free";
}

/**
 * Generated Lab Bills report — a historical view over OSP lab bills that were
 * generated (including cancelled ones, clearly identified as CANCELLED).
 *
 * Financial totals are always computed from the price snapshots stored on the
 * bill items; today's catalog prices are never used to re-price old bills.
 * Cancelled bills appear in the listing but are excluded from the totals.
 */
export async function listGeneratedLabBills(
  input: GeneratedLabBillsQuery,
): Promise<GeneratedLabBillsResult> {
  const {
    page,
    limit,
    fromDate,
    toDate,
    patientId,
    patientName,
    billNumber,
    patientType,
    departmentId,
    referringDoctorId,
    paymentStatus,
    patientTypes,
    paymentModes,
    referringDoctorIds,
    collectedByIds,
    orderBy,
    discountedOnly,
  } = input;

  const filter: FilterQuery<ILabBill> = {
    // Legacy OSP bills predate the `billType` field; treat a missing value as
    // OSP so they remain visible, while genuinely vendor bills stay excluded.
    $or: [{ billType: "osp" }, { billType: null }, { billType: { $exists: false } }],
    status: { $in: ["generated", "cancelled"] },
  };

  if (patientType) {
    filter.patientType = patientType;
  }

  // Multi-select groups accept either a single value (legacy links) or a
  // comma-separated list. The single-value key wins so older deep links behave
  // exactly as before.
  const typeList = splitCsv(patientTypes);
  if (typeList && typeList.length > 0) {
    filter.patientType = { $in: typeList };
  }

  const payModeList = splitCsv(paymentModes);
  if (payModeList && payModeList.length > 0) {
    filter.paymentMode = { $in: payModeList };
  }

  const doctorIdList = splitCsv(referringDoctorIds);
  if (doctorIdList && doctorIdList.length > 0 && allValidIds(doctorIdList)) {
    filter.referringDoctorId = { $in: doctorIdList };
  }

  const collectorIdList = splitCsv(collectedByIds);
  if (collectorIdList && collectorIdList.length > 0 && allValidIds(collectorIdList)) {
    filter.createdBy = { $in: collectorIdList };
  }

  if (discountedOnly === "1") {
    filter.discountAmount = { $gt: 0 };
  }

  if (departmentId) {
    filter["items.departmentId"] = departmentId;
  }

  if (referringDoctorId) {
    filter.referringDoctorId = referringDoctorId;
  }

  if (paymentStatus === "paid") {
    filter.paidAmount = { $gt: 0 };
    filter.dueAmount = 0;
  } else if (paymentStatus === "partial") {
    filter.paidAmount = { $gt: 0 };
    filter.dueAmount = { $gt: 0 };
  } else if (paymentStatus === "unpaid") {
    filter.paidAmount = 0;
    filter.dueAmount = { $gt: 0 };
  }

  const from = parseStartOfDay(fromDate);
  const to = parseStartOfDay(toDate);
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt = { $gte: from };
    if (to) {
      const end = new Date(to);
      end.setDate(end.getDate() + 1); // start of the next local day (exclusive)
      filter.createdAt = { ...(filter.createdAt as object), $lt: end };
    }
  }

  const billNoKeyword = billNumber?.trim();
  if (billNoKeyword) {
    filter.billNumber = { $regex: escapeRegExp(billNoKeyword), $options: "i" };
  }

  const patientIdKeyword = patientId?.trim();
  const patientNameKeyword = patientName?.trim();
  if (patientIdKeyword || patientNameKeyword) {
    const patientFilter: FilterQuery<IPatient> = {};
    if (patientIdKeyword) {
      patientFilter.patientId = { $regex: escapeRegExp(patientIdKeyword), $options: "i" };
    }
    if (patientNameKeyword) {
      patientFilter.fullName = { $regex: escapeRegExp(patientNameKeyword), $options: "i" };
    }
    const patients = await Patient.find(patientFilter).select("_id").exec();
    const ids = patients.map((p) => p._id);
    if (ids.length === 0) {
      return {
        analytics: { daily: [], paymentModes: [] },
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
        summary: {
          totalBills: 0,
          totalAmount: 0,
          totalDiscount: 0,
          totalNet: 0,
          totalPaid: 0,
          totalDue: 0,
        },
      };
    }
    filter.patientId = { $in: ids };
  }

  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const skip = (safePage - 1) * safeLimit;

  const [total, summaryRows, bills, analyticsRows] = await Promise.all([
    LabBill.countDocuments(filter),
    LabBill.aggregate<{
      totalBills: number;
      totalAmount: number;
      totalDiscount: number;
      totalNet: number;
      totalPaid: number;
      totalDue: number;
    }>([
      { $match: { ...filter, status: "generated" } },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
          totalDiscount: { $sum: "$discountAmount" },
          totalNet: { $sum: "$netAmount" },
          totalPaid: { $sum: "$paidAmount" },
          totalDue: { $sum: "$dueAmount" },
        },
      },
    ]),
    LabBill.find(filter)
      .sort(orderBy === "date_asc" ? { createdAt: 1, _id: 1 } : { createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate("patientId", "patientId fullName")
      .populate("createdBy", "name")
      .exec(),
    LabBill.aggregate<import("../types/generated-lab-bills").RevenueAnalytics>([
      { $match: { ...filter, status: "generated" } },
      { $facet: {
        daily: [
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } },
            netAmount: { $sum: "$netAmount" }, paidAmount: { $sum: "$paidAmount" }, dueAmount: { $sum: "$dueAmount" } } },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, date: "$_id", netAmount: { $round: ["$netAmount", 2] }, paidAmount: { $round: ["$paidAmount", 2] }, dueAmount: { $round: ["$dueAmount", 2] } } },
        ],
        paymentModes: [
          { $group: { _id: { $ifNull: ["$paymentMode", "unspecified"] }, paidAmount: { $sum: "$paidAmount" } } },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, mode: "$_id", paidAmount: { $round: ["$paidAmount", 2] } } },
        ],
      } },
    ]),
  ]);

  const summary = summaryRows[0] ?? {
    totalBills: 0,
    totalAmount: 0,
    totalDiscount: 0,
    totalNet: 0,
    totalPaid: 0,
    totalDue: 0,
  };

  const data: GeneratedLabBillReportRow[] = bills.map((bill) => {
    const patient = bill.patientId as unknown as {
      patientId?: string;
      fullName?: string;
    } | null;
    const collector = bill.createdBy as unknown as { name?: string } | null;
    const departments = [...new Set(bill.items.map((item) => item.departmentName))];
    const storedPayMode = bill.paymentMode ?? "";
    return {
      id: bill.id,
      billNumber: bill.billNumber,
      billDate: (bill.createdAt ?? new Date()).toISOString(),
      patientId: patient?.patientId ?? "—",
      patientName: patient?.fullName ?? "—",
      patientType: bill.patientType,
      tests: bill.items.map((item) => item.testName),
      departments,
      doctorName: bill.doctorName ?? "",
      totalAmount: round2(bill.totalAmount),
      discountAmount: round2(bill.discountAmount),
      netAmount: round2(bill.netAmount),
      paidAmount: round2(bill.paidAmount),
      dueAmount: round2(bill.dueAmount),
      paymentMode: storedPayMode,
      payModeLabel: payModeLabel(storedPayMode),
      collectedBy: collector?.name ?? "",
      paymentStatus: paymentStatusOf(bill),
      status: bill.status as "generated" | "cancelled",
    };
  });

  return {
    analytics: analyticsRows[0] ?? { daily: [], paymentModes: [] },
    data,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
    summary: {
      totalBills: summary.totalBills,
      totalAmount: round2(summary.totalAmount),
      totalDiscount: round2(summary.totalDiscount),
      totalNet: round2(summary.totalNet),
      totalPaid: round2(summary.totalPaid),
      totalDue: round2(summary.totalDue),
    },
  };
}