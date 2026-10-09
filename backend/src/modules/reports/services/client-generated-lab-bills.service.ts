import type { FilterQuery } from "mongoose";
import { LabBill, type ILabBill } from "../../../models/lab-bill.model";
import type {
  ClientGeneratedLabBillRow,
  ClientGeneratedLabBillsResult,
} from "../types/client-generated-lab-bills";
import type { ClientGeneratedLabBillsQuery } from "../validations/client-generated-lab-bills";
import { dayRange, emptyPagination, round2 } from "../utils/report-core";

const EXPORT_LIMIT = 1000;

/**
 * Client Generated Lab Bills — customer (billType "vendor") bills, one row per
 * bill. All price figures come from the bill's own snapshots, never from the
 * current catalog.
 *
 * Inclusion rule (mirrors the "Generated Lab Bills" report): cancelled bills
 * are listed (clearly marked CANCELLED) but are excluded from the totals.
 */
export async function listClientGeneratedLabBills(
  input: ClientGeneratedLabBillsQuery,
): Promise<ClientGeneratedLabBillsResult> {
  const { page, limit, export: isExport } = input;
  const range = dayRange(input.fromDate, input.toDate);

  const filter: FilterQuery<ILabBill> = {
    billType: "vendor",
    status: { $in: ["generated", "cancelled"] },
  };
  if (range) filter.createdAt = range;
  if (input.clientIds?.length) {
    filter.clientId = { $in: input.clientIds };
  }
  if (input.referringDoctorId) {
    filter.referringDoctorId = input.referringDoctorId;
  }

  const sortDir = input.orderBy === "date_asc" ? 1 : -1;
  const bills = await LabBill.find(filter)
    .sort({ createdAt: sortDir })
    .populate("patientId", "patientId fullName")
    .exec();

  if (bills.length === 0) {
    return {
      data: [],
      pagination: emptyPagination(page, limit) as ClientGeneratedLabBillsResult["pagination"],
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

  const rows: ClientGeneratedLabBillRow[] = [];
  let totalBills = 0;
  let totalAmount = 0;
  let totalDiscount = 0;
  let totalNet = 0;
  let totalPaid = 0;
  let totalDue = 0;

  for (const bill of bills) {
    const patient = bill.patientId as unknown as {
      patientId?: string;
      fullName?: string;
    } | null;

    if (bill.status === "generated") {
      totalBills += 1;
      totalAmount += bill.totalAmount;
      totalDiscount += bill.discountAmount;
      totalNet += bill.netAmount;
      totalPaid += bill.paidAmount;
      totalDue += bill.dueAmount;
    }

    rows.push({
      id: bill.id,
      paymentMode: bill.paymentMode ?? "",
      billNumber: bill.billNumber,
      billDate: (bill.createdAt ?? new Date()).toISOString(),
      clientName: bill.clientName ?? "—",
      patientId: patient?.patientId ?? "—",
      patientName: patient?.fullName ?? "—",
      refDoctor: bill.doctorName ?? "—",
      tests: bill.items.map((item) => item.testName).join(", "),
      totalAmount: round2(bill.totalAmount),
      discountAmount: round2(bill.discountAmount),
      netAmount: round2(bill.netAmount),
      paidAmount: round2(bill.paidAmount),
      dueAmount: round2(bill.dueAmount),
      status: bill.status as "generated" | "cancelled",
    });
  }

  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = isExport === "1" ? EXPORT_LIMIT : Math.min(100, Math.max(1, Math.floor(limit)));
  const skip = isExport === "1" ? 0 : (safePage - 1) * safeLimit;
  const data = rows.slice(skip, skip + safeLimit);
  const totalPages = Math.max(1, Math.ceil(rows.length / safeLimit));

  return {
    data,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: rows.length,
      totalPages,
    },
    summary: {
      totalBills,
      totalAmount: round2(totalAmount),
      totalDiscount: round2(totalDiscount),
      totalNet: round2(totalNet),
      totalPaid: round2(totalPaid),
      totalDue: round2(totalDue),
    },
  };
}