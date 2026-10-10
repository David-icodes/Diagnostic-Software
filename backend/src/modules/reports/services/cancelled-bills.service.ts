import type { FilterQuery } from "mongoose";
import { LabBill, type ILabBill } from "../../../models/lab-bill.model";
import { isValidObjectId } from "../../../utils/object-id";
import type { CancelledBillsQuery } from "../validations/cancelled-bills";
import { dayRange, EXPORT_LIMIT, round2, splitCsv } from "../utils/report-core";
import { billTypeLabel, payModeLabel, patientTypeLabel } from "../utils/report-labels";
import type { CancelledBillReportRow, CancelledBillsResult } from "../types/cancelled-bills";

/**
 * Cancelled Bills Report — read-only view over bills whose status is
 * `cancelled`. The original financial record is preserved; this report never
 * mutates bills. `cancelledAt` / `cancelledBy` / remarks come straight from
 * the persisted audit trail on the bill document.
 */
export async function listCancelledBills(
  input: CancelledBillsQuery,
): Promise<CancelledBillsResult> {
  const { page, limit } = input;
  const isExport = input.export === "1";

  const filter: FilterQuery<ILabBill> = {
    status: "cancelled",
  };

  const range = dayRange(input.fromDate, input.toDate);
  if (range) filter.cancelledAt = range;

  const billTypes = splitCsv(input.billType);
  if (billTypes && billTypes.length > 0) {
    filter.billType = { $in: billTypes };
  }

  const payModes = splitCsv(input.payMode);
  if (payModes && payModes.length > 0) {
    filter.paymentMode = { $in: payModes };
  }

  const cancelledBys = splitCsv(input.cancelledBy)?.filter(isValidObjectId);
  if (cancelledBys && cancelledBys.length > 0) {
    filter.cancelledBy = { $in: cancelledBys };
  }

  const [total, summaryRows, bills] = await Promise.all([
    LabBill.countDocuments(filter),
    LabBill.aggregate<{ totalBills: number; totalNet: number }>([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          totalNet: { $sum: "$netAmount" },
        },
      },
    ]),
    LabBill.find(filter)
      .sort({ cancelledAt: -1 })
      .limit(isExport ? EXPORT_LIMIT : limit)
      .skip(isExport ? 0 : (page - 1) * limit)
      .populate("patientId", "patientId fullName")
      .populate("cancelledBy", "name")
      .exec(),
  ]);

  const summary = summaryRows[0] ?? { totalBills: 0, totalNet: 0 };

  const data: CancelledBillReportRow[] = bills.map((bill) => {
    const patient = bill.patientId as unknown as
      | { patientId?: string; fullName?: string }
      | null;
    const cancelledByUser = bill.cancelledBy as unknown as
      | { name?: string }
      | null;
    return {
      id: bill.id,
      billNumber: bill.billNumber,
      billDate: (bill.createdAt ?? new Date()).toISOString(),
      cancelledAt: bill.cancelledAt?.toISOString() ?? "",
      billFor: patientTypeLabel(bill.patientType),
      billType: billTypeLabel(bill.billType),
      patientId: patient?.patientId ?? "—",
      patientName: patient?.fullName ?? "—",
      tests: bill.items.map((item) => item.testName),
      netAmount: round2(bill.netAmount),
      payMode: payModeLabel(bill.paymentMode),
      cancelledBy: cancelledByUser?.name ?? "—",
      remarks: bill.cancellationRemarks ?? "",
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
      totalNet: round2(summary.totalNet),
    },
  };
}