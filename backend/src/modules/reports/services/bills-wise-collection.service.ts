import type { FilterQuery } from "mongoose";
import { LabBill, type ILabBill, PAYMENT_MODES } from "../../../models/lab-bill.model";
import { LabBillPayment, type ILabBillPayment } from "../../../models/lab-bill-payment.model";
import { Patient } from "../../../models/patient.model";
import { isValidObjectId } from "../../../utils/object-id";
import type { BillsWiseCollectionQuery } from "../validations/bills-wise-collection";
import {
  dayRange,
  emptyPagination,
  escapeRegExp,
  round2,
  slicePage,
  splitCsv,
} from "../utils/report-core";
import {
  payModeLabel,
  patientTypeLabel,
  REPORT_PATIENT_TYPE_MAP,
} from "../utils/report-labels";
import type {
  BillWiseCollectionResult,
  BillWiseCollectionRow,
  BillWiseCollectionSummary,
} from "../types/bills-wise-collection";

/**
 * Bill Wise Collection Report — one row per LabBillPayment, joined with its
 * bill and patient. `collectedAt` is the authoritative collection date.
 * Cancelled-bill payments are excluded unless `withCancelled` is set.
 * Money columns always come from the persisted payment records.
 */
export async function listBillsWiseCollection(
  input: BillsWiseCollectionQuery,
): Promise<BillWiseCollectionResult> {
  const { page, limit, orderBy } = input;
  const isExport = input.export === "1";
  const withCancelled = input.withCancelled === "1";

  const billFilter: FilterQuery<ILabBill> = {};
  if (!withCancelled) {
    billFilter.status = "generated";
  }

  const billTypes = splitCsv(input.billType);
  if (billTypes && billTypes.length > 0) {
    billFilter.billType = { $in: billTypes };
  }

  const patientTypes = splitCsv(input.patientTypes);
  if (patientTypes && patientTypes.length > 0) {
    const stored = patientTypes.map((value) => REPORT_PATIENT_TYPE_MAP[value] ?? value);
    billFilter.patientType = { $in: stored };
  }

  const patientKeyword = input.patientId?.trim();
  if (patientKeyword) {
    const patients = await Patient.find({
      patientId: { $regex: escapeRegExp(patientKeyword), $options: "i" },
    })
      .select("_id")
      .exec();
    const ids = patients.map((p) => p._id);
    if (ids.length === 0) {
      return emptyResult(page, limit, withCancelled);
    }
    billFilter.patientId = { $in: ids };
  }

  const paymentFilter: FilterQuery<ILabBillPayment> = {};
  const range = dayRange(input.fromDate, input.toDate);
  if (range) paymentFilter.collectedAt = range;

  const collectedBys = splitCsv(input.collectedBy)?.filter(isValidObjectId);
  if (collectedBys && collectedBys.length > 0) {
    paymentFilter.collectedBy = { $in: collectedBys };
  }

  const payModes = splitCsv(input.payMode);
  if (payModes && payModes.length > 0) {
    paymentFilter.paymentMode = { $in: payModes };
  }

  // Narrow payments to bills that satisfy the bill-level filters.
  const matchingBillIds = await LabBill.distinct("_id", billFilter).exec();
  if (matchingBillIds.length === 0) {
    return emptyResult(page, limit, withCancelled);
  }
  paymentFilter.billId = { $in: matchingBillIds };

  const payments = await LabBillPayment.find(paymentFilter)
    .sort({ collectedAt: orderBy === "date_asc" ? 1 : -1 })
    .select("billId amount paymentMode collectedAt collectedBy")
    .populate({
      path: "billId",
      select: "billNumber billType patientType doctorName",
      populate: { path: "patientId", select: "patientId fullName" },
    })
    .populate("collectedBy", "name")
    .exec();

  const summary = await buildSummary(paymentFilter);
  const rows: BillWiseCollectionRow[] = payments.map((payment) => {
    const bill = payment.billId as unknown as {
      billNumber?: string;
      billType?: string;
      patientType?: string;
      doctorName?: string;
      patientId?: { patientId?: string; fullName?: string } | null;
    } | null;
    const collector = payment.collectedBy as unknown as { name?: string } | null;

    const modeBreakdown: Record<string, number> = {};
    for (const mode of PAYMENT_MODES) modeBreakdown[mode] = 0;
    modeBreakdown[payment.paymentMode] = round2(payment.amount);

    return {
      id: payment.id,
      billTime: (payment.collectedAt as Date).toISOString(),
      billNumber: bill?.billNumber ?? "—",
      billFor: patientTypeLabel(bill?.patientType),
      patientId: bill?.patientId?.patientId ?? "—",
      patientName: bill?.patientId?.fullName ?? "—",
      refDoctor: bill?.doctorName ?? "—",
      paidAmount: round2(payment.amount),
      modeBreakdown,
      payMode: payModeLabel(payment.paymentMode),
      collectedBy: collector?.name ?? "—",
    };
  });

  const { data, pagination } = slicePage(rows, summary.totalRecords, page, limit, isExport);

  return {
    data,
    pagination,
    summary,
    meta: { withCancelled },
  };
}

async function buildSummary(
  paymentFilter: FilterQuery<ILabBillPayment>,
): Promise<BillWiseCollectionSummary> {
  const rows = await LabBillPayment.aggregate<{
    _id: null;
    totalRecords: number;
    totalPaid: number;
    modes: { k: string; v: number }[];
  }>([
    { $match: paymentFilter },
    {
      $group: {
        _id: null,
        totalRecords: { $sum: 1 },
        totalPaid: { $sum: "$amount" },
        modes: {
          $push: {
            k: "$paymentMode",
            v: "$amount",
          },
        },
      },
    },
  ]);

  const row = rows[0];
  const modes: Record<string, number> = {};
  for (const mode of PAYMENT_MODES) modes[mode] = 0;
  if (row) {
    for (const entry of row.modes) {
      modes[entry.k] = round2((modes[entry.k] ?? 0) + entry.v);
    }
  }

  return {
    totalRecords: row?.totalRecords ?? 0,
    totalPaid: round2(row?.totalPaid ?? 0),
    modeTotals: modes,
  };
}

function emptyResult(
  page: number,
  limit: number,
  withCancelled: boolean,
): BillWiseCollectionResult {
  const modes: Record<string, number> = {};
  for (const mode of PAYMENT_MODES) modes[mode] = 0;
  return {
    data: [],
    pagination: emptyPagination(page, limit),
    summary: { totalRecords: 0, totalPaid: 0, modeTotals: modes },
    meta: { withCancelled },
  };
}