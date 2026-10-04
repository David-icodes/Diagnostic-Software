import { Types, type FilterQuery } from "mongoose";
import { ApiError } from "../../utils/api-error";
import { parseLocalDayStart } from "../../utils/date-range";
import { generateBillNumber } from "../../utils/id-generator";
import {
  LabBill,
  type IBillItem,
  type ILabBill,
} from "../../models/lab-bill.model";
import { LabBillPayment } from "../../models/lab-bill-payment.model";
import { LabTest, type ILabTest } from "../../models/lab-test.model";
import { Department } from "../../models/department.model";
import { Patient, type IPatient } from "../../models/patient.model";
import { Doctor } from "../../models/doctor.model";
import { LabClient } from "../../models/lab-client.model";
import { LabSample } from "../../models/lab-sample.model";
import { LabTestResult } from "../../models/lab-test-result.model";
import { recordAudit } from "../audit/audit.service";
import type {
  CollectLabDueInput,
  CreateLabBillInput,
  ModifyLabBillInput,
} from "../../validations/lab-bill";

export interface PaginatedBills {
  data: ILabBill[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Parses a `YYYY-MM-DD` query value into a `Date` at the start of that **local**
 * calendar day. Returns `undefined` for missing/invalid values.
 *
 * Local, not UTC: a date-only business value must not shift a record created in
 * the early local hours back to the previous day.
 */
function parseStartOfDay(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined;
  return parseLocalDayStart(value);
}

interface BillTotals {
  totalAmount: number;
  discountPercent: number;
  discountAmount: number;
  netAmount: number;
  dueAmount: number;
}

// Server-side money math. The client's numbers are never trusted.
export function computeTotals(
  items: Pick<IBillItem, "unitPrice" | "quantity">[],
  discountPercent = 0,
  discountAmount?: number,
  paidAmount = 0,
): BillTotals {
  const totalAmount = round2(
    items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
  );

  const percent = Math.min(100, Math.max(0, discountPercent));
  let effectiveDiscountAmount: number;
  let effectiveDiscountPercent: number;

  if (percent > 0) {
    effectiveDiscountAmount = round2((totalAmount * percent) / 100);
    effectiveDiscountPercent = percent;
  } else if (discountAmount && discountAmount > 0) {
    effectiveDiscountAmount = round2(Math.min(discountAmount, totalAmount));
    effectiveDiscountPercent =
      totalAmount > 0 ? round2((effectiveDiscountAmount / totalAmount) * 100) : 0;
  } else {
    effectiveDiscountAmount = 0;
    effectiveDiscountPercent = 0;
  }

  const netAmount = round2(Math.max(0, totalAmount - effectiveDiscountAmount));
  const paid = round2(Math.max(0, paidAmount));
  if (paid > netAmount) {
    throw new ApiError(400, "Paid amount cannot exceed the net amount");
  }
  const dueAmount = round2(netAmount - paid);

  return {
    totalAmount,
    discountPercent: effectiveDiscountPercent,
    discountAmount: effectiveDiscountAmount,
    netAmount,
    dueAmount,
  };
}

async function buildSnapshotItems(
  items: NonNullable<CreateLabBillInput["items"]>,
  patientType: ILabBill["patientType"],
): Promise<IBillItem[]> {
  const testIds = items.map((item) => new Types.ObjectId(item.testId));
  const [tests, departments] = await Promise.all([
    LabTest.find({ _id: { $in: testIds } }).exec(),
    Department.find().select("name").exec(),
  ]);

  const testMap = new Map(tests.map((test) => [String(test._id), test]));
  const departmentNameMap = new Map(
    departments.map((department) => [String(department._id), department.name]),
  );

  const missing = items.filter((item) => !testMap.has(item.testId));
  if (missing.length > 0) {
    throw new ApiError(422, "One or more selected tests no longer exist");
  }

  const inactive = items.filter((item) => !testMap.get(item.testId)?.active);
  if (inactive.length > 0) {
    const names = inactive.map((item) => testMap.get(item.testId)?.testName ?? item.testId);
    throw new ApiError(422, `Inactive tests cannot be billed: ${names.join(", ")}`);
  }

  return items.map((item) => {
    const test = testMap.get(item.testId)!;
    const unitPrice = resolveBillPrice(test, patientType);
    const quantity = item.quantity;
    return {
      testId: test._id as Types.ObjectId,
      testCode: test.testCode,
      testName: test.testName,
      departmentId: test.departmentId,
      departmentName: departmentNameMap.get(String(test.departmentId)) ?? "Unassigned",
      unitPrice,
      quantity,
      total: round2(unitPrice * quantity),
    };
  });
}

/**
 * Selects the tariff tier from the master for a patient category:
 * - IP patients use the IP price, falling back to the OP price.
 * - Emergency patients use the ER price, falling back to the OP price.
 * - OP/OSP/corporate use the OP price.
 * The returned value is snapshotted onto the bill, so later tariff-master
 * changes never rewrite historical bills.
 */
function resolveBillPrice(
  test: ILabTest,
  patientType: ILabBill["patientType"],
): number {
  if (patientType === "ip") return test.priceIp ?? test.price;
  if (patientType === "emergency") return test.priceEr ?? test.price;
  return test.price;
}

export async function createLabBill(
  userId: string,
  input: CreateLabBillInput,
): Promise<ILabBill> {
  const patient = await Patient.findById(input.patientId).exec();
  if (!patient) {
    throw new ApiError(404, "Patient not found");
  }
  if (patient.status !== "active") {
    throw new ApiError(422, "Billing is not allowed for an inactive patient");
  }

  const billType = input.billType ?? "osp";

  let doctorName: string | undefined;
  if (input.referringDoctorId) {
    const doctor = await Doctor.findById(input.referringDoctorId).exec();
    if (!doctor) {
      throw new ApiError(422, "Referring doctor not found");
    }
    doctorName = doctor.name;
  }

  let clientName: string | undefined;
  if (billType === "vendor") {
    if (!input.clientId) {
      throw new ApiError(
        422,
        "A client is required for a vendor-client lab bill",
      );
    }
    const client = await LabClient.findById(input.clientId).exec();
    if (!client) {
      throw new ApiError(422, "Client not found");
    }
    if (client.active === false) {
      throw new ApiError(422, "Billing is not allowed for an inactive client");
    }
    clientName = client.name;
  }

  const patientType = (input.patientType ?? "osp") as ILabBill["patientType"];
  const snapshotItems = await buildSnapshotItems(input.items, patientType);
  const totals = computeTotals(
    snapshotItems,
    input.discountPercent ?? 0,
    input.discountAmount,
    input.paidAmount ?? 0,
  );

  const billNumber = await generateBillNumber(billType === "vendor" ? "VCB" : "OSP");

  const paidAmount = round2(input.paidAmount ?? 0);

  const bill = await LabBill.create({
    billNumber,
    billType,
    patientId: patient._id,
    patientType,
    clientId: input.clientId ? new Types.ObjectId(input.clientId) : undefined,
    clientName,
    referringDoctorId: input.referringDoctorId
      ? new Types.ObjectId(input.referringDoctorId)
      : undefined,
    doctorName,
    items: snapshotItems,
    ...totals,
    paidAmount,
    paymentMode: input.paymentMode ?? "cash",
    comments: input.comments,
    displayComments: input.displayComments,
    status: input.status === "generated" ? "generated" : "draft",
    createdBy: userId,
  });

  if (paidAmount > 0) {
    await LabBillPayment.create({
      billId: bill._id,
      amount: paidAmount,
      paymentMode: input.paymentMode ?? "cash",
      comments: input.comments,
      collectedAt: bill.createdAt ?? new Date(),
      collectedBy: bill.createdBy,
    });
  }

  await recordAudit({
    user: userId,
    action: "lab_bill.created",
    entityType: "LabBill",
    entity: bill._id,
  });

  return bill;
}

/**
 * Modifies the billing contents of a bill (items + discount + payment meta).
 * Financial safety:
 * - Cancelled bills can never be modified.
 * - A `generated` bill can only be modified while it has no payments.
 * - All prices/totals are re-computed server-side from the current catalog
 *   (price snapshots are refreshed for the modified items).
 * - The original document is updated in place; an audit entry is recorded.
 * Patient, bill number and bill type are intentionally fixed.
 */
export async function modifyLabBill(
  userId: string,
  billId: string,
  input: ModifyLabBillInput,
): Promise<ILabBill> {
  if (!Types.ObjectId.isValid(billId)) {
    throw new ApiError(400, "Invalid bill ID");
  }

  const bill = await LabBill.findById(billId).exec();
  if (!bill) {
    throw new ApiError(404, "Bill not found");
  }
  if (bill.status === "cancelled") {
    throw new ApiError(422, "A cancelled bill cannot be modified");
  }
  if (bill.status === "generated" && bill.paidAmount > 0) {
    throw new ApiError(
      422,
      "This bill already has payments and cannot be modified",
    );
  }

  if (input.referringDoctorId !== undefined) {
    if (input.referringDoctorId) {
      const doctor = await Doctor.findById(input.referringDoctorId).exec();
      if (!doctor) {
        throw new ApiError(422, "Referring doctor not found");
      }
      bill.referringDoctorId = new Types.ObjectId(input.referringDoctorId);
      bill.doctorName = doctor.name;
    } else {
      bill.referringDoctorId = undefined;
      bill.doctorName = undefined;
    }
  }

  const snapshotItems = await buildSnapshotItems(input.items, bill.patientType);

  // A test that already produced a sample or a result stays on the bill:
  // dropping it would orphan those records and silently rewrite history.
  const nextTestIds = new Set(snapshotItems.map((item) => String(item.testId)));
  const removedTestIds = bill.items
    .map((item) => String(item.testId))
    .filter((testId) => !nextTestIds.has(testId));
  if (removedTestIds.length > 0) {
    const billId = bill._id;
    const [sampleHits, resultHits] = await Promise.all([
      LabSample.find({ billId, testId: { $in: removedTestIds } })
        .select("testId")
        .lean()
        .exec(),
      LabTestResult.find({ billId, testId: { $in: removedTestIds } })
        .select("testId")
        .lean()
        .exec(),
    ]);
    const lockedTestIds = new Set([
      ...sampleHits.map((sample) => String(sample.testId)),
      ...resultHits.map((result) => String(result.testId)),
    ]);
    if (lockedTestIds.size > 0) {
      const lockedNames = await LabTest.find({ _id: { $in: [...lockedTestIds] } })
        .select("testName")
        .lean()
        .exec();
      const names = lockedNames.map((test) => test.testName).join(", ");
      throw new ApiError(
        422,
        lockedTestIds.size === 1
          ? `${names} already has a sample or a result on this bill and cannot be removed`
          : `${names} already have samples or results on this bill and cannot be removed`,
      );
    }
  }

  const totals = computeTotals(
    snapshotItems,
    input.discountPercent ?? 0,
    input.discountAmount,
    bill.paidAmount ?? 0,
  );

  bill.items = snapshotItems;
  bill.totalAmount = totals.totalAmount;
  bill.discountPercent = totals.discountPercent;
  bill.discountAmount = totals.discountAmount;
  bill.netAmount = totals.netAmount;
  bill.dueAmount = totals.dueAmount;
  bill.paymentMode = (input.paymentMode ?? bill.paymentMode) as ILabBill["paymentMode"];
  bill.comments = input.comments;
  bill.displayComments = input.displayComments;
  bill.updatedBy = new Types.ObjectId(userId);
  await bill.save();

  await recordAudit({
    user: userId,
    action: "lab_bill.modified",
    entityType: "LabBill",
    entity: bill._id,
  });

  return LabBill.findById(bill._id)
    .populate("patientId", "patientId fullName gender dateOfBirth age mobile")
    .populate("referringDoctorId", "name qualification specialization")
    .populate("clientId", "clientCode name")
    .exec() as Promise<ILabBill>;
}

export async function getLabBill(id: string): Promise<ILabBill> {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid bill ID");
  }
  const bill = await LabBill.findById(id)
    .populate("patientId", "patientId fullName gender dateOfBirth age mobile")
    .populate("referringDoctorId", "name qualification specialization")
    .populate("clientId", "clientCode name")
    .exec();
  if (!bill) {
    throw new ApiError(404, "Bill not found");
  }
  return bill;
}

export async function listLabBills({
  page = 1,
  limit = 20,
  search,
  status,
  fromDate,
  toDate,
  billType,
}: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  billType?: string;
} = {}): Promise<PaginatedBills> {
  const filter: FilterQuery<ILabBill> = {};

  if (status === "draft" || status === "generated") {
    filter.status = status;
  }

  if (billType === "osp" || billType === "vendor") {
    filter.billType = billType;
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

  const keyword = search?.trim();
  if (keyword) {
    const escaped = escapeRegExp(keyword);
    // A keyword may match a bill number, a referring doctor, or a patient
    // name. Patients are matched first so their IDs can be folded into the
    // `$or` — without this, searching by patient name silently returns nothing.
    const patients = await Patient.find({
      fullName: { $regex: escaped, $options: "i" },
    })
      .select("_id")
      .limit(100)
      .exec();
    filter.$or = [
      { billNumber: { $regex: escaped, $options: "i" } },
      { doctorName: { $regex: escaped, $options: "i" } },
    ];
    if (patients.length > 0) {
      filter.$or.push({ patientId: { $in: patients.map((patient) => patient._id) } });
    }
  }

  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const skip = (safePage - 1) * safeLimit;

  const [total, data] = await Promise.all([
    LabBill.countDocuments(filter),
    LabBill.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate("patientId", "patientId fullName gender dateOfBirth age mobile")
      .exec(),
  ]);

  return {
    data,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getLabBillByBillNumber(billNumber: string): Promise<ILabBill> {
  const keyword = billNumber.trim();
  if (!keyword) {
    throw new ApiError(400, "Bill number is required");
  }
  const bill = await LabBill.findOne({ billNumber: escapeRegExp(keyword) })
    .populate("patientId", "patientId fullName gender dateOfBirth age mobile")
    .populate("referringDoctorId", "name qualification specialization")
    .populate("clientId", "clientCode name")
    .populate({ path: "payments", select: "amount discountAmount paymentMode comments collectedAt collectedBy", options: { sort: { collectedAt: 1 } } })
    .exec();
  if (!bill) {
    throw new ApiError(404, "Bill not found");
  }
  return bill;
}

/**
 * Cancels a bill by setting its status to `cancelled` and storing the audit
 * trail. The document is never deleted — the original financial record stays
 * available for history/reports.
 */
export async function cancelLabBill(
  userId: string,
  billId: string,
  remarks: string,
): Promise<ILabBill> {
  if (!Types.ObjectId.isValid(billId)) {
    throw new ApiError(400, "Invalid bill ID");
  }

  const bill = await LabBill.findById(billId).exec();
  if (!bill) {
    throw new ApiError(404, "Bill not found");
  }
  if (bill.status === "cancelled") {
    throw new ApiError(409, "This bill has already been cancelled");
  }

  bill.status = "cancelled";
  bill.cancelledAt = new Date();
  bill.cancelledBy = new Types.ObjectId(userId);
  bill.cancellationRemarks = remarks.trim();
  bill.updatedBy = new Types.ObjectId(userId);
  await bill.save();

  await recordAudit({
    user: userId,
    action: "lab_bill.cancelled",
    entityType: "LabBill",
    entity: bill._id,
  });

  return bill;
}

export interface DueBillsResult extends PaginatedBills {
  data: ILabBill[];
}

export async function listDueBills({
  page = 1,
  limit = 20,
  fromDate,
  toDate,
  patientId,
  patientName,
  billNumber,
}: {
  page?: number;
  limit?: number;
  fromDate?: string;
  toDate?: string;
  patientId?: string;
  patientName?: string;
  billNumber?: string;
} = {}): Promise<DueBillsResult> {
  const filter: FilterQuery<ILabBill> = {
    status: "generated",
    dueAmount: { $gt: 0 },
  };

  const keyword = billNumber?.trim();
  if (keyword) {
    filter.billNumber = { $regex: escapeRegExp(keyword), $options: "i" };
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

  const patientKeyword = patientId?.trim();
  const patientNameKeyword = patientName?.trim();
  if (patientKeyword || patientNameKeyword) {
    const patientFilter: FilterQuery<IPatient> = {};
    if (patientKeyword) {
      patientFilter.patientId = { $regex: escapeRegExp(patientKeyword), $options: "i" };
    }
    if (patientNameKeyword) {
      patientFilter.fullName = { $regex: escapeRegExp(patientNameKeyword), $options: "i" };
    }
    const patients = await Patient.find(patientFilter).select("_id").exec();
    const ids = patients.map((patient) => patient._id);
    if (ids.length === 0) {
      return { data: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } };
    }
    filter.patientId = { $in: ids };
  }

  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));

  const [total, data] = await Promise.all([
    LabBill.countDocuments(filter),
    LabBill.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate("patientId", "patientId fullName gender dateOfBirth age mobile")
      .exec(),
  ]);

  return {
    data,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
}

/**
 * Collects an amount against an outstanding balance. A concession (discount)
 * granted at collection time is validated and applied before the payment, and
 * both are recorded on a LabBillPayment row. `paidAmount`/`dueAmount` are
 * never silently overwritten without a collection history entry.
 */
export async function collectLabDue(
  userId: string,
  billId: string,
  input: CollectLabDueInput,
): Promise<ILabBill> {
  if (!Types.ObjectId.isValid(billId)) {
    throw new ApiError(400, "Invalid bill ID");
  }

  const bill = await LabBill.findById(billId).exec();
  if (!bill) {
    throw new ApiError(404, "Bill not found");
  }
  if (bill.status !== "generated") {
    throw new ApiError(
      422,
      bill.status === "cancelled"
        ? "This bill has been cancelled and cannot receive payment"
        : "This bill is not eligible for due collection",
    );
  }

  const outstanding = round2(bill.dueAmount);
  if (outstanding <= 0) {
    throw new ApiError(422, "This bill has no outstanding balance");
  }

  const discount = round2(input.discountAmount ?? 0);
  if (discount > outstanding) {
    throw new ApiError(
      422,
      `Discount cannot exceed the outstanding balance of ₹${outstanding.toFixed(2)}`,
    );
  }

  const payable = round2(outstanding - discount);
  const amount = round2(input.amount);
  if (amount > payable) {
    throw new ApiError(
      422,
      `Amount cannot exceed the payable balance of ₹${payable.toFixed(2)}`,
    );
  }

  await LabBillPayment.create({
    billId: bill._id,
    amount,
    discountAmount: discount,
    paymentMode: input.paymentMode,
    comments: input.comments,
    collectedAt: new Date(),
    collectedBy: userId,
  });

  // A collection-time concession increases the bill's total discount and
  // reduces its net — keeping net == total - discount and due == net - paid.
  if (discount > 0) {
    bill.discountAmount = round2(bill.discountAmount + discount);
    bill.discountPercent = round2(
      bill.totalAmount > 0 ? (bill.discountAmount / bill.totalAmount) * 100 : 0,
    );
    bill.netAmount = round2(Math.max(0, bill.totalAmount - bill.discountAmount));
  }
  bill.paidAmount = round2(bill.paidAmount + amount);
  bill.dueAmount = round2(bill.netAmount - bill.paidAmount);
  bill.paymentMode = input.paymentMode as ILabBill["paymentMode"];
  bill.updatedBy = new Types.ObjectId(userId);
  await bill.save();

  await recordAudit({
    user: userId,
    action: "lab_bill.payment_collected",
    entityType: "LabBill",
    entity: bill._id,
  });

  return LabBill.findById(bill._id)
    .populate("patientId", "patientId fullName gender dateOfBirth age mobile")
    .populate("referringDoctorId", "name qualification specialization")
    .populate("clientId", "clientCode name")
    .populate({ path: "payments", options: { sort: { collectedAt: 1 } } })
    .exec() as Promise<ILabBill>;
}