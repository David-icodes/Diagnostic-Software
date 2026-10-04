import { Types, type AnyBulkWriteOperation, type FilterQuery } from "mongoose";
import { ApiError } from "../../utils/api-error";
import { generateSampleId } from "../../utils/id-generator";
import { LabSample, type ILabSample, type SampleStatus } from "../../models/lab-sample.model";
import { LabBill } from "../../models/lab-bill.model";
import { LabTest } from "../../models/lab-test.model";
import { Patient, type IPatient } from "../../models/patient.model";
import { Department } from "../../models/department.model";
import { LabTestResult } from "../../models/lab-test-result.model";
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
  sampleStatus: SampleStatus;
  testStatus: "OPEN" | "CLOSED";
  lastStatusChangeAt?: Date;
  comments?: string;
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
const ALLOWED_SAMPLE_TRANSITIONS: Record<
  SampleStatus,
  SampleStatus[]
> = {
  SELECT: ["COLLECTED", "REJECTED"],
  COLLECTED: ["RECEIVED", "RECOLLECTED", "REJECTED"],
  RECEIVED: ["PROCESSED", "RECOLLECTED", "REJECTED"],
  PROCESSED: ["RECOLLECTED"],
  RECOLLECTED: ["RECEIVED", "REJECTED"],
  REJECTED: ["COLLECTED"],
};

export function canTransitionSample(
  current: SampleStatus,
  next: SampleStatus,
): boolean {
  if (current === next) return false;
  return (ALLOWED_SAMPLE_TRANSITIONS[current] ?? []).includes(next);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

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
    end.setDate(end.getDate() + 1);
    billFilter.createdAt = { $gte: start, $lt: end };
  } else {
    const parseDay = (value?: string): Date | undefined => {
      if (!value || !value.trim()) return undefined;
      const [y, m, d] = value.trim().split("-").map(Number);
      if (!y || !m || !d) return undefined;
      return new Date(y, m - 1, d);
    };
    const from = parseDay(fromDate);
    const to = parseDay(toDate);
    if (from || to) {
      billFilter.createdAt = {};
      if (from) billFilter.createdAt = { $gte: from };
      if (to) {
        const end = new Date(to);
        end.setDate(end.getDate() + 1);
        billFilter.createdAt = { ...(billFilter.createdAt as object), $lt: end };
      }
    }
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
  // the bill sorts last inside its bill rather than disappearing.
  const orderedSamples = [...samples].sort((a, b) => {
    const billDiff =
      (billCreatedAt.get(String(b.billId)) ?? 0) -
      (billCreatedAt.get(String(a.billId)) ?? 0);
    if (billDiff !== 0) return billDiff;
    const aIndex = itemOrder.get(`${String(a.billId)}:${String(a.testId)}`) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = itemOrder.get(`${String(b.billId)}:${String(b.testId)}`) ?? Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return String(a.sampleId).localeCompare(String(b.sampleId));
  });

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
  const [hours, minutes] = time.split(":").map(Number);
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
}

async function getSampleBillContext(
  sample: ILabSample & { _id: Types.ObjectId },
): Promise<SampleRow> {
  const [bill, patient, test, department] = await Promise.all([
    LabBill.findById(sample.billId).select("billNumber createdAt items").exec(),
    Patient.findById(sample.patientId).select("patientId fullName").exec(),
    LabTest.findById(sample.testId).select("testCode testName departmentId").exec(),
    sample.departmentId ? Department.findById(sample.departmentId).select("name").exec() : null,
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

  const changedAt = resolvedTimestamp(input.time);
  const changedBy = new Types.ObjectId(userId);
  const comments = input.comments ?? sample.comments;

  sample.sampleStatus = input.status;
  sample.comments = comments;
  sample.updatedBy = changedBy;

  switch (input.status) {
    case "COLLECTED":
      sample.collectedAt = changedAt;
      break;
    case "RECEIVED":
      sample.receivedAt = changedAt;
      break;
    case "PROCESSED":
      sample.processedAt = changedAt;
      break;
    case "RECOLLECTED":
      sample.recollectedAt = changedAt;
      break;
    case "REJECTED":
      sample.rejectedAt = changedAt;
      break;
    default:
      break;
  }

  sample.history.push({
    status: input.status,
    changedAt,
    changedBy,
    comments,
  });
  await sample.save();

  await recordAudit({
    user: userId,
    action: "sample.status_updated",
    entityType: "LabSample",
    entity: sample._id,
  });

  return getSampleBillContext(sample);
}