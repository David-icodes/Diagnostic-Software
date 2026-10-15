import { recollectSample } from "./recollection.service";
import { businessDateInput, businessDayStart } from "../../utils/business-date";
import { localDayRange } from "../../utils/date-range";
import { isSampleTransitionAllowed } from "../../utils/sample-lifecycle";
import mongoose, { Types, type AnyBulkWriteOperation, type FilterQuery } from "mongoose";
import { ApiError } from "../../utils/api-error";
import { generateSampleId } from "../../utils/id-generator";
import { LabSample, type ILabSample, type SampleStatus } from "../../models/lab-sample.model";
import { LabBill } from "../../models/lab-bill.model";
import { LabTest } from "../../models/lab-test.model";
import { Patient, type IPatient } from "../../models/patient.model";
import { Department } from "../../models/department.model";
import { LabTestResult } from "../../models/lab-test-result.model";
import { OutsideLab } from "../../models/outside-lab.model";
import type { UpdateSampleOutsideInput } from "../../validations/sample-outside";
import { AuditLog } from "../../models/audit-log.model";
import { recordAudit } from "../audit/audit.service";

export interface SampleRow {
  id: string;
  sampleId: string;
  billId: string;
  patientId: string;
  testId: string;
  billNumber: string;
  billDate?: Date;
  patientCode?: string;
  patientName?: string;
  departmentName?: string;
  testCode?: string;
  testName?: string;
  /**
   * True when the ordered test behind this sample could be resolved, either from
   * the bill item snapshot or from the Lab Test master. When it is false the UI
   * must show an explicit "Test not linked" state instead of a placeholder, so
   * an orphaned sample is never mistaken for a real test.
   */
  testLinked: boolean;
  /** True when testName came from the bill item snapshot (the ordered test). */
  testNameFromBillItem: boolean;
  sampleType?: string;
  containerType?: string;
  outsideLabId?: string | null;
  outsideLabName?: string;
  sentOutAt?: Date | null;
  sampleStatus: SampleStatus;
  testStatus: "OPEN" | "CLOSED";
  lastStatusChangeAt?: Date;
  comments?: string;
}


/** Canonical bill-item choice overrides legacy sample data, including explicit clears. */
export function sampleOutsideView(
  item: { outsideLabId?: Types.ObjectId | null; outsideLabName?: string; sentOutAt?: Date | null } | undefined,
  sample: Pick<ILabSample, "outsideLabId" | "sentOutAt">,
  names: Map<string, string>,
): Pick<SampleRow, "outsideLabId" | "outsideLabName" | "sentOutAt"> {
  const legacy = item?.outsideLabId === undefined;
  const id = legacy ? sample.outsideLabId : item?.outsideLabId;
  return { outsideLabId: id ? String(id) : null,
    outsideLabName: id ? names.get(String(id)) ?? item?.outsideLabName : undefined,
    sentOutAt: id ? (legacy ? sample.sentOutAt : item?.sentOutAt) : null };
}

export interface PaginatedSamples {
  data: SampleRow[];
  pagination: {
    page: number;
    limit: number;
    /**
     * Number of lab bills matched by the filter. Pages are cut on bills, so this
     * is the number of pages' worth of work, not the number of sample rows.
     */
    total: number;
    totalPages: number;
    /** Sample rows on the returned page. */
    sampleCount: number;
  };
}

/**
 * Transition rules. The happy path is COLLECTED -> RECEIVED -> PROCESSED.
 * A sample may be REJECTED (before processing) or RECOLLECTED (after any
 * stage up to processing). A rejected sample may be re-collected fresh.
 * There is no auto-jumping: every step must be explicitly saved.
 */
export const canTransitionSample = isSampleTransitionAllowed;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function startOfLocalDay(date: Date): Date { return businessDayStart(businessDateInput(date))!; }

/**
 * Creates one sample row per ordered test on each bill that does not have one yet.
 *
 * The bill item is the ordered test, and `items[].testId` is the link to the Lab
 * Test master. `(billId, testId)` carries a unique index, so creation is an
 * idempotent upsert: repeated page loads and two concurrent users produce one
 * sample row per ordered test, never a duplicate and never a crash.
 */
