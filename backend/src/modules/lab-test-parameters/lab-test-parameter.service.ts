import { Types, type FilterQuery, type HydratedDocument } from "mongoose";
import { ApiError } from "../../utils/api-error";
import { isValidObjectId } from "../../utils/object-id";
import { LabTest, type ILabTest } from "../../models/lab-test.model";
import { Department } from "../../models/department.model";
import {
  GENDER_RANGE_LABELS,
  LabTestParameter,
  REFERENCE_MAPPING_PRIORITY,
  type ILabTestParameter,
  type IReferenceMapping,
  type ParameterReferenceScope,
  type ReferenceMappingType,
} from "../../models/lab-test-parameter.model";
import { LabTestResult } from "../../models/lab-test-result.model";
import { recordAudit } from "../audit/audit.service";
import { validateMappingSet } from "../../validations/lab-test-parameter";
import { z } from "zod";

/** A reference mapping as returned by the API. */
export interface ParameterMapping {
  id: string;
  mappingType: IReferenceMapping["mappingType"];
  valueType: IReferenceMapping["valueType"];
  sex?: IReferenceMapping["sex"];
  ageUnit?: IReferenceMapping["ageUnit"];
  ageFrom?: number;
  ageTo?: number;
  valueFrom?: number;
  valueTo?: number;
  displayValue?: string;
  /** Legacy Status (Y/N). */
  active: boolean;
}

/** Which mapping types a parameter supports and how many of each it has. */
export interface ReferenceMappingSummary {
  /** Supported types, always most-specific first. */
  mappingTypes: ReferenceMappingType[];
  mappingCount: number;
  counts: Partial<Record<ReferenceMappingType, number>>;
}

export interface ParameterRow extends ReferenceMappingSummary {
  id: string;
  testId: string;
  departmentId?: string;
  departmentName?: string;
  testName?: string;
  parameterName: string;
  subtitle?: string;
  displayOrder: number;
  resultType: ILabTestParameter["resultType"];
  parameterType?: string;
  defaultValue?: string;
  unit?: string;
  referenceRange?: string;
  referenceType: ILabTestParameter["referenceType"];
  referenceScope?: ParameterReferenceScope;
  onlyReferenceRange?: boolean;
  rangeFrom?: number;
  rangeTo?: number;
  rangeText?: string;
  genderRanges?: ILabTestParameter["genderRanges"];
  method?: string;
  options?: string[];
  needsLabReview?: boolean;
  reviewReason?: string;
  rangeSource?: string;
  rangeSourceUrl?: string;
  active: boolean;
}

/** Full parameter detail, including every reference mapping. */
export interface ParameterDetail extends ParameterRow {
  referenceMappings: ParameterMapping[];
}

export interface PaginatedParameters {
  data: ParameterRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type CreateParameterInput = Omit<
  ILabTestParameter,
  "createdBy" | "createdAt" | "updatedAt"
>;
export type UpdateParameterInput = Partial<
  Omit<ILabTestParameter, "createdBy" | "createdAt" | "updatedAt">
>;

/** A persisted parameter document (mongoose docs expose `_id`). */
export type ParameterDoc = ILabTestParameter & { _id: Types.ObjectId };

function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof Error && (error as { code?: number }).code === 11000;
}

/** Builds the display string stored in `referenceRange` (used by reports). */
export function composeReferenceRange(
  value: Pick<
    ILabTestParameter,
    | "referenceType"
    | "rangeFrom"
    | "rangeTo"
    | "rangeText"
    | "genderRanges"
  >,
): string | undefined {
  // The stored free-text range is the authoritative display: it is exactly what
  // the source catalogue and the old LIS show. It is never re-derived from the
  // numeric bounds, so editing a parameter cannot rewrite source text such as
  // "<200" or "40-440Cells/Cumm" into a normalised "40–440".
  const storedText = value.rangeText?.trim();
  if (storedText) return storedText;

  const formatSingle = (
    range: { from?: number; to?: number; text?: string },
  ): string => {
    const text = range.text?.trim();
    if (text && range.from === undefined && range.to === undefined) {
      return text;
    }
    if (range.from !== undefined && range.to !== undefined) {
      return `${range.from}–${range.to}`;
    }
    if (range.from !== undefined) return `≥${range.from}`;
    if (range.to !== undefined) return `≤${range.to}`;
    return text ?? "";
  };

  if (value.referenceType === "GENDER_WISE") {
    const ranges = value.genderRanges ?? [];
    if (ranges.length === 0) return undefined;
    return ranges
      .map((range) => `${GENDER_RANGE_LABELS[range.gender]} ${formatSingle(range)}`)
      .join(" / ");
  }

  const single = formatSingle({
    from: value.rangeFrom,
    to: value.rangeTo,
    text: value.rangeText,
  });
  return single || undefined;
}

