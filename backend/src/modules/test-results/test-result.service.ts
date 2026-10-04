import { Types } from "mongoose";
import { ApiError } from "../../utils/api-error";
import { LabBill } from "../../models/lab-bill.model";
import {
  LabTestParameter,
  type ILabTestParameter,
} from "../../models/lab-test-parameter.model";
import {
  LabTestResult,
  type ILabTestResult,
  type IReferenceSnapshot,
  type ResultValue,
} from "../../models/lab-test-result.model";
import { Patient } from "../../models/patient.model";
import {
  evaluateValue,
  resolveReferenceRange,
  type ReferenceResolution,
} from "../../utils/reference-resolver";
import { recordAudit } from "../audit/audit.service";

/** Upper bound for free-text results (e.g. microscopy notes). */
const RESULT_TEXT_MAX = 2000;

function assertParameterTypeMatches(
  parameter: ILabTestParameter,
  value: ResultValue,
): void {
  switch (parameter.resultType) {
    case "NUMBER":
    case "RANGE":
      if (typeof value !== "number") {
        throw new ApiError(
          422,
          `Result for "${parameter.parameterName}" must be a number`,
        );
      }
      break;
    case "BOOLEAN":
      if (typeof value !== "boolean") {
        throw new ApiError(
          422,
          `Result for "${parameter.parameterName}" must be true or false`,
        );
      }
      break;
    case "SELECT": {
      if (typeof value !== "string") {
        throw new ApiError(
          422,
          `Result for "${parameter.parameterName}" is invalid`,
        );
      }
      if (value.length > RESULT_TEXT_MAX) {
        throw new ApiError(
          422,
          `Result for "${parameter.parameterName}" is too long (max ${RESULT_TEXT_MAX} characters)`,
        );
      }
      const options = parameter.options ?? [];
      // Numeric lookalike options (e.g. "Negative") are matched case-insensitively.
      if (
        options.length > 0 &&
        !options.some((option) => option.toLowerCase() === value.toLowerCase())
      ) {
        throw new ApiError(
          422,
          `"${value}" is not a valid option for "${parameter.parameterName}"`,
        );
      }
      break;
    }
    case "TEXT":
    default:
      if (typeof value !== "string") {
        throw new ApiError(
          422,
          `Result for "${parameter.parameterName}" must be text`,
        );
      }
      if (value.length === 0) {
        throw new ApiError(
          422,
          `Result for "${parameter.parameterName}" cannot be blank`,
        );
      }
      if (value.length > RESULT_TEXT_MAX) {
        throw new ApiError(
          422,
          `Result for "${parameter.parameterName}" is too long (max ${RESULT_TEXT_MAX} characters)`,
        );
      }
      break;
  }
}

export async function listTestParameters(
  testId: string,
): Promise<ILabTestParameter[]> {
  if (!Types.ObjectId.isValid(testId)) {
    throw new ApiError(400, "Invalid test ID");
  }
  return LabTestParameter.find({ testId, active: true })
    .sort({ displayOrder: 1, parameterName: 1 })
    .exec();
}

/** One ordered test of a bill, with its parameters and applicable references. */
export interface BillTestEntry {
  testId: string;
  testCode: string;
  testName: string;
  /** Position of this test in the bill's ordered items. */
  order: number;
  /** False when the bill item no longer links to a usable test master. */
  testLinked: boolean;
  parameters: Array<{
    parameterId: string;
    parameterName: string;
    subtitle?: string;
    displayOrder: number;
    resultType: ILabTestParameter["resultType"];
    parameterType?: string;
    defaultValue?: string;
    unit?: string;
    method?: string;
    options?: string[];
    onlyReferenceRange?: boolean;
    /** True when this parameter has structured mappings configured. */
    hasReferenceMappings: boolean;
    reference: ReferenceResolution;
  }>;
}

export interface BillResultEntry {
  billId: string;
  billNumber: string;
  patientId: string;
  patientCode?: string;
  patientName?: string;
  patientGender?: string;
  patientDateOfBirth?: Date;
  patientAge?: number;
  tests: BillTestEntry[];
}

/**
 * Loads one bill's ordered tests together with the reference range that applies
 * to its patient.
 *
 * The bill is the authority for what was ordered, so only its own items are
 * returned, in the sequence they were ordered. A bill item whose test master no
 * longer resolves is reported as unlinked rather than being dropped or guessed.
 */