async function ensureSamplesForBills(
  bills: Array<{
    _id: Types.ObjectId;
    patientId: Types.ObjectId;
    items: Array<{ testId: Types.ObjectId }>;
  }>,
  createdBy: string,
): Promise<void> {
  const testIds = Array.from(
    new Set(
      bills.flatMap((bill) => bill.items.map((item) => String(item.testId))),
    ),
  );
  const tests = await LabTest.find({ _id: { $in: testIds } })
    .select("testId sampleType containerType departmentId")
    .exec();
  const testMap = new Map(tests.map((test) => [String(test._id), test]));

  // Deduplicate per bill: the unique index is (billId, testId), so the same test
  // ordered twice on one bill still maps to a single sample row.
  const wanted = new Map<string, { billId: Types.ObjectId; patientId: Types.ObjectId; testId: Types.ObjectId }>();
  for (const bill of bills) {
    for (const item of bill.items) {
      const key = `${String(bill._id)}:${String(item.testId)}`;
      if (!wanted.has(key)) {
        wanted.set(key, { billId: bill._id, patientId: bill.patientId, testId: item.testId });
      }
    }
  }
  if (wanted.size === 0) return;

  const existing = await LabSample.find({
    billId: { $in: Array.from(wanted.values()).map((entry) => entry.billId) },
  })
    .select("billId testId")
    .lean()
    .exec();
  const existingKeys = new Set(
    existing.map((sample) => `${String(sample.billId)}:${String(sample.testId)}`),
  );
  // A read path must not fail because the caller id is not castable; the
  // creator is left unset in that case rather than throwing out of the list.
  const createdByObjectId = Types.ObjectId.isValid(createdBy)
    ? new Types.ObjectId(createdBy)
    : undefined;

  const missing = Array.from(wanted.entries()).filter(
    ([key]) => !existingKeys.has(key),
  );
  if (missing.length === 0) return;

  // Sample ids are allocated one per new row, then written by a single bulk
  // upsert. The upsert filter is the same unique key as the index, so a concurrent
  // reader that created the row first simply wins and no duplicate is stored.
  const operations: AnyBulkWriteOperation<ILabSample>[] = await Promise.all(
    missing.map(async ([, entry]) => {
      const test = testMap.get(String(entry.testId));
      const newSample: Partial<ILabSample> = {
        sampleId: await generateSampleId(),
        billId: entry.billId,
        patientId: entry.patientId,
        testId: entry.testId,
        departmentId: test?.departmentId,
        sampleType: test?.sampleType,
        containerType: test?.containerType,
        sampleStatus: "SELECT",
        history: [],
        createdBy: createdByObjectId,
      };
      return {
        updateOne: {
          filter: { billId: entry.billId, testId: entry.testId },
          update: { $setOnInsert: newSample },
          upsert: true,
        },
      };
    }),
  );

  await LabSample.bulkWrite(operations, { ordered: false });
}

