import type { FilterQuery } from "mongoose";
import { DoctorCommission, type IDoctorCommission } from "../../../models/doctor-commission.model";
import { LabBill, type ILabBill } from "../../../models/lab-bill.model";
import { Patient } from "../../../models/patient.model";
import type {
  ReferralDoctorCommissionResult,
  ReferralDoctorCommissionRow,
} from "../types/referral-doctor-commission";
import type { ReferralDoctorCommissionQuery } from "../validations/referral-doctor-commission";
import { dayRange, emptyPagination, escapeRegExp, round2, slicePage } from "../utils/report-core";

/**
 * Claim types are not modeled anywhere in the LIS yet. The filter therefore
 * supports only "All"; this is communicated in the report meta so the control
 * is never silently decorative. Extend this list when claims are introduced.
 */
export const SUPPORTED_CLAIM_TYPES: string[] = ["all"];

const PATIENT_TYPE_MAP: Record<string, string> = {
  gp: "osp",
  op: "op",
  ip: "ip",
};

/**
 * Resolves the commission for a test in a doctor's commission set.
 * Resolution order: exact test mapping (fixed amount wins over percentage) →
 * department mapping → doctor default. Returns `null` when no active mapping
 * exists for the doctor (missing config).
 */
function resolveRate(
  commissions: IDoctorCommission[] | undefined,
  testId: string,
  departmentId: string,
):
  | { kind: "amount"; amount: number }
  | { kind: "percent"; percent: number }
  | null {
  if (!commissions || commissions.length === 0) return null;
  const byTest = commissions.find(
    (c) => c.scope === "test" && String(c.testId) === testId,
  );
  if (byTest) {
    if (byTest.commissionAmount !== undefined && byTest.commissionAmount > 0) {
      return { kind: "amount", amount: byTest.commissionAmount };
    }
    return { kind: "percent", percent: byTest.commissionPercent };
  }
  const byDepartment = commissions.find(
    (c) => c.scope === "department" && String(c.departmentId) === departmentId,
  );
  if (byDepartment) return { kind: "percent", percent: byDepartment.commissionPercent };
  const byDoctor = commissions.find((c) => c.scope === "doctor");
  return byDoctor
    ? { kind: "percent", percent: byDoctor.commissionPercent }
    : null;
}

/**
 * Referral Doctor Commission — "Lab - Dr Referral - Bill wise".
 *
 * Commissions are always calculated from the historical price snapshots stored
 * on each bill; today's catalog prices are never used to re-price old bills.
 * The matched segment (department/test filters) is scaled to the bill's actual
 * net and paid amounts, so discounts and partial payments are respected.
 *
 * Commission mappings come from the configured DoctorCommission records
 * (test > department > doctor resolution). When a doctor has no active mapping
 * the affected amount is never treated as 0%: the row is flagged
 * `configMissing` and its commission amount is reported as missing.
 */