async function ensureTestExists(id: string): Promise<void> {
  if (!isValidObjectId(id)) {
    throw new ApiError(400, "Invalid test ID");
  }
  const test = await LabTest.findById(id).exec();
  if (!test) {
    throw new ApiError(422, "The selected lab test does not exist");
  }
}

function isParameterMode(filter: string | undefined): boolean | undefined {
  if (filter === "parameter") return false;
  if (filter === "template") return true;
  return undefined;
}

/**
 * Supported mapping types, always most-specific first.
 *
 * Derived from the stored mappings and written back to the parameter, so the
 * recorded policy can never drift from the rows that actually exist.
 */
export function summariseMappings(
  mappings: IReferenceMapping[] | undefined,
): ReferenceMappingSummary {
  const list = mappings ?? [];
  const counts: Partial<Record<ReferenceMappingType, number>> = {};
  for (const mapping of list) {
    counts[mapping.mappingType] = (counts[mapping.mappingType] ?? 0) + 1;
  }
  const mappingTypes = REFERENCE_MAPPING_PRIORITY.filter((type) =>
    list.some((mapping) => mapping.mappingType === type),
  );
  return { mappingTypes, mappingCount: list.length, counts };
}

/** Converts a stored subdocument to its API shape. */
export function toParameterMapping(doc: IReferenceMapping): ParameterMapping {
  const rawId = (doc as IReferenceMapping & { _id?: unknown })._id;
  return {
    id: rawId ? String(rawId) : "",
    mappingType: doc.mappingType,
    valueType: doc.valueType,
    ...(doc.sex !== undefined ? { sex: doc.sex } : {}),
    ...(doc.ageUnit !== undefined ? { ageUnit: doc.ageUnit } : {}),
    ...(doc.ageFrom !== undefined ? { ageFrom: doc.ageFrom } : {}),
    ...(doc.ageTo !== undefined ? { ageTo: doc.ageTo } : {}),
    ...(doc.valueFrom !== undefined ? { valueFrom: doc.valueFrom } : {}),
    ...(doc.valueTo !== undefined ? { valueTo: doc.valueTo } : {}),
    ...(doc.displayValue ? { displayValue: doc.displayValue } : {}),
    // Status is part of the row even when a record predates the field, because
    // mongoose hydrates the schema default as true.
    active: doc.active ?? true,
  };
}

function row(doc: ILabTestParameter): ParameterRow {
  return {
    ...summariseMappings(doc.referenceMappings as IReferenceMapping[]),
    id: String((doc as ILabTestParameter & { _id: unknown })._id),
    testId: String(doc.testId),
    parameterName: doc.parameterName,
    subtitle: doc.subtitle,
    displayOrder: doc.displayOrder,
    resultType: doc.resultType,
    parameterType: doc.parameterType,
    defaultValue: doc.defaultValue,
    unit: doc.unit,
    referenceRange: doc.referenceRange,
    referenceType: doc.referenceType,
    referenceScope: doc.referenceScope ?? "GENERIC",
    onlyReferenceRange: doc.onlyReferenceRange,
    rangeFrom: doc.rangeFrom,
    rangeTo: doc.rangeTo,
    rangeText: doc.rangeText,
    genderRanges: doc.genderRanges,
    method: doc.method,
    options: doc.options,
    needsLabReview: doc.needsLabReview ?? false,
    reviewReason: doc.reviewReason,
    rangeSource: doc.rangeSource,
    rangeSourceUrl: doc.rangeSourceUrl,
    active: doc.active,
  };
}