export async function listLabSamples({
  page = 1,
  limit = 100,
  mode = "today",
  fromDate,
  toDate,
  billNumber,
  patientId,
  patientName,
  userId,
}: {
  page?: number;
  limit?: number;
  mode?: "today" | "criteria";
  fromDate?: string;
  toDate?: string;
  billNumber?: string;
  patientId?: string;
  patientName?: string;
  userId: string;
}): Promise<PaginatedSamples> {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(200, Math.max(1, Math.floor(limit)));

  const billFilter: FilterQuery<typeof LabBill> = { status: "generated" };

  if (mode === "today") {
    const start = startOfLocalDay(new Date());
    const end = new Date(start);
    end.setTime(end.getTime() + 24 * 60 * 60 * 1000);
    billFilter.createdAt = { $gte: start, $lt: end };
  } else {
    const range = localDayRange(fromDate, toDate);
    if (range) billFilter.createdAt = range;
  }

  const billNumberKeyword = billNumber?.trim();
  if (billNumberKeyword) {
    billFilter.billNumber = { $regex: escapeRegExp(billNumberKeyword), $options: "i" };
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
    if (patients.length === 0) {
      return {
        data: [],
        pagination: { page: safePage, limit: safeLimit, total: 0, totalPages: 0, sampleCount: 0 },
      };
    }
    billFilter.patientId = { $in: patients.map((patient) => patient._id) };
  }

  const [total, bills] = await Promise.all([
    LabBill.countDocuments(billFilter),
    LabBill.find(billFilter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .select("billNumber patientId items createdAt")
      .exec(),
  ]);

  if (bills.length === 0) {
    return {
      data: [],
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
        sampleCount: 0,
      },
    };
  }

  await ensureSamplesForBills(bills, userId);

  const sampleFilter: FilterQuery<ILabSample> = {
    billId: { $in: bills.map((bill) => bill._id) },
  };

  const samples = await LabSample.find(sampleFilter).sort({ createdAt: 1 }).exec();

  const [patients, tests, closedKeys] = await Promise.all([
    Patient.find({ _id: { $in: bills.map((bill) => bill.patientId) } })
      .select("patientId fullName")
      .exec(),
    LabTest.find({
      _id: { $in: Array.from(new Set(samples.map((sample) => sample.testId))) },
    })
      .select("testCode testName departmentId")
      .lean()
      .exec(),
    LabTestResult.find({
      billId: { $in: bills.map((bill) => bill._id) },
    })
      .select("billId testId")
      .lean()
      .exec(),
  ]);

  const billMap = new Map(bills.map((bill) => [String(bill._id), bill]));
  const patientMap = new Map(patients.map((patient) => [String(patient._id), patient]));
  const testMap = new Map(tests.map((test) => [String(test._id), test]));
const billCreatedAt = new Map<string, number>(
    bills.map((bill) => [String(bill._id), bill.createdAt?.getTime() ?? 0]),
  );
  const closedKeysSet = new Set(
    closedKeys.map((result) => `${String(result.billId)}:${String(result.testId)}`),
  );

  // Position of each ordered test inside its bill, so rows are listed in the
  // sequence the tests were ordered rather than in the order rows were written.
  const itemOrder = new Map<string, number>();
  bills.forEach((bill) => {
    bill.items.forEach((entry, index) => {
      const key = `${String(bill._id)}:${String(entry.testId)}`;
      if (!itemOrder.has(key)) itemOrder.set(key, index);
    });
  });

  // Only the departments actually referenced by the page are loaded.
  const departmentIds = Array.from(
    new Set(
      samples
        .map((sample) => sample.departmentId)
        .filter((id): id is Types.ObjectId => Boolean(id)),
    ),
  );
  const departments = departmentIds.length
    ? await Department.find({ _id: { $in: departmentIds } })
        .select("name")
        .lean()
        .exec()
    : [];
  const departmentMap = new Map(
    departments.map((department) => [String(department._id), department.name]),
  );

  // Sort by bill (newest first, matching the page window) and then by the
  // position of the test inside that bill. A sample whose test is no longer on
  // the bill is retained in storage but excluded from the active worklist.
  const orderedSamples = samples.filter(sample => itemOrder.has(`${sample.billId}:${sample.testId}`)).sort((a, b) => {
    const billDiff =
      (billCreatedAt.get(String(b.billId)) ?? 0) -
      (billCreatedAt.get(String(a.billId)) ?? 0);
    if (billDiff !== 0) return billDiff;
    const aIndex = itemOrder.get(`${String(a.billId)}:${String(a.testId)}`) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = itemOrder.get(`${String(b.billId)}:${String(b.testId)}`) ?? Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return String(a.sampleId).localeCompare(String(b.sampleId));
  });

  const outsideCentres = await OutsideLab.find().select("name").lean().exec();
  const outsideNames = new Map(outsideCentres.map((centre) => [String(centre._id), centre.name]));

  const rows: SampleRow[] = orderedSamples.map((sample) => {
    const bill = billMap.get(String(sample.billId));
    const patient = patientMap.get(String(sample.patientId));
    const test = testMap.get(String(sample.testId));
    // The bill item is the ordered test: its snapshot name is what was actually
    // ordered on this bill. The Lab Test master is the fallback when a legacy
    // bill item has no snapshot. When neither resolves, the row is reported as
    // unlinked instead of being given an invented name.
    const item = bill?.items.find(
      (entry) => String(entry.testId) === String(sample.testId),
    );
    const testName = item?.testName?.trim() || test?.testName?.trim() || undefined;
    const testCode = item?.testCode?.trim() || test?.testCode?.trim() || undefined;
    const lastChange = sample.history.length > 0
      ? sample.history[sample.history.length - 1]
      : undefined;
    return {
      id: String(sample._id),
      sampleId: sample.sampleId,
      billId: String(sample.billId),
      patientId: String(sample.patientId),
      testId: String(sample.testId),
      billNumber: bill?.billNumber ?? "—",
      billDate: bill?.createdAt,
      patientCode: patient?.patientId,
      patientName: patient?.fullName,
      departmentName: (sample.departmentId
        ? departmentMap.get(String(sample.departmentId))
        : test?.departmentId
          ? departmentMap.get(String(test.departmentId))
          : undefined) ?? "Unassigned",
      testCode,
      testName,
      testLinked: Boolean(testName),
      testNameFromBillItem: Boolean(item?.testName?.trim()),
      sampleType: sample.sampleType,
      containerType: sample.containerType,
      ...sampleOutsideView(item, sample, outsideNames),
      sampleStatus: sample.sampleStatus,
      testStatus: closedKeysSet.has(`${String(sample.billId)}:${String(sample.testId)}`)
        ? "CLOSED"
        : "OPEN",
      lastStatusChangeAt: lastChange?.changedAt,
      comments: sample.comments,
    };
  });

  return {
    data: rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      sampleCount: rows.length,
    },
  };
}