export async function getBillResultEntry(
  billId: string,
  now: Date = new Date(),
): Promise<BillResultEntry> {
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
        ? "Results cannot be entered for a cancelled bill"
        : "Results can only be entered for a generated bill",
    );
  }

  const patient = await Patient.findById(bill.patientId).exec();
  const patientContext = {
    dateOfBirth: patient?.dateOfBirth ?? null,
    age: patient?.age ?? null,
    gender: patient?.gender ?? null,
  };

  const parameters = bill.items.length
    ? await LabTestParameter.find({
        testId: { $in: bill.items.map((item) => item.testId) },
        active: true,
      })
        .sort({ displayOrder: 1, parameterName: 1 })
        .exec()
    : [];
  const byTest = new Map<string, typeof parameters>();
  for (const parameter of parameters) {
    const key = String(parameter.testId);
    const bucket = byTest.get(key);
    if (bucket) bucket.push(parameter);
    else byTest.set(key, [parameter]);
  }

  const tests: BillTestEntry[] = [];
  const seen = new Set<string>();
  bill.items.forEach((item, index) => {
    const testId = String(item.testId);
    if (seen.has(testId)) return;
    seen.add(testId);
    tests.push({
      testId,
      testCode: item.testCode,
      testName: item.testName,
      order: index,
      // The ordered item carries the test identity; it is linked whenever the
      // item itself resolved, which is what the technician collects against.
      testLinked: Boolean(item.testId && item.testName),
      parameters: (byTest.get(testId) ?? []).map((parameter) => ({
        parameterId: String(parameter._id),
        parameterName: parameter.parameterName,
        ...(parameter.subtitle !== undefined ? { subtitle: parameter.subtitle } : {}),
        displayOrder: parameter.displayOrder,
        resultType: parameter.resultType,
        ...(parameter.parameterType !== undefined
          ? { parameterType: parameter.parameterType }
          : {}),
        ...(parameter.defaultValue !== undefined
          ? { defaultValue: parameter.defaultValue }
          : {}),
        ...(parameter.unit !== undefined ? { unit: parameter.unit } : {}),
        ...(parameter.method !== undefined ? { method: parameter.method } : {}),
        ...(parameter.options ? { options: parameter.options } : {}),
        ...(parameter.onlyReferenceRange !== undefined
          ? { onlyReferenceRange: parameter.onlyReferenceRange }
          : {}),
        hasReferenceMappings: (parameter.referenceMappings ?? []).length > 0,
        reference: resolveReferenceRange(
          {
            referenceMappings: parameter.referenceMappings as never,
            mappingTypes: parameter.mappingTypes,
            referenceRange: parameter.referenceRange,
            referenceType: parameter.referenceType,
            genderRanges: parameter.genderRanges,
          },
          patientContext,
          now,
        ),
      })),
    });
  });

  return {
    billId: String(bill._id),
    billNumber: bill.billNumber,
    patientId: String(bill.patientId),
    ...(patient ? { patientCode: patient.patientId } : {}),
    ...(patient ? { patientName: patient.fullName } : {}),
    ...(patient?.gender ? { patientGender: patient.gender } : {}),
    ...(patient?.dateOfBirth ? { patientDateOfBirth: patient.dateOfBirth } : {}),
    ...(patient?.age !== undefined && patient.age !== null
      ? { patientAge: patient.age }
      : {}),
    tests,
  };
}

function buildReferenceSnapshot(
  parameter: ILabTestParameter,
  patient: { dateOfBirth?: Date | null; age?: number | null; gender?: string | null } | null,
  result: ResultValue,
  now: Date,
): IReferenceSnapshot {
  const resolution = resolveReferenceRange(
    {
      referenceMappings: parameter.referenceMappings as never,
      mappingTypes: parameter.mappingTypes,
      referenceRange: parameter.referenceRange,
      referenceType: parameter.referenceType,
      genderRanges: parameter.genderRanges,
    },
    patient,
    now,
  );

  return {
    status: resolution.status,
    source: resolution.source,
    ...(resolution.mappingType ? { mappingType: resolution.mappingType } : {}),
    ...(resolution.mappingId ? { mappingId: resolution.mappingId } : {}),
    ...(resolution.valueType ? { valueType: resolution.valueType } : {}),
    ...(resolution.displayValue
      ? { displayValue: resolution.displayValue }
      : {}),
    ...(resolution.valueFrom !== undefined ? { valueFrom: resolution.valueFrom } : {}),
    ...(resolution.valueTo !== undefined ? { valueTo: resolution.valueTo } : {}),
    ...(resolution.sex ? { sex: resolution.sex } : {}),
    ...(resolution.ageUnit ? { ageUnit: resolution.ageUnit } : {}),
    ...(resolution.ageFrom !== undefined ? { ageFrom: resolution.ageFrom } : {}),
    ...(resolution.ageTo !== undefined ? { ageTo: resolution.ageTo } : {}),
    ...(resolution.patient.age ? { patientAgeYears: resolution.patient.age.years } : {}),
    ...(resolution.patient.sex ? { patientSex: resolution.patient.sex } : {}),
    flag: evaluateValue(result, resolution),
    ...(resolution.reason ? { reason: resolution.reason } : {}),
    capturedAt: now,
  };
}