export async function listParameters({
  departmentId,
  testId,
  mode,
  search,
  review,
  page,
  limit,
}: {
  departmentId?: string;
  testId?: string;
  mode?: string;
  search?: string;
  review?: string;
  page: number;
  limit: number;
}): Promise<PaginatedParameters> {
  let ledgerFilter: FilterQuery<ILabTestParameter> = {};

  if (testId) {
    ledgerFilter.testId = isValidObjectId(testId)
      ? new Types.ObjectId(testId)
      : new Types.ObjectId("000000000000000000000000");
  } else {
    const testFilter: FilterQuery<ILabTest> = {};
    if (departmentId) {
      testFilter.departmentId = isValidObjectId(departmentId)
        ? new Types.ObjectId(departmentId)
        : new Types.ObjectId("000000000000000000000000");
    }
    const templateFilter = isParameterMode(mode);
    if (templateFilter !== undefined) {
      testFilter.resultMode = templateFilter
        ? "TEMPLATE_BASED"
        : { $ne: "TEMPLATE_BASED" };
    }
    const tests = await LabTest.find(testFilter).select("_id").exec();
    if (tests.length === 0) {
      return {
        data: [],
        pagination: { page, limit, total: 0, totalPages: 1 },
      };
    }
    // `testId` is an indexed ObjectId on every row, so matching against the
    // tests' own ids keeps this on the index. An ObjectId-only comparison would
    // silently hide any row still storing a hex string there, which is why the
    // seeded catalogue was checked to hold none.
    ledgerFilter.testId = { $in: tests.map((test) => test._id) };
  }

  const keyword = search?.trim();
  if (keyword) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    ledgerFilter.$or = [
      { parameterName: { $regex: escaped, $options: "i" } },
      { subtitle: { $regex: escaped, $options: "i" } },
      { unit: { $regex: escaped, $options: "i" } },
    ];
  }

  // "needs-review" -> only parameters awaiting lab confirmation of their range.
  if (review === "needs-review") {
    ledgerFilter.needsLabReview = true;
  } else if (review === "reviewed") {
    ledgerFilter.needsLabReview = { $ne: true };
  }

  const [docs, total] = await Promise.all([
    LabTestParameter.find(ledgerFilter)
      .sort({ displayOrder: 1, parameterName: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
    LabTestParameter.countDocuments(ledgerFilter),
  ]);

  const testIds = [...new Set(docs.map((doc) => String(doc.testId)))];
  const [tests, departments] = await Promise.all([
    LabTest.find({ _id: { $in: testIds } }).select("testName departmentId").exec(),
    Department.find().select("name").exec(),
  ]);
  const testMap = new Map(tests.map((test) => [String(test._id), test]));
  const departmentNameMap = new Map(
    departments.map((department) => [String(department._id), department.name]),
  );

  const data: ParameterRow[] = docs.map((doc) => {
    const test = testMap.get(String(doc.testId));
    return {
      ...row(doc),
      testName: test?.testName,
      departmentId: test ? String(test.departmentId) : undefined,
      departmentName: test
        ? departmentNameMap.get(String(test.departmentId)) ?? "Unassigned"
        : undefined,
    };
  });

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function listSubtitles(testId: string): Promise<string[]> {
  if (!isValidObjectId(testId)) {
    throw new ApiError(400, "Invalid test ID");
  }
  const docs = await LabTestParameter.find({
    testId,
    subtitle: { $exists: true, $ne: "" },
  })
    .distinct("subtitle")
    .exec();
  return docs
    .map((value) => String(value).trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export async function createParameter(
  userId: string,
  input: CreateParameterInput,
): Promise<ParameterDoc> {
  await ensureTestExists(String(input.testId));
  const referenceRange = composeReferenceRange(input);
  try {
    return await LabTestParameter.create({
      ...input,
      referenceRange,
      createdBy: userId,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(
        409,
        "A parameter with this name already exists for the selected test",
      );
    }
    throw error;
  }
}

export async function updateParameter(
  id: string,
  userId: string,
  input: UpdateParameterInput,
): Promise<ParameterDoc> {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid parameter ID");
  }
  const parameter = await LabTestParameter.findById(id).exec();
  if (!parameter) {
    throw new ApiError(404, "Lab test parameter not found");
  }
  if (input.testId !== undefined) {
    await ensureTestExists(String(input.testId));
  }
  Object.assign(parameter, input, {
    updatedBy: new Types.ObjectId(userId),
  });
  const hasRangeKey = (
    ["referenceType", "rangeFrom", "rangeTo", "rangeText", "genderRanges"] as const
  ).some((key) => Object.prototype.hasOwnProperty.call(input, key));
  if (hasRangeKey) {
    parameter.referenceRange = composeReferenceRange({
      referenceType: input.referenceType ?? parameter.referenceType,
      rangeFrom: Object.prototype.hasOwnProperty.call(input, "rangeFrom")
        ? input.rangeFrom
        : parameter.rangeFrom,
      rangeTo: Object.prototype.hasOwnProperty.call(input, "rangeTo")
        ? input.rangeTo
        : parameter.rangeTo,
      rangeText: Object.prototype.hasOwnProperty.call(input, "rangeText")
        ? input.rangeText
        : parameter.rangeText,
      genderRanges: Object.prototype.hasOwnProperty.call(input, "genderRanges")
        ? input.genderRanges
        : parameter.genderRanges,
    });
    // A user editing the range is the lab's review of it: clear the
    // "Needs Lab Review" marker unless the caller states otherwise.
    if (!Object.prototype.hasOwnProperty.call(input, "needsLabReview")) {
      parameter.needsLabReview = false;
      parameter.reviewReason = undefined;
    }
  }
  try {
    return await parameter.save();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(
        409,
        "A parameter with this name already exists for the selected test",
      );
    }
    throw error;
  }
}

export async function getParameter(id: string): Promise<ParameterDetail> {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid parameter ID");
  }
  const parameter = await LabTestParameter.findById(id).exec();
  if (!parameter) {
    throw new ApiError(404, "Lab test parameter not found");
  }

  const test = await LabTest.findById(parameter.testId)
    .select("testName departmentId")
    .lean()
    .exec();
  const department = test?.departmentId
    ? await Department.findById(test.departmentId).select("name").lean().exec()
    : null;

  return {
    ...row(parameter),
    testName: test?.testName,
    ...(test ? { departmentId: String(test.departmentId) } : {}),
    departmentName: test ? (department?.name ?? "Unassigned") : undefined,
    referenceMappings: (parameter.referenceMappings ?? []).map((mapping) =>
      toParameterMapping(mapping as IReferenceMapping),
    ),
  };
}

async function loadParameterForWrite(
  id: string,
): Promise<HydratedDocument<ILabTestParameter>> {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid parameter ID");
  }
  const parameter = await LabTestParameter.findById(id).exec();
  if (!parameter) {
    throw new ApiError(404, "Lab test parameter not found");
  }
  return parameter as unknown as HydratedDocument<ILabTestParameter>;
}

export type ReferenceMappingInput = z.infer<
  (typeof import("../../validations/lab-test-parameter"))["referenceMappingInputSchema"]
>;

/**
 * Refuses a mapping set in which two mappings of the same type cover the same
 * sex and age window, because any patient in that overlap would have two
 * equally applicable ranges.
 */
function assertNoOverlappingMappings(mappings: IReferenceMapping[]): void {
  const ctx = {
    addIssue: (issue: { message: string }) => {
      throw new ApiError(422, issue.message);
    },
  } as unknown as z.RefinementCtx;
  validateMappingSet(
    mappings.map((mapping) => ({
      mappingType: mapping.mappingType,
      ...(mapping.sex !== undefined ? { sex: mapping.sex } : {}),
      ...(mapping.ageUnit !== undefined ? { ageUnit: mapping.ageUnit } : {}),
      ...(mapping.ageFrom !== undefined ? { ageFrom: mapping.ageFrom } : {}),
      ...(mapping.ageTo !== undefined ? { ageTo: mapping.ageTo } : {}),
    })),
    ctx,
  );
}

/** Recomputes the stored mapping-type policy after a mapping change. */
function syncMappingTypes(parameter: ILabTestParameter): void {
  const summary = summariseMappings(parameter.referenceMappings as IReferenceMapping[]);
  parameter.mappingTypes =
    summary.mappingTypes.length > 0 ? summary.mappingTypes : undefined;
}

export async function listReferenceMappings(
  id: string,
): Promise<{ data: ParameterMapping[]; summary: ReferenceMappingSummary }> {
  const parameter = await loadParameterForWrite(id);
  return {
    data: (parameter.referenceMappings ?? []).map((mapping) =>
      toParameterMapping(mapping as IReferenceMapping),
    ),
    summary: summariseMappings(parameter.referenceMappings as IReferenceMapping[]),
  };
}

export async function createReferenceMapping(
  id: string,
  userId: string,
  input: ReferenceMappingInput,
): Promise<ParameterDetail> {
  const parameter = await loadParameterForWrite(id);
  const candidate: IReferenceMapping = {
    mappingType: input.mappingType,
    valueType: input.valueType ?? "NUMERIC",
    ...(input.sex !== undefined ? { sex: input.sex } : {}),
    ...(input.ageUnit !== undefined ? { ageUnit: input.ageUnit } : {}),
    ...(input.ageFrom !== undefined ? { ageFrom: input.ageFrom } : {}),
    ...(input.ageTo !== undefined ? { ageTo: input.ageTo } : {}),
    ...(input.valueFrom !== undefined ? { valueFrom: input.valueFrom } : {}),
    ...(input.valueTo !== undefined ? { valueTo: input.valueTo } : {}),
    ...(input.displayValue !== undefined ? { displayValue: input.displayValue } : {}),
    active: input.active ?? true,
    createdBy: new Types.ObjectId(userId),
  };

  const existing = (parameter.referenceMappings ?? []) as StoredMapping[];
  const nextMappings = [...existing.map((mapping) => plainMappingFields(mapping, true)), candidate];
  assertNoOverlappingMappings(nextMappings);

  parameter.referenceMappings = nextMappings as never;
  syncMappingTypes(parameter);
  parameter.updatedBy = new Types.ObjectId(userId);
  await parameter.save();

  await recordAudit({
    user: userId,
    action: "lab_parameter.mapping_created",
    entityType: "LabTestParameter",
    entity: parameter._id,
  });

  return getParameter(String(parameter._id));
}

type StoredMapping = IReferenceMapping & { _id?: Types.ObjectId };

/**
 * Plain field extraction for a stored mapping.
 *
 * A Mongoose subdocument keeps its fields behind prototype accessors, so
 * spreading one does not copy them. Every mapping field is therefore read
 * explicitly before it is merged, validated or written back.
 *
 * `keepId` carries the subdocument id through a rewrite. A mapping id must stay
 * stable: saved test results reference the exact mapping that applied, so
 * reassigning ids would detach historical results from their reference.
 */
function plainMappingFields(mapping: StoredMapping, keepId = false): StoredMapping {
  const id = mapping._id instanceof Types.ObjectId ? mapping._id : undefined;
  return {
    ...(keepId && id ? { _id: id } : {}),
    mappingType: mapping.mappingType,
    valueType: mapping.valueType,
    ...(mapping.sex !== undefined ? { sex: mapping.sex } : {}),
    ...(mapping.ageUnit !== undefined ? { ageUnit: mapping.ageUnit } : {}),
    ...(mapping.ageFrom !== undefined ? { ageFrom: mapping.ageFrom } : {}),
    ...(mapping.ageTo !== undefined ? { ageTo: mapping.ageTo } : {}),
    ...(mapping.valueFrom !== undefined ? { valueFrom: mapping.valueFrom } : {}),
    ...(mapping.valueTo !== undefined ? { valueTo: mapping.valueTo } : {}),
    ...(mapping.displayValue !== undefined ? { displayValue: mapping.displayValue } : {}),
    ...(mapping.active !== undefined ? { active: mapping.active } : {}),
  };
}

export async function updateReferenceMapping(
  id: string,
  mappingId: string,
  userId: string,
  input: Partial<ReferenceMappingInput>,
): Promise<ParameterDetail> {
  const parameter = await loadParameterForWrite(id);
  const mappings = (parameter.referenceMappings ?? []) as StoredMapping[];
  const index = mappings.findIndex(
    (mapping) => mapping._id && String(mapping._id) === mappingId,
  );
  if (index === -1) {
    throw new ApiError(404, "Reference mapping not found on this parameter");
  }

  const pick = <K extends keyof IReferenceMapping>(key: K): IReferenceMapping[K] =>
    Object.prototype.hasOwnProperty.call(input, key)
      ? ((input as Record<string, unknown>)[key] as IReferenceMapping[K])
      : (mappings[index][key] as IReferenceMapping[K]);

  const merged: StoredMapping = {
    ...plainMappingFields(mappings[index], true),
    mappingType: pick("mappingType"),
    valueType: pick("valueType") ?? "NUMERIC",
    ...(pick("sex") !== undefined ? { sex: pick("sex") } : {}),
    ...(pick("ageUnit") !== undefined ? { ageUnit: pick("ageUnit") } : {}),
    ...(pick("ageFrom") !== undefined ? { ageFrom: pick("ageFrom") } : {}),
    ...(pick("ageTo") !== undefined ? { ageTo: pick("ageTo") } : {}),
    ...(pick("valueFrom") !== undefined ? { valueFrom: pick("valueFrom") } : {}),
    ...(pick("valueTo") !== undefined ? { valueTo: pick("valueTo") } : {}),
    ...(pick("displayValue") !== undefined ? { displayValue: pick("displayValue") } : {}),
    ...(pick("active") !== undefined ? { active: pick("active") } : {}),
    updatedBy: new Types.ObjectId(userId),
  };

  // Switching the radio in the modal retargets an existing row, so anything
  // that belonged to the previous type has to go: a SEX_WISE row converted to
  // AGE_WISE would otherwise still carry `sex`, which the schema rejects, and
  // the user would get a validation error instead of a converted mapping.
  const nextType = merged.mappingType;
  if (nextType !== "SEX_WISE" && nextType !== "AGE_SEX_WISE") {
    delete merged.sex;
  }
  if (nextType !== "AGE_WISE" && nextType !== "AGE_SEX_WISE") {
    delete merged.ageUnit;
    delete merged.ageFrom;
    delete merged.ageTo;
  }
  if (merged.valueType !== "NUMERIC") {
    delete merged.valueFrom;
    delete merged.valueTo;
  }

  const candidateSet = mappings.map((mapping, position) =>
    position === index ? merged : plainMappingFields(mapping, true),
  );
  assertNoOverlappingMappings(candidateSet);

  parameter.referenceMappings = candidateSet as never;
  syncMappingTypes(parameter);
  parameter.updatedBy = new Types.ObjectId(userId);
  await parameter.save();

  await recordAudit({
    user: userId,
    action: "lab_parameter.mapping_updated",
    entityType: "LabTestParameter",
    entity: parameter._id,
  });

  return getParameter(String(parameter._id));
}

export async function deleteReferenceMapping(
  id: string,
  mappingId: string,
  userId: string,
): Promise<ParameterDetail> {
  const parameter = await loadParameterForWrite(id);
  const mappings = (parameter.referenceMappings ?? []) as Array<
    IReferenceMapping & { _id?: Types.ObjectId }
  >;
  const remaining = mappings.filter(
    (mapping) => !(mapping._id && String(mapping._id) === mappingId),
  );
  if (remaining.length === mappings.length) {
    throw new ApiError(404, "Reference mapping not found on this parameter");
  }

  parameter.referenceMappings = remaining as never;
  syncMappingTypes(parameter);
  parameter.updatedBy = new Types.ObjectId(userId);
  await parameter.save();

  await recordAudit({
    user: userId,
    action: "lab_parameter.mapping_deleted",
    entityType: "LabTestParameter",
    entity: parameter._id,
  });

  return getParameter(String(parameter._id));
}

/**
 * Deletes a parameter.
 *
 * Refused while any test result references it, because historical results must
 * keep the parameter they were recorded against. No result currently references
 * the seeded parameters, but the guard keeps that true as result entry is used.
 */
export async function deleteParameter(
  id: string,
  userId: string,
): Promise<{ id: string; parameterName: string }> {
  const parameter = await loadParameterForWrite(id);

  const resultCount = await LabTestResult.countDocuments({
    parameterId: parameter._id,
  });
  if (resultCount > 0) {
    throw new ApiError(
      409,
      "This parameter is used by " +
        resultCount +
        " saved test result" +
        (resultCount === 1 ? "" : "s") +
        " and cannot be deleted. Historical results must keep the parameter they were recorded against.",
    );
  }

  await LabTestParameter.deleteOne({ _id: parameter._id });

  await recordAudit({
    user: userId,
    action: "lab_parameter.deleted",
    entityType: "LabTestParameter",
    entity: parameter._id,
  });

  return { id: String(parameter._id), parameterName: parameter.parameterName };
}

export async function setParameterActive(
  id: string,
  userId: string,
  active: boolean,
): Promise<ParameterDoc> {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid parameter ID");
  }
  const parameter = await LabTestParameter.findById(id).exec();
  if (!parameter) {
    throw new ApiError(404, "Lab test parameter not found");
  }
  parameter.active = active;
  parameter.updatedBy = new Types.ObjectId(userId);
  await parameter.save();

  await recordAudit({
    user: userId,
    action: active ? "lab_parameter.activated" : "lab_parameter.deactivated",
    entityType: "LabTestParameter",
    entity: parameter._id,
  });

  return parameter;
}