function resolvedTimestamp(time?: string): Date {
  if (!time) return new Date();
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new ApiError(422, "Invalid collection time");
  return new Date(`${businessDateInput()}T${time}:00+05:30`);
}

async function getSampleBillContext(
  sample: ILabSample & { _id: Types.ObjectId },
): Promise<SampleRow> {
  const [bill, patient, test, department, centres] = await Promise.all([
    LabBill.findById(sample.billId).select("billNumber createdAt items").exec(),
    Patient.findById(sample.patientId).select("patientId fullName").exec(),
    LabTest.findById(sample.testId).select("testCode testName departmentId").exec(),
    sample.departmentId ? Department.findById(sample.departmentId).select("name").exec() : null,
    OutsideLab.find().select("name").lean().exec(),
  ]);
  const lastChange =
    sample.history.length > 0 ? sample.history[sample.history.length - 1] : undefined;
  const closed = await LabTestResult.exists({
    billId: sample.billId,
    testId: sample.testId,
  });
  const item = bill?.items.find(
    (entry) => String(entry.testId) === String(sample.testId),
  );
  const testName = item?.testName?.trim() || test?.testName?.trim() || undefined;
  const testCode = item?.testCode?.trim() || test?.testCode?.trim() || undefined;
  return {
    id: String(sample._id),
    sampleId: sample.sampleId,
    billId: String(sample.billId),
    patientId: String(sample.patientId),
    testId: String(sample.testId),
    billNumber: bill?.billNumber ?? "—",
    billDate: bill?.createdAt,
    patientCode: patient?.patientId,
    patientName: patient?.fullName,
    departmentName: department?.name ?? "Unassigned",
    testCode,
    testName,
    testLinked: Boolean(testName),
    testNameFromBillItem: Boolean(item?.testName?.trim()),
    sampleType: sample.sampleType,
    containerType: sample.containerType,
    ...sampleOutsideView(item, sample, new Map(centres.map((centre) => [String(centre._id), centre.name]))),
    sampleStatus: sample.sampleStatus,
    testStatus: closed ? "CLOSED" : "OPEN",
    lastStatusChangeAt: lastChange?.changedAt,
    comments: sample.comments,
  };
}

export async function updateLabSampleStatus(
  userId: string,
  sampleId: string,
  input: { status: SampleStatus; time?: string; comments?: string },
): Promise<SampleRow> {
  if (!Types.ObjectId.isValid(sampleId)) {
    throw new ApiError(400, "Invalid sample ID");
  }

  const sample = await LabSample.findById(sampleId).exec();
  if (!sample) {
    throw new ApiError(404, "Sample not found");
  }

  if (!canTransitionSample(sample.sampleStatus, input.status)) {
    throw new ApiError(
      422,
      `Sample status cannot move from ${sample.sampleStatus} to ${input.status}`,
    );
  }

  if (input.status === "RECOLLECTED") return getSampleBillContext(await recollectSample(userId, sampleId, input.comments, resolvedTimestamp(input.time)));

  const previousStatus = sample.sampleStatus;
  const changedAt = resolvedTimestamp(input.time);
  const changedBy = new Types.ObjectId(userId);
  const comments = input.comments ?? sample.comments;

  const timestamps: Record<string, Date | undefined> = {};
  const timestampField = ({ COLLECTED: "collectedAt", RECEIVED: "receivedAt", PROCESSED: "processedAt", RECOLLECTED: "recollectedAt", REJECTED: "rejectedAt" } as Record<string,string>)[input.status];
  if (timestampField) timestamps[timestampField] = changedAt;
  const saved = await mongoose.connection.transaction(async session => {
    // Serialize with bill amendment and result writes on the same bill document.
    const fence = await LabBill.updateOne({ _id: sample.billId, patientId: sample.patientId,
      status: "generated", "items.testId": sample.testId }, { $inc: { sampleWriteRevision: 1 } }, { session }).exec();
    if (fence.matchedCount !== 1) throw new ApiError(409, "This test is no longer active on the bill. Reload before updating samples.");
    const updated = await LabSample.findOneAndUpdate(
      { _id: sample._id, sampleStatus: previousStatus === "SELECT" ? { $in: ["SELECT", null] } : previousStatus, ...(sample.updatedAt ? {updatedAt:sample.updatedAt} : {}) },
      { $set: {sampleStatus:input.status,comments,updatedBy:changedBy,...timestamps}, $push: {history:{status:input.status,changedAt,changedBy,comments}} },
      { new: true, runValidators: true, session },
    ).exec();
    if (!updated) throw new ApiError(409, "This sample changed while you were editing. Reload and select its next status.");
    await AuditLog.create([{ user: userId, action: "sample.status_updated", entityType: "LabSample", entity: sample._id, timestamp: changedAt }], { session });
    return updated;
  });
  return getSampleBillContext(saved);
}
/** Updates only the existing bill-item outside snapshot; collection/results/money are untouched. */
export async function updateLabSampleOutside(userId: string, sampleId: string, input: UpdateSampleOutsideInput): Promise<SampleRow> {
  if (!Types.ObjectId.isValid(sampleId)) throw new ApiError(400, "Invalid sample ID");
  const sample = await LabSample.findById(sampleId).exec();
  if (!sample) throw new ApiError(404, "Sample not found");
  const bill = await LabBill.findById(sample.billId).exec();
  if (!bill || String(bill.patientId) !== String(sample.patientId)) throw new ApiError(422, "Sample is not linked to its bill and patient");
  const item = bill.items.find((entry) => String(entry.testId) === String(sample.testId));
  if (!item) throw new ApiError(422, "Sample test is not ordered on this bill");
  if (bill.status === "cancelled") throw new ApiError(422, "A cancelled bill cannot be updated");
  const old = sampleOutsideView(item, sample, new Map());
  const id = input.out ? input.outsideLabId : null;
  if (input.out && !id) throw new ApiError(422, "Select an outside lab");
  const centre = id ? await OutsideLab.findById(id).exec() : null;
  if (id && (!centre || (!centre.active && old.outsideLabId !== id))) throw new ApiError(422, "Select an active outside lab");
  const retained = Boolean(id && old.outsideLabId === id);
  const assignedAt = id ? (retained ? old.sentOutAt : new Date()) : null;
  const update = {
    $set: { "items.$.outsideLabId": id ? new Types.ObjectId(id) : null,
      "items.$.sentOutAt": assignedAt ?? null, updatedBy: new Types.ObjectId(userId),
      ...(centre ? { "items.$.outsideLabName": centre.name } : {}) },
    ...(!centre ? { $unset: { "items.$.outsideLabName": 1 } } : {}),
  };
  const result = await LabBill.updateOne({ _id: bill._id, patientId: sample.patientId,
    status: { $ne: "cancelled" }, "items.testId": sample.testId }, update).exec();
  if (result.matchedCount !== 1) throw new ApiError(409, "The bill changed; reload before updating OUT");
  await recordAudit({ user: userId, action: "sample.outside_updated", entityType: "LabSample", entity: sample._id });
  return getSampleBillContext(sample);
}