export async function listReferralDoctorCommission(
  input: ReferralDoctorCommissionQuery,
): Promise<ReferralDoctorCommissionResult> {
  const { page, limit, export: isExport } = input;
  const range = dayRange(input.fromDate, input.toDate);

  const filter: FilterQuery<ILabBill> = { status: "generated" };
  if (range) filter.createdAt = range;

  let resolvedTypes: string[] = ["osp", "op", "ip"];
  if (input.commissionBasis === "cons_op_ip") {
    // "Only OP/IP Cons. Dr Wise" — the consulting doctor view applies to
    // OP and IP patients only; the GP checkbox is not applicable here.
    resolvedTypes = ["op", "ip"];
  } else if (input.patientTypes?.length) {
    resolvedTypes = input.patientTypes.map((t) => PATIENT_TYPE_MAP[t]);
  }
  filter.patientType = { $in: resolvedTypes };

  if (input.doctorIds?.length) {
    filter.referringDoctorId = { $in: input.doctorIds };
  }

  const patientIdKeyword = input.patientId?.trim();
  if (patientIdKeyword) {
    const patients = await Patient.find({
      patientId: { $regex: escapeRegExp(patientIdKeyword), $options: "i" },
    })
      .select("_id")
      .exec();
    if (patients.length === 0) {
      return {
        data: [],
        pagination: emptyPagination(page, limit) as ReferralDoctorCommissionResult["pagination"],
        summary: { totalBills: 0, totalNet: 0, totalPaid: 0, totalCommission: 0, missingConfigs: 0 },
        meta: {
          commissionBasis: input.commissionBasis,
          amountBasis: input.amountBasis,
          resolvedTypes,
          claimTypes: SUPPORTED_CLAIM_TYPES,
        },
      };
    }
    filter.patientId = { $in: patients.map((p) => p._id) };
  }

  const bills = await LabBill.find(filter).sort({ createdAt: 1 }).exec();
  if (bills.length === 0) {
    return {
      data: [],
      pagination: emptyPagination(page, limit) as ReferralDoctorCommissionResult["pagination"],
      summary: { totalBills: 0, totalNet: 0, totalPaid: 0, totalCommission: 0, missingConfigs: 0 },
      meta: {
        commissionBasis: input.commissionBasis,
        amountBasis: input.amountBasis,
        resolvedTypes,
        claimTypes: SUPPORTED_CLAIM_TYPES,
      },
    };
  }

  const doctorIds = [
    ...new Set(
      bills
        .map((bill) => bill.referringDoctorId?.toString())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const commissionsByDoctor = new Map<string, IDoctorCommission[]>();
  if (doctorIds.length > 0) {
    const commissionDocs = await DoctorCommission.find({
      doctorId: { $in: doctorIds },
      active: true,
    });
    for (const doc of commissionDocs) {
      const key = String(doc.doctorId);
      const list = commissionsByDoctor.get(key) ?? [];
      list.push(doc);
      commissionsByDoctor.set(key, list);
    }
  }

  const patientIds = bills.map((b) => b.patientId);
  const patients = await Patient.find({ _id: { $in: patientIds } })
    .select("patientId fullName")
    .exec();
  const patientMap = new Map<string, { patientId?: string; fullName?: string }>();
  for (const patient of patients) {
    patientMap.set(String(patient._id), patient);
  }

  const rows: ReferralDoctorCommissionRow[] = [];
  for (const bill of bills) {
    const matchedItems = bill.items.filter(
      (item) =>
        (!input.departmentIds?.length || input.departmentIds.includes(String(item.departmentId))) &&
        (!input.testIds?.length || input.testIds.includes(String(item.testId))),
    );
    if (matchedItems.length === 0) continue;

    const segmentTotal = matchedItems.reduce((sum, item) => sum + item.total, 0);
    const netRatio = bill.totalAmount > 0 ? Math.min(1, bill.netAmount / bill.totalAmount) : 0;
    const segmentNet = round2(segmentTotal * netRatio);
    const paidRatio = bill.netAmount > 0 ? Math.min(1, bill.paidAmount / bill.netAmount) : 0;
    const segmentPaid = round2(segmentNet * paidRatio);
    const basisAmount = input.amountBasis === "net" ? segmentNet : segmentPaid;

    const commissions = commissionsByDoctor.get(String(bill.referringDoctorId));

    let commission = 0;
    let configMissing = false;
    for (const item of matchedItems) {
      const resolved = resolveRate(
        commissions,
        String(item.testId),
        String(item.departmentId),
      );
      if (resolved === null) {
        configMissing = true;
        continue;
      }
      if (resolved.kind === "amount") {
        commission += resolved.amount;
      } else if (segmentTotal > 0) {
        commission +=
          (item.total / segmentTotal) * basisAmount * (resolved.percent / 100);
      }
    }

    let rateUsed: number | null = null;
    if (!configMissing && matchedItems.length === 1) {
      const resolved = resolveRate(
        commissions,
        String(matchedItems[0].testId),
        String(matchedItems[0].departmentId),
      );
      rateUsed = resolved?.kind === "percent" ? resolved.percent : null;
    }

    const patient = patientMap.get(String(bill.patientId));
    rows.push({
      id: bill.id,
      billNumber: bill.billNumber,
      billDate: (bill.createdAt ?? new Date()).toISOString(),
      patientId: patient?.patientId ?? "—",
      patientName: patient?.fullName ?? "—",
      patientType: bill.patientType,
      doctorName: bill.doctorName ?? "—",
      tests: matchedItems.map((item) => item.testName).join(", "),
      segmentNet,
      segmentPaid,
      commissionAmount: configMissing ? null : round2(commission),
      rateUsed,
      configMissing,
    });
  }

  const totalNet = rows.reduce((sum, row) => sum + row.segmentNet, 0);
  const totalPaid = rows.reduce((sum, row) => sum + row.segmentPaid, 0);
  const totalCommission = rows.reduce(
    (sum, row) => sum + (row.commissionAmount ?? 0),
    0,
  );
  const missingConfigs = rows.reduce((count, row) => count + (row.configMissing ? 1 : 0), 0);

  const { data, pagination } = slicePage(rows, rows.length, page, limit, isExport === "1");

  return {
    data,
    pagination,
    summary: {
      totalBills: rows.length,
      totalNet: round2(totalNet),
      totalPaid: round2(totalPaid),
      totalCommission: round2(totalCommission),
      missingConfigs,
    },
    meta: {
      commissionBasis: input.commissionBasis,
      amountBasis: input.amountBasis,
      resolvedTypes,
      claimTypes: SUPPORTED_CLAIM_TYPES,
    },
  };
}