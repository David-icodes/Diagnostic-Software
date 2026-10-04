import type { FilterQuery } from "mongoose";
import { LabBill, type ILabBill } from "../../../models/lab-bill.model";
import { LabBillPayment } from "../../../models/lab-bill-payment.model";
import { Patient } from "../../../models/patient.model";
import { User } from "../../../models/user.model";
import { isValidObjectId } from "../../../utils/object-id";
import type { DueBillsQuery } from "../validations/due-bills";
import { dayRange, emptyPagination, escapeRegExp, EXPORT_LIMIT, round2, splitCsv } from "../utils/report-core";
import { payModeLabel, patientTypeLabel } from "../utils/report-labels";
import type { DueBillReportRow, DueBillsResult, DueBillsSummary } from "../types/due-bills";

/**
 * Due Bills Report — generated (non-cancelled) bills with an outstanding
 * balance. Excludes cancelled bills; dues come from the persisted bill
 * `dueAmount`, never re-derived from catalog prices.
 */
export async function listDueBills(input: DueBillsQuery): Promise<DueBillsResult> {
  const { page, limit } = input;
  const isExport = input.export === "1";

  const filter: FilterQuery<ILabBill> = {
    status: "generated",
    dueAmount: { $gt: 0 },
  };

  const range = dayRange(input.fromDate, input.toDate);
  if (range) filter.createdAt = range;

  const patientKeyword = input.patientId?.trim();
  if (patientKeyword) {
    const patients = await Patient.find({
      patientId: { $regex: escapeRegExp(patientKeyword), $options: "i" },
    })
      .select("_id")
      .exec();
    const ids = patients.map((p) => p._id);
    if (ids.length === 0) {
      return {
        data: [],
        pagination: emptyPagination(page, limit),
        summary: emptySummary(),
      };
    }
    filter.patientId = { $in: ids };
  }

  const collectorIds = splitCsv(input.collectedByIds)?.filter(isValidObjectId);
  if (collectorIds && collectorIds.length > 0) {
    const billIds = await LabBillPayment.distinct("billId", {
      collectedBy: { $in: collectorIds },
    }).exec();
    if (billIds.length === 0) {
      return {
        data: [],
        pagination: emptyPagination(page, limit),
        summary: emptySummary(),
      };
    }
    filter._id = { $in: billIds };
  }

  const [total, summaryRows, bills] = await Promise.all([
    LabBill.countDocuments(filter),
    LabBill.aggregate<DueBillsSummary>([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
          totalDiscount: { $sum: "$discountAmount" },
          totalNet: { $sum: "$netAmount" },
          totalPaid: { $sum: "$paidAmount" },
          totalBalance: { $sum: "$dueAmount" },
        },
      },
    ]),
    LabBill.find(filter)
      .sort({ createdAt: -1 })
      .limit(isExport ? EXPORT_LIMIT : limit)
      .skip(isExport ? 0 : (page - 1) * limit)
      .populate("patientId", "patientId fullName")
      .exec(),
  ]);

  const summary = summaryRows[0] ?? emptySummary();

  const collectedByNames = await resolveLatestCollectorNames(bills);
  const data: DueBillReportRow[] = bills.map((bill) => {
    const patient = bill.patientId as unknown as
      | { patientId?: string; fullName?: string }
      | null;
    return {
      id: bill.id,
      billNumber: bill.billNumber,
      billDate: (bill.createdAt ?? new Date()).toISOString(),
      billFor: patientTypeLabel(bill.patientType),
      patientId: patient?.patientId ?? "—",
      patientName: patient?.fullName ?? "—",
      totalAmount: round2(bill.totalAmount),
      discountAmount: round2(bill.discountAmount),
      netAmount: round2(bill.netAmount),
      paidAmount: round2(bill.paidAmount),
      balance: round2(bill.dueAmount),
      payMode: payModeLabel(bill.paymentMode),
      collectedBy: collectedByNames.get(String(bill._id)) ?? "—",
    };
  });

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    summary: {
      totalBills: summary.totalBills,
      totalAmount: round2(summary.totalAmount),
      totalDiscount: round2(summary.totalDiscount),
      totalNet: round2(summary.totalNet),
      totalPaid: round2(summary.totalPaid),
      totalBalance: round2(summary.totalBalance),
    },
  };
}

function emptySummary(): DueBillsSummary {
  return {
    totalBills: 0,
    totalAmount: 0,
    totalDiscount: 0,
    totalNet: 0,
    totalPaid: 0,
    totalBalance: 0,
  };
}

/**
 * Maps bill ids to the name of the user who made the most recent collection.
 * Used for the `Collected By` column on partially-paid bills.
 */
async function resolveLatestCollectorNames(
  bills: Array<{ _id: unknown }>,
): Promise<Map<string, string>> {
  const billIds = bills.map((bill) => String(bill._id));
  if (billIds.length === 0) return new Map();

  const payments = await LabBillPayment.find({ billId: { $in: billIds } })
    .sort({ collectedAt: -1 })
    .select("billId collectedBy")
    .exec();

  const userIds = [...new Set(payments.map((p) => String(p.collectedBy)))];
  const users = await User.find({ _id: { $in: userIds } }).select("name").exec();
  const userMap = new Map(users.map((u) => [String(u._id), u.name]));

  const result = new Map<string, string>();
  for (const payment of payments) {
    const key = String(payment.billId);
    if (!result.has(key)) {
      result.set(key, userMap.get(String(payment.collectedBy)) ?? "—");
    }
  }
  return result;
}