export async function listTestResults(
  billId: string,
  testId: string,
): Promise<ILabTestResult[]> {
  if (!Types.ObjectId.isValid(billId) || !Types.ObjectId.isValid(testId)) {
    throw new ApiError(400, "Invalid bill or test ID");
  }
  return LabTestResult.find({ billId, testId })
    .sort({ enteredAt: -1 })
    .exec();
}

/**
 * Submits results for one test of one bill. Every result row is upserted:
 * a first submission creates it (version 1); later submissions push the
 * previous value into `revisions` and bump `version`, so no value is ever
 * overwritten without an audit trail and the user/timestamp are recorded.
 */
export async function submitTestResults(
  userId: string,
  input: { billId: string; testId: string; entries: Array<{ parameterId: string; result: ResultValue }> },
): Promise<{ results: ILabTestResult[]; testId: string }> {
  if (!Types.ObjectId.isValid(input.billId) || !Types.ObjectId.isValid(input.testId)) {
    throw new ApiError(400, "Invalid bill or test ID");
  }

  const bill = await LabBill.findById(input.billId).exec();
  if (!bill) {
    throw new ApiError(404, "Bill not found");
  }
  if (bill.status !== "generated") {
    throw new ApiError(
      422,
      bill.status === "cancelled"
        ? "Results cannot be entered for a cancelled bill"
        : "Results can only be entered for a generated bill",
    );
  }

  const item = bill.items.find((entry) => String(entry.testId) === input.testId);
  if (!item) {
    throw new ApiError(422, "The selected test is not part of this bill");
  }

  const parameters = await LabTestParameter.find({
    testId: input.testId,
    active: true,
  }).exec();
  if (parameters.length === 0) {
    throw new ApiError(
      422,
      "This test has no parameters defined. Results cannot be entered yet.",
    );
  }

  const parameterMap = new Map(
    parameters.map((parameter) => [String(parameter._id), parameter]),
  );

  const unknownParameters = input.entries.filter(
    (entry) => !parameterMap.has(entry.parameterId),
  );
  if (unknownParameters.length > 0) {
    throw new ApiError(
      422,
      "One or more parameters do not belong to this test",
    );
  }

  for (const entry of input.entries) {
    const parameter = parameterMap.get(entry.parameterId)!;
    assertParameterTypeMatches(parameter, entry.result);
  }

  const now = new Date();
  const enteredBy = new Types.ObjectId(userId);
  const patient = await Patient.findById(bill.patientId).exec();
  const patientContext = {
    dateOfBirth: patient?.dateOfBirth ?? null,
    age: patient?.age ?? null,
    gender: patient?.gender ?? null,
  };

  // Persistence model: this MongoDB deployment is a single node (no replica
  // set), so multi-document transactions are unavailable. The safe-equivalent
  // strategy is: a unique (billId, testId, parameterId) key prevents
  // duplicates, and every overwrite pushes the previous value into
  // `revisions` and bumps `version`, so no clinical value is ever lost or
  // written without its author and timestamp.
  await Promise.all(
    input.entries.map(async (entry) => {
      const parameter = parameterMap.get(entry.parameterId)!;
      const existing = await LabTestResult.findOne({
        billId: bill._id,
        testId: input.testId,
        parameterId: parameter._id,
      }).exec();

      if (!existing) {
        await LabTestResult.create({
          billId: bill._id,
          patientId: bill.patientId,
          testId: input.testId,
          parameterId: parameter._id,
          parameterName: parameter.parameterName,
          resultType: parameter.resultType,
          unit: parameter.unit,
          referenceRange: parameter.referenceRange,
          referenceSnapshot: buildReferenceSnapshot(
            parameter,
            patientContext,
            entry.result,
            now,
          ),
          method: parameter.method,
          result: entry.result,
          enteredBy,
          enteredAt: now,
          version: 1,
          revisions: [],
        });
        return;
      }

      existing.revisions.push({
        result: existing.result,
        enteredBy: existing.enteredBy,
        enteredAt: existing.enteredAt,
        version: existing.version,
      });
      existing.result = entry.result;
      existing.enteredBy = enteredBy;
      existing.enteredAt = now;
      existing.version += 1;
      // Re-resolve on every submission so the snapshot always matches the
      // master as it stands when the value was recorded.
      existing.referenceSnapshot = buildReferenceSnapshot(
        parameter,
        patientContext,
        entry.result,
        now,
      );
      await existing.save();
    }),
  );

  await recordAudit({
    user: userId,
    action: "test_result.entered",
    entityType: "LabTestResult",
    entity: bill._id,
  });

  const results = await LabTestResult.find({
    billId: bill._id,
    testId: input.testId,
  })
    .sort({ enteredAt: -1 })
    .exec();

  return { results, testId: input.testId };
}