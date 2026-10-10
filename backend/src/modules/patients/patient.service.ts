import { Types, type FilterQuery } from "mongoose";
import { ApiError } from "../../utils/api-error";
import { Patient, type IPatient, type PatientDoc } from "../../models/patient.model";
import { LabBill } from "../../models/lab-bill.model";
import { LabBillPayment } from "../../models/lab-bill-payment.model";
import { LabSample } from "../../models/lab-sample.model";
import { LabTestResult } from "../../models/lab-test-result.model";
import { LabReportUpload } from "../../models/lab-report-upload.model";
import { generatePatientId } from "../../utils/id-generator";
import { recordAudit } from "../audit/audit.service";

export type CreatePatientInput = Omit<
  IPatient,
  "patientId" | "fullName" | "createdBy" | "status" | "createdAt" | "updatedAt"
>;

export type UpdatePatientInput = Partial<
  Omit<IPatient, "patientId" | "fullName" | "createdBy" | "createdAt" | "updatedAt">
>;

export interface ListPatientsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Permanent patient deletion.
 *
 * `LabTestResult` and `LabSample` carry both `patientId` and `billId`,
 * `LabBill` carries `patientId` with its items embedded, and `LabBillPayment`
 * only carries `billId`. Uploaded reports also carry both registration and bill
 * IDs and are removed with the clinical children.
 */
export interface DeletePatientResult {
  /** Identifier of the registration that was removed. */
  patientId: string;
  fullName: string;
  /** Number of documents actually removed from each collection. */
  deleted: {
    bills: number;
    payments: number;
    samples: number;
    results: number;
    patient: number;
  };
  /** Counts observed after the cleanup; every value must be zero. */
  remaining: {
    bills: number;
    samples: number;
    results: number;
    patient: number;
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface CreatePatientOptions {
  /**
   * Set by a caller that has explicitly confirmed, with the operator, that the
   * new registration is a different person who happens to share a mobile
   * number. Repeat bills never need this: reusing the existing patient keeps one
   * identity per person.
   */
  duplicateMobileAcknowledged?: boolean;
}

export async function createPatient(
  userId: string,
  input: CreatePatientInput,
  options: CreatePatientOptions = {},
): Promise<PatientDoc> {
  // A mobile number is a contact detail, not the patient's identity: several
  // people can share one, and one person has many bills against a single patient
  // master. When the mobile is already on file the caller is told about the
  // match so it can reuse that record; only an explicit confirmation creates a
  // separate person. `patientId` (GP...) remains the permanent identity.
  const mobile = typeof input.mobile === "string" ? input.mobile.trim() : "";
  if (mobile && !options.duplicateMobileAcknowledged) {
    const existing = await Patient.findOne({ mobile }).sort({ createdAt: 1 }).exec();
    if (existing) {
      throw new ApiError(
        409,
        `A patient with mobile ${mobile} is already registered (${existing.patientId}, ${existing.fullName}). Use the existing record instead of creating a duplicate.`,
        {
          existingPatient: {
            id: String(existing._id),
            patientId: existing.patientId,
            fullName: existing.fullName,
            mobile: existing.mobile,
            gender: existing.gender,
          },
        },
      );
    }
  }

  const patientId = await generatePatientId();

  const patient = await Patient.create({
    ...input,
    patientId,
    createdBy: userId,
  } as unknown as IPatient);

  await recordAudit({
    user: userId,
    action: "patient.created",
    entityType: "Patient",
    entity: patient._id,
  });

  return patient;
}

export async function listPatients({
  page = 1,
  limit = 20,
  search,
  status,
}: ListPatientsParams = {}): Promise<PaginatedResult<PatientDoc>> {
  const filter: FilterQuery<IPatient> = {};

  if (status === "active" || status === "inactive") {
    filter.status = status;
  }

  const keyword = search?.trim();
  if (keyword) {
    const escaped = escapeRegExp(keyword);
    filter.$or = [
      { patientId: { $regex: escaped, $options: "i" } },
      { fullName: { $regex: escaped, $options: "i" } },
      { mobile: { $regex: escaped, $options: "i" } },
    ];
  }

  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const skip = (safePage - 1) * safeLimit;

  const [total, data] = await Promise.all([
    Patient.countDocuments(filter),
    Patient.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
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

export async function getPatient(
  idOrPatientId: string,
): Promise<PatientDoc> {
  const query = Types.ObjectId.isValid(idOrPatientId)
    ? { _id: idOrPatientId }
    : { patientId: idOrPatientId };

  const patient = await Patient.findOne(query);
  if (!patient) {
    throw new ApiError(404, "Patient not found");
  }
  return patient;
}

export async function updatePatient(
  userId: string,
  idOrPatientId: string,
  input: UpdatePatientInput,
): Promise<PatientDoc> {
  const patient = await getPatient(idOrPatientId);

  const allowedFields = Object.fromEntries(
    Object.entries(input).filter(
      ([key]) => key !== "patientId" && key !== "fullName" && key !== "createdBy",
    ),
  );

  Object.assign(patient, allowedFields, {
    updatedBy: new Types.ObjectId(userId),
  });

  await patient.save();

  await recordAudit({
    user: userId,
    action: "patient.updated",
    entityType: "Patient",
    entity: patient._id,
  });

  return patient;
}

/**
 * Permanently deletes a patient registration and every operational record that
 * belongs to it.
 *
 * Relationships traced from the models (see `LabBill`, `LabSample`,
 * `LabTestResult`, `LabBillPayment`):
 *
 * - `LabTestResult` and `LabSample` carry both `patientId` and `billId`.
 * - `LabBill` carries `patientId`; its items are embedded, so deleting the bill
 *   removes the items with it and no item collection exists.
 * - `LabBillPayment` only carries `billId`, so it has to be resolved through the
 *   patient's bills before those are removed.
 *
 * Master data (departments, lab tests, parameters, units, reference ranges,
 * tariffs, doctors, clients, users) is never referenced by `patientId` and is
 * never touched. Audit logs are never removed: the deletion itself is recorded
 * so the history of the action survives.
 *
 * A standalone MongoDB deployment cannot start a multi-document transaction, so
 * the cleanup is ordered instead: children first, the registration last. Each
 * step reports how many documents it removed, and the result carries a
 * post-delete count so the caller can verify nothing was left behind. A failure
 * in any step is thrown before the registration is removed, so the patient is
 * never left without a trace while its history is still being deleted. Because
 * there is no transaction, retrying the deletion is safe: the filters are
 * idempotent and a partially cleaned patient can only have fewer rows to remove.
 */
export async function deletePatient(
  userId: string,
  idOrPatientId: string,
): Promise<DeletePatientResult> {
  const identifier = idOrPatientId?.trim();
  if (!identifier) {
    throw new ApiError(400, "Patient ID is required");
  }
  if (!Types.ObjectId.isValid(identifier)) {
    // Only the generated GPId may be used here; the route already accepts both
    // forms and getPatient resolves whichever was supplied.
    if (!/^GP\d{9}$/i.test(identifier)) {
      throw new ApiError(400, "Invalid patient ID");
    }
  }

  const patient = await getPatient(identifier);
  const patientObjectId = patient._id;

  // Resolve the bill ids first: payments are only reachable through them.
  const bills = await LabBill.find({ patientId: patientObjectId })
    .select("_id")
    .exec();
  const billIds = bills.map((bill) => bill._id);

  const paymentsFilter = { billId: { $in: billIds } };
  const resultFilter = {
    $or: [{ patientId: patientObjectId }, ...(billIds.length ? [{ billId: { $in: billIds } }] : [])],
  };
  const sampleFilter = {
    $or: [{ patientId: patientObjectId }, ...(billIds.length ? [{ billId: { $in: billIds } }] : [])],
  };

  // Children first so a mid-way failure can only leave unreferenced rows, never
  // live clinical data pointing at a registration that no longer exists.
  const results = await LabTestResult.deleteMany(resultFilter);
  // Report attachments belong to the same registration and must not outlive its cleanup.
  await LabReportUpload.deleteMany(resultFilter);
  const samples = await LabSample.deleteMany(sampleFilter);
  const payments = billIds.length
    ? await LabBillPayment.deleteMany(paymentsFilter)
    : { deletedCount: 0 };
  const removedBills = await LabBill.deleteMany({ patientId: patientObjectId });
  const removedPatient = await Patient.deleteOne({ _id: patientObjectId });

  if (removedPatient.deletedCount !== 1) {
    throw new ApiError(
      500,
      "The registration could not be removed. Please retry the deletion.",
    );
  }

  // Verification: anything still referencing this patient would be an orphan.
  const [leftBills, leftSamples, leftResults, leftPatients] = await Promise.all([
    LabBill.countDocuments({ patientId: patientObjectId }),
    LabSample.countDocuments({ patientId: patientObjectId }),
    LabTestResult.countDocuments({ patientId: patientObjectId }),
    Patient.countDocuments({ _id: patientObjectId }),
  ]);

  await recordAudit({
    user: userId,
    action: "patient.deleted",
    entityType: "Patient",
    entity: patientObjectId,
  });

  return {
    patientId: patient.patientId,
    fullName: patient.fullName,
    deleted: {
      bills: removedBills.deletedCount ?? bills.length,
      payments: payments.deletedCount ?? 0,
      samples: samples.deletedCount ?? 0,
      results: results.deletedCount ?? 0,
      patient: removedPatient.deletedCount ?? 0,
    },
    remaining: {
      bills: leftBills,
      samples: leftSamples,
      results: leftResults,
      patient: leftPatients,
    },
  };
}
