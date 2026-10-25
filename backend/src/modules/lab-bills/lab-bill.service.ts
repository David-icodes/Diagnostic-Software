import {createHash} from "node:crypto";
import { patientCodePattern } from "../../utils/patient-code";
import mongoose, { Types, type FilterQuery } from "mongoose";
import { ApiError } from "../../utils/api-error";
import { parseLocalDayStart } from "../../utils/date-range";
import { generateBillNumber } from "../../utils/id-generator";
import { hasRecordedPatientAge } from "../../utils/patient-age";
import {
  LabBill,
  type IBillItem,
  type ILabBill,
} from "../../models/lab-bill.model";
import { LabBillPayment } from "../../models/lab-bill-payment.model";
import { LabTest, type ILabTest } from "../../models/lab-test.model";
import { LabPackage } from "../../models/lab-package.model";
import { Department } from "../../models/department.model";
import { Patient, type IPatient } from "../../models/patient.model";
import { Doctor } from "../../models/doctor.model";
import { LabClientTariff } from "../../models/lab-client-tariff.model";
import { LabClient } from "../../models/lab-client.model";
import { OutsideLab } from "../../models/outside-lab.model";
import { LabSample } from "../../models/lab-sample.model";
import { AuditLog } from "../../models/audit-log.model";
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
  preserveExistingPayments = false,
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
  if (paid > netAmount && !preserveExistingPayments) {
    throw new ApiError(400, "Paid amount cannot exceed the net amount");
  }
  // Received payments remain unchanged when a bill is revised. Existing due
  // storage is non-negative; any overpayment is derived from paid minus net.
  const dueAmount = round2(Math.max(0, netAmount - paid));

  return {
    totalAmount,
    discountPercent: effectiveDiscountPercent,
    discountAmount: effectiveDiscountAmount,
    netAmount,
    dueAmount,
  };
}

export async function buildSnapshotItems(
  items: NonNullable<CreateLabBillInput["items"]>,
  patientType: ILabBill["patientType"],
  previous: IBillItem[] = [],
  clientId?: string,
): Promise<IBillItem[]> {
  const packageMap=new Map<string,{id:string;name:string;price:number}>();
  const expanded:typeof items=[];
  for(const item of items){
    if(!item.packageId){expanded.push(item);continue;}
    if(clientId)throw new ApiError(422,"Vendor package tariffs are not configured; select individually tariffed tests");
    const pack=await LabPackage.findOne({_id:item.packageId,active:true}).exec();
    if(!pack||!pack.items.length)throw new ApiError(422,"Select an active package containing laboratory tests");
    for(const [index,member] of pack.items.entries()){
      const id=String(member.testId);if(packageMap.has(id))throw new ApiError(422,"Selected packages contain overlapping investigations");
      packageMap.set(id,{id:String(pack._id),name:pack.name,price:index===0?pack.amount:0});
      expanded.push({testId:id,quantity:item.quantity});
    }
  }
  items=expanded;
  if(new Set(items.map(item=>item.testId)).size!==items.length)throw new ApiError(422,"A test cannot be charged individually and through a package in the same bill");
  const testIds = items.map((item) => new Types.ObjectId(item.testId));
  const [tests, departments] = await Promise.all([
    LabTest.find({ _id: { $in: testIds } }).exec(),
    Department.find().select("name active").exec(),
  ]);

  const clientTariffs = clientId ? await LabClientTariff.find({clientId, testId:{$in:testIds},active:true}).exec() : [];
  const tariffMap = new Map(clientTariffs.map(row=>[String(row.testId),row]));
  if(clientId && items.some(item=>!tariffMap.has(item.testId))) throw new ApiError(422,"No active client-specific tariff exists for one or more selected tests");
  const testMap = new Map(tests.map((test) => [String(test._id), test]));
  const departmentNameMap = new Map(
    departments.map((department) => [String(department._id), department.name]),
  );

  const missing = items.filter((item) => !testMap.has(item.testId));
  if (missing.length > 0) {
    throw new ApiError(422, "One or more selected tests no longer exist");
  }

  // Active packages authorize their explicit saved membership; individual selection still requires active tests.
  const inactive = items.filter((item) => !packageMap.has(item.testId) && !testMap.get(item.testId)?.active);
  if (inactive.length > 0) {
    const names = inactive.map((item) => testMap.get(item.testId)?.testName ?? item.testId);
    throw new ApiError(422, `Inactive tests cannot be billed: ${names.join(", ")}`);
  }

  const outsideIds = [...new Set(items.filter((item) => item.out !== false && item.outsideLabId).map((item) => item.outsideLabId!))];
  const centres = outsideIds.length ? await OutsideLab.find({ _id: { $in: outsideIds } }).exec() : [];
  const centreMap = new Map(centres.map((centre) => [String(centre._id), centre]));
  const previousMap = new Map(previous.map((item) => [String(item.testId), item]));
  for (const item of items) {
    if (!item.outsideLabId || item.out === false) continue;
    const centre = centreMap.get(item.outsideLabId);
    const retained = String(previousMap.get(item.testId)?.outsideLabId ?? "") === item.outsideLabId;
    if (!centre || (!centre.active && !retained)) throw new ApiError(422, "Select an active outside lab for each outside test");
  }
  const assignedAt = new Date();
  return items.map((item) => {
    const test = testMap.get(item.testId)!;
    const tariff = tariffMap.get(item.testId);
    if(tariff && String(tariff.departmentId)!==String(test.departmentId))throw new ApiError(422,"Client tariff department does not match the selected test");
    const packageEntry=packageMap.get(item.testId);
    if (packageEntry && !departments.some(department => String(department._id) === String(test.departmentId))) throw new ApiError(422, "A package test has a missing department");
    const unitPrice = packageEntry ? packageEntry.price : tariff ? tariff.price : resolveBillPrice(test, patientType);
    const quantity = item.quantity;
    const old = previousMap.get(item.testId);
    const explicit = item.out !== undefined || item.outsideLabId !== undefined;
    const outsideId = explicit ? (item.out === false ? null : item.outsideLabId ?? null) : old?.outsideLabId;
    const retained = outsideId && String(old?.outsideLabId ?? "") === String(outsideId);

    return {
      ...(packageEntry?{packageId:new Types.ObjectId(packageEntry.id),packageName:packageEntry.name,packageAmount:packageEntry.price}:{}),
      testId: test._id as Types.ObjectId,
      testCode: test.testCode,
      testName: test.testName,
      ...(old?.activeCollectionId ? { activeCollectionId: old.activeCollectionId } : {}),
      ...(old?.parameterVersionIds ? { parameterVersionIds: [...old.parameterVersionIds] } : {}),
      departmentId: test.departmentId,
      departmentName: departmentNameMap.get(String(test.departmentId)) ?? "Unassigned",
      unitPrice,
      quantity,
      total: round2(unitPrice * quantity),
      ...(outsideId === undefined ? {} : {
        outsideLabId: outsideId ? new Types.ObjectId(String(outsideId)) : null,
        outsideLabName: outsideId ? centreMap.get(String(outsideId))?.name ?? old?.outsideLabName : undefined,
        sentOutAt: outsideId ? (retained ? old?.sentOutAt : assignedAt) : null,
      }),
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
  // OSP/vendor registration is age-bearing. Reject at the billing boundary as
  // well as in the form so an API caller cannot bypass the mandatory field.
  // A valid DOB is accepted for infants whose completed years are zero.
  if (!hasRecordedPatientAge(patient)) {
    throw new ApiError(
      422,
      "Age is required for an OSP patient. Enter a valid age (1-150 years) or a date of birth for a patient under one year.",
    );
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
  const snapshotItems = await buildSnapshotItems(input.items, patientType, [], billType === "vendor" ? input.clientId : undefined);
  const totals = computeTotals(
    snapshotItems,
    input.discountPercent ?? 0,
    input.discountAmount,
    input.paidAmount ?? 0,
  );

  const billNumber = await generateBillNumber(billType === "vendor" ? "VCB" : "DIAG");

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
  options: { allowPaymentCollection?: boolean; allowPriceOverride?: boolean; allowClientChange?: boolean; requireRecordedAge?: boolean; vendorClientId?: string } = {},
): Promise<ILabBill> {
  if (!Types.ObjectId.isValid(billId)) {
    throw new ApiError(400, "Invalid bill ID");
  }

  await mongoose.connection.transaction(async session => {
    const bill = await LabBill.findById(billId).session(session).exec();
    if (!bill) {
      throw new ApiError(404, "Bill not found");
    }
    if(options.vendorClientId){
      if(bill.billType!=="vendor" || String(bill.clientId)!==options.vendorClientId)throw new ApiError(404,"Bill not found");
      // Vendors amend investigations, never the laboratory's financial settings.
      input={...input,discountPercent:bill.discountPercent,discountAmount:undefined,paymentMode:bill.paymentMode,comments:bill.comments,displayComments:bill.displayComments};
    }
    if(input.payment){
      if(bill.status!=="generated")throw new ApiError(422,"Only a generated, non-cancelled bill can receive payment.");
      if(options.vendorClientId || !options.allowPaymentCollection)throw new ApiError(403,"Permission denied: billing.collect_due");
      const previous=bill.amendments?.find(row=>row.paymentRequestId===input.payment!.requestId);
      if(previous){
        const fingerprint=createHash("sha256").update(JSON.stringify(input)).digest("hex");
        if(String(previous.changedBy)!==userId||previous.paymentFingerprint!==fingerprint)throw new ApiError(409,"Payment request was already used. Reload the bill before making further changes.");
        return;
      }
    }
    if (bill.status === "cancelled") {
      throw new ApiError(422, "A cancelled bill cannot be modified");
    }
    if(options.requireRecordedAge && bill.billType!=="vendor"){
      const patient=await Patient.findById(bill.patientId).session(session).exec();
      if(!patient || !hasRecordedPatientAge(patient))throw new ApiError(422,"Age is required for an OSP patient before modifying a bill.");
    }
    let clientChange:{previousClientId:string;previousClientName?:string;clientId:string;clientName:string}|undefined;
    if(input.clientId!==undefined && input.clientId!==String(bill.clientId)){
      if(!options.allowClientChange)throw new ApiError(403,"Only an administrator may change a bill's vendor client");
      if(bill.billType!=="vendor")throw new ApiError(422,"Only vendor bills have an editable vendor client");
      const client=await LabClient.findById(input.clientId).session(session).exec();
      if(!client || client.active===false)throw new ApiError(422,"Select an active vendor client");
      clientChange={previousClientId:String(bill.clientId),previousClientName:bill.clientName,clientId:input.clientId,clientName:client.name};
      bill.clientId=new Types.ObjectId(input.clientId);bill.clientName=client.name;
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

    await hydrateOutsideAssignments([bill]);

    const priceOverrides = new Map<string, number>();
    for (const item of input.items) {
      if (item.unitPrice === undefined) continue;
      if (!options.allowPriceOverride) {
        throw new ApiError(403, "Only an administrator may change an individual bill price");
      }
      if (item.packageId) {
        throw new ApiError(422, "A package price cannot be overridden on its own; edit the package or price its tests individually");
      }
      priceOverrides.set(item.testId, round2(item.unitPrice));
    }

    const snapshotItems = await buildSnapshotItems(input.items, bill.patientType, bill.items, bill.billType === "vendor" ? String(bill.clientId) : undefined);
    const previousPriceByTest = new Map(bill.items.map(item => [String(item.testId), item.unitPrice]));
    for (const item of snapshotItems) {
      const override = priceOverrides.get(String(item.testId));
      const retainedPrice = !clientChange && !item.packageId ? previousPriceByTest.get(String(item.testId)) : undefined;
      const effectivePrice = override ?? retainedPrice;
      if (effectivePrice === undefined) continue;
      item.unitPrice = effectivePrice;
      item.total = round2(effectivePrice * item.quantity);
    }
    const priceChanges = snapshotItems
      .filter(item => priceOverrides.has(String(item.testId)))
      .map(item => ({
        testId: String(item.testId),
        testName: item.testName,
        previousUnitPrice: previousPriceByTest.get(String(item.testId)) ?? null,
        newUnitPrice: item.unitPrice,
        quantity: item.quantity,
        previousTotal: bill.items.find(previous=>String(previous.testId)===String(item.testId))?.total ?? null,
        newTotal: item.total,
      }));

    // A removed investigation remains in clinical storage and in the amendment.
    // Re-adding requires a fresh-order lifecycle; never reactivate old results.
    const retiredIds = new Set((bill.amendments ?? []).flatMap(change => change.removedItems.map(item => String(item.testId))));
    if (snapshotItems.some(item => retiredIds.has(String(item.testId)))) {
      throw new ApiError(422, "A removed test cannot be re-added to this bill. Create a new order to preserve its clinical history.");
    }
    const nextTestIds = new Set(snapshotItems.map(item => String(item.testId)));
    const removedItems = bill.items.filter(item => !nextTestIds.has(String(item.testId)));
    const changedAt = new Date();
    bill.amendments ??= [];
    bill.amendments.push({
      ...(input.payment?{paymentRequestId:input.payment.requestId,paymentFingerprint:createHash("sha256").update(JSON.stringify(input)).digest("hex")} : {}),
      changedBy: new Types.ObjectId(userId), changedAt,
      removedItems, previousItems: bill.items,
      previousTotals: {
        totalAmount: bill.totalAmount, discountPercent: bill.discountPercent,
        discountAmount: bill.discountAmount, netAmount: bill.netAmount,
        paidAmount: bill.paidAmount, dueAmount: bill.dueAmount,
      },
    });

    const totals = computeTotals(
      snapshotItems,
      input.discountPercent ?? 0,
      input.discountAmount,
      bill.paidAmount ?? 0,
      true, // Modification preserves receipts even when the revised net is lower.
    );

    if(input.payment){
      const amount=round2(input.payment.amount);
      if(!Number.isFinite(amount)||amount<=0||amount>totals.dueAmount)throw new ApiError(422,"Paying amount cannot exceed the outstanding balance.");
      await LabBillPayment.create([{billId:bill._id,amount,discountAmount:0,paymentMode:input.paymentMode??bill.paymentMode,collectedAt:changedAt,collectedBy:userId}],{session});
      bill.paidAmount=round2(bill.paidAmount+amount);
      totals.dueAmount=round2(Math.max(0,totals.netAmount-bill.paidAmount));
      await AuditLog.create([{user:userId,action:"lab_bill.payment_collected",entityType:"LabBill",entity:bill._id,timestamp:changedAt,details:{amount,requestId:input.payment.requestId}}],{session});
    }
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
    // Guard legacy documents as well as versioned bills against a stale edit.
    bill.$where = { updatedAt: bill.updatedAt };
    try { await bill.save({ session }); }
    catch (error) {
      if (error instanceof Error && (error.name === "VersionError" || error.name === "DocumentNotFoundError")) throw new ApiError(409,"This bill changed during editing. Reload before saving.");
      throw error;
    }

    // Fail closed: the amendment and audit must commit together.
    await AuditLog.create([{
      user: userId, action: "lab_bill.modified", entityType: "LabBill",
      entity: bill._id, timestamp: changedAt,
      details: {
        removedTestIds: removedItems.map(item => String(item.testId)),
        amendmentCount: bill.amendments.length,
        priceChanges,
        clientChange,
        previousTotals: bill.amendments[bill.amendments.length - 1]?.previousTotals,
        revisedTotals: {
          totalAmount: bill.totalAmount, discountPercent: bill.discountPercent,
          discountAmount: bill.discountAmount, netAmount: bill.netAmount,
          paidAmount: bill.paidAmount, dueAmount: bill.dueAmount,
        },
      },
    }], { session });
  });

  return LabBill.findById(billId)
    .populate("patientId", "patientId title firstName lastName fullName gender dateOfBirth age mobile")
    .populate("referringDoctorId", "name qualification specialization")
    .populate("clientId", "clientCode name")
    .exec() as Promise<ILabBill>;
}

async function hydrateOutsideAssignments(bills: (ILabBill & { _id?: unknown })[]): Promise<void> {
  if (!bills.length) return;
  const samples = await LabSample.find({ billId: { $in: bills.map((bill) => bill._id) }, outsideLabId: { $ne: null } })
    .select("billId testId outsideLabId sentOutAt").lean().exec();
  const centres = samples.length ? await OutsideLab.find({ _id: { $in: samples.map((sample) => sample.outsideLabId) } }).select("name").lean().exec() : [];
  const names = new Map(centres.map((centre) => [String(centre._id), centre.name]));
  const pairs = new Map(samples.map((sample) => [`${sample.billId}:${sample.testId}`, sample]));
  for (const bill of bills) for (const item of bill.items) {
    if (item.outsideLabId !== undefined) continue;
    const sample = pairs.get(`${bill._id}:${item.testId}`);
    if (sample?.outsideLabId) {
      item.outsideLabId = sample.outsideLabId;
      item.outsideLabName = names.get(String(sample.outsideLabId));
      item.sentOutAt = sample.sentOutAt;
    }
  }
}

export async function getLabBill(id: string): Promise<ILabBill> {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid bill ID");
  }
  const bill = await LabBill.findById(id)
    .populate("patientId", "patientId title firstName lastName fullName gender dateOfBirth age mobile")
    .populate("referringDoctorId", "name qualification specialization")
    .populate("clientId", "clientCode name")
    .exec();
  if (!bill) {
    throw new ApiError(404, "Bill not found");
  }
  await hydrateOutsideAssignments([bill]);
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
  clientId,
}: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  billType?: string;
  clientId?: string;
} = {}): Promise<PaginatedBills> {
  const filter: FilterQuery<ILabBill> = {};
  if (clientId) {
    if (!Types.ObjectId.isValid(clientId)) throw new ApiError(400,"Invalid client ID");
    filter.clientId = new Types.ObjectId(clientId);
    filter.billType = "vendor";
  }

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
      { clientName: { $regex: escaped, $options: "i" } },
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
      .populate("patientId", "patientId title firstName lastName fullName gender dateOfBirth age mobile")
      .populate("referringDoctorId", "name qualification specialization")
      .exec(),
  ]);

  await hydrateOutsideAssignments(data);
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
    .populate("patientId", "patientId title firstName lastName fullName gender dateOfBirth age mobile")
    .populate("referringDoctorId", "name qualification specialization")
    .populate("clientId", "clientCode name")
    .populate({ path: "payments", select: "amount discountAmount paymentMode comments collectedAt collectedBy", options: { sort: { collectedAt: 1 } } })
    .exec();
  if (!bill) {
    throw new ApiError(404, "Bill not found");
  }
  await hydrateOutsideAssignments([bill]);
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
      patientFilter.patientId = { $regex: patientCodePattern(patientKeyword), $options: "i" };
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
      .populate("patientId", "patientId title firstName lastName fullName gender dateOfBirth age mobile")
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
    .populate("patientId", "patientId title firstName lastName fullName gender dateOfBirth age mobile")
    .populate("referringDoctorId", "name qualification specialization")
    .populate("clientId", "clientCode name")
    .populate({ path: "payments", options: { sort: { collectedAt: 1 } } })
    .exec() as Promise<ILabBill>;
}
