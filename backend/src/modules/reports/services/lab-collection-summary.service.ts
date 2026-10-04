import type { FilterQuery } from "mongoose";
import { LabBill } from "../../../models/lab-bill.model";
import { LabBillPayment, type ILabBillPayment } from "../../../models/lab-bill-payment.model";
import type {
  LabCollectionSummaryResult,
  LabCollectionSummaryRow,
} from "../types/lab-collection-summary";
import type { LabCollectionSummaryQuery } from "../validations/lab-collection-summary";
import { dayRange, round2, slicePage } from "../utils/report-core";
import { formatLocalDate } from "../../../utils/date-range";

const EXPENSE_UNAVAILABLE_NOTE =
  "An expense module is not available in the LIS yet; expenses are reported as 0 until expense records are introduced.";

/**
 * Lab Income And Expense (sidebar: "Lab Collection Summary").
 *
 * Income is the money actually collected: the sum of LabBillPayment amounts
 * for the day (each payment is counted once when it was collected). Payments
 * recorded against cancelled bills are excluded — cancelled bills are not
 * collected income. Expense entries do not exist yet, so the expense column is
 * 0 and the limitation is surfaced in the report meta instead of inventing
 * values.
 */
export async function listLabCollectionSummary(
  input: LabCollectionSummaryQuery,
): Promise<LabCollectionSummaryResult> {
  const { page, limit, export: isExport } = input;
  const range = dayRange(input.fromDate, input.toDate);

  const paymentFilter: FilterQuery<ILabBillPayment> = {};
  if (range) paymentFilter.collectedAt = range;

  const payments = await LabBillPayment.find(paymentFilter)
    .select("billId amount collectedAt")
    .exec();

  const rows: LabCollectionSummaryRow[] = [];
  let totalLabAmount = 0;

  if (payments.length > 0) {
    const billIds = [...new Set(payments.map((p) => String(p.billId)))];
    const bills = await LabBill.find({ _id: { $in: billIds } }).select("status").exec();
    const nonCancelled = new Set(
      bills.filter((b) => b.status !== "cancelled").map((b) => String(b._id)),
    );

    const byDate = new Map<string, number>();
    for (const payment of payments) {
      if (!nonCancelled.has(String(payment.billId))) continue;
      // Group by the local calendar day the payment was collected, so a payment
      // taken in the early local hours is not counted under the previous day.
      const day = formatLocalDate(payment.collectedAt as Date);
      byDate.set(day, (byDate.get(day) ?? 0) + payment.amount);
    }

    const days = [...byDate.keys()].sort();
    for (const day of days) {
      const amount = round2(byDate.get(day) ?? 0);
      rows.push({
        id: `day-${day}`,
        reportDate: `${day}T00:00:00.000Z`,
        labAmount: amount,
        expenses: 0,
      });
      totalLabAmount += amount;
    }
  }

  const totalLabAmountRounded = round2(totalLabAmount);
  const profit = totalLabAmountRounded;
  const profitPercent = totalLabAmountRounded > 0 ? round2((profit / totalLabAmountRounded) * 100) : 0;

  const { data, pagination } = slicePage(rows, rows.length, page, limit, isExport === "1");

  return {
    data,
    pagination,
    summary: {
      totalLabAmount: totalLabAmountRounded,
      totalExpenses: 0,
      profit,
      profitPercent,
    },
    meta: {
      expensesUnavailable: true,
      expensesNote: EXPENSE_UNAVAILABLE_NOTE,
    },
  };
}