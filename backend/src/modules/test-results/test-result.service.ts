import { withSampleResultWrite } from "../lab-samples/recollection.service";
import {cbpSyntheticExecution} from "../lab-test-parameters/cbp-synthetic-execution.service";
import { formulaEditorContextAllowed } from "../../utils/formula-editor-context";
import { applyCalculationProposals, type CalculationProposal } from "../../utils/configured-calculations";
import { recalculateConfigured, resolveCalculationDependencyIds, normalizeCalculationOverwrite, reviewCalculationBinding, resolveTestCalculations } from "../../utils/configured-calculations";
import { Types } from "mongoose";
import {ParameterVersion} from "../../models/parameter-version.model";
import { routeParameterVersions, recordedParameterProjection } from "../../utils/parameter-version-routing";
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
import { AuditLog } from "../../models/audit-log.model";
import { SUBMISSION_PENDING, SUBMISSION_CONFIRMED } from "./result-workflow.service";

/** Upper bound for free-text results (e.g. microscopy notes). */
const RESULT_TEXT_MAX = 2000;

function developmentEditorAvailable(billNumber?:string,patientCode?:string):boolean {
  return formulaEditorContextAllowed({environment:process.env.NODE_ENV,uri:process.env.MONGODB_URI,database:LabTestResult.db.name,host:LabTestResult.db.host,billNumber,patientCode});
}
/** Direct development configuration or clinical approval both make a binding executable. */
function hasExecutableCalculation(parameter: ILabTestParameter): boolean {
  return Boolean(parameter.calculation && parameter.calculation.enabled !== false);
}
function bindingIssues(parameters: ILabTestParameter[], target: ILabTestParameter): string[] {
  if (target.itemType && target.itemType !== "PARAMETER") return ['Calculated targets must be result parameters, not subtitles or text areas'];
  const rows=parameters.map(p=>({id:String((p as ILabTestParameter & {_id:Types.ObjectId})._id),unit:p.unit,resultType:p.resultType,itemType:p.itemType,active:p.active,calculation:p.calculation}));
  return reviewCalculationBinding(rows,rows.find(p=>p.id===String((target as ILabTestParameter & {_id:Types.ObjectId})._id))!);
}

function assertParameterTypeMatches(
  parameter: ILabTestParameter,
  value: ResultValue,
): void {
  if (parameter.itemType === "SUBTITLE") throw new ApiError(422,"Subtitles are headings, not result fields");
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
      // TEXT is the catch-all result type: accept strings and numbers.
      // Historical parameters (e.g. CBP) remain TEXT when recorded results
      // exist; numeric entries are stored as-is and participate in formulas.
      if (typeof value === "string") {
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
      } else if (typeof value === "number") {
        if (!Number.isFinite(value)) {
          throw new ApiError(
            422,
            `Result for "${parameter.parameterName}" must be a finite number`,
          );
        }
      } else {
        throw new ApiError(
          422,
          `Result for "${parameter.parameterName}" must be text`,
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
  const catalogue = await LabTestParameter.find({ testId, active: true })
    .sort({ displayOrder: 1, parameterName: 1 })
    .exec();
  return routeParameterVersions(catalogue,undefined);
}

/** One ordered test of a bill, with its parameters and applicable references. */
export interface BillTestEntry {
  testId: string;
  collectionId?: string;
  testCode: string;
  testName: string;
  /** Position of this test in the bill's ordered items. */
  order: number;
  /** False when the bill item no longer links to a usable test master. */
  testLinked: boolean;
  parameters: Array<{
    parameterId: string;
    parameterName: string;
    itemType?: ILabTestParameter["itemType"];
    calculation?: ILabTestParameter["calculation"];
    calculationApproval?: ILabTestParameter["calculationApproval"];
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
      })
        .sort({ displayOrder: 1, parameterName: 1 })
        .exec()
    : [];
  const savedRows = await LabTestResult.find({billId:bill._id}).exec();
  const pinnedIds=bill.items.flatMap(item=>item.parameterVersionIds??[]);
  if(pinnedIds.some(id=>!parameters.some(p=>String(p._id)===id)))parameters.push(...await ParameterVersion.find({_id:{$in:pinnedIds},testId:{$in:bill.items.map(item=>item.testId)}}).exec());
  const byTest = new Map<string, typeof parameters>();
  for (const parameter of parameters) {
    const key = String(parameter.testId);
    const bucket = byTest.get(key);
    if (bucket) bucket.push(parameter);
    else byTest.set(key, [parameter]);
  }

  const tests: BillTestEntry[] = [];
  const seen = new Set<string>();
  for (const [index,item] of bill.items.entries()) {
    const testId = String(item.testId);
    if (seen.has(testId)) continue;
    seen.add(testId);
    const development = await cbpSyntheticExecution(bill,patient?.patientId,testId);
    const routed = routeParameterVersions(byTest.get(testId) ?? [],item.parameterVersionIds,savedRows.filter(row=>String(row.testId)===testId));
    tests.push({
      testId,
      collectionId: item.activeCollectionId?.toString(),
      testCode: item.testCode,
      testName: item.testName,
      order: index,
      // The ordered item carries the test identity; it is linked whenever the
      // item itself resolved, which is what the technician collects against.
      testLinked: Boolean(item.testId && item.testName),
      parameters: (() => {
        const rows = routed.map((master) => {
          const saved=savedRows.find(row=>String(row.testId)===testId&&String(row.parameterId)===String(master._id));
          const projection=recordedParameterProjection(master.toObject ? master.toObject() : master,saved);
          const parameter=development && development.bindings.some(b=>b.targetId===String(master._id)||b.calculation.dependencyIds?.includes(String(master._id))) ? {...projection,resultType:"NUMBER" as const} : projection;
          const persisted = parameter.calculation && hasExecutableCalculation(parameter) && !bindingIssues(routed,parameter).length ? parameter.calculation : undefined;
          return { parameter, persisted, saved };
        });
        // Central discovery: a persisted approved binding wins, otherwise the
        // predefined registry mapping is used. No per-test binding is required.
        const resolutions = resolveTestCalculations(rows.map(({parameter,persisted}) => ({
          parameterId: String(parameter._id),
          parameterName: parameter.parameterName,
          unit: parameter.unit,
          itemType: parameter.itemType ?? "PARAMETER",
          active: parameter.active,
          resultType: parameter.resultType,
          calculation: parameter.calculation?.enabled === false ? parameter.calculation : persisted,
        })));
        if(development)for(const binding of development.bindings)resolutions.set(binding.targetId,{config:binding.calculation,status:"DEVELOPMENT"});
        return rows.map(({parameter, saved}) => {
        const resolution = resolutions.get(String(parameter._id));
        return ({
        parameterId: String(parameter._id),
        parameterName: parameter.parameterName,
        itemType: parameter.itemType ?? "PARAMETER",
        calculation: (resolution?.config ?? (parameter.calculation?.enabled === false ? parameter.calculation : undefined)) as ILabTestParameter["calculation"] | undefined,
        ...(resolution ? { calculationStatus: resolution.status } : {}),
        calculationEditingAllowed: developmentEditorAvailable(bill.billNumber,patient?.patientId),
        calculationApproval: parameter.calculationApproval,
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
            itemType: parameter.itemType,
            resultType: parameter.resultType,
            referenceMappings: saved ? [] : parameter.referenceMappings as never,
            mappingTypes: saved ? [] : parameter.mappingTypes,
            referenceRange: saved ? saved.referenceSnapshot?.displayValue ?? saved.referenceRange : parameter.referenceRange,
            referenceType: saved ? "GENERAL" : parameter.referenceType,
            genderRanges: saved ? [] : parameter.genderRanges,
          },
          patientContext,
          now,
        ),
      });});
      })(),
    });
  }

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
      itemType: parameter.itemType,
      resultType: parameter.resultType,
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
  input: { billId: string; testId: string; collectionId?: string; calculationProposals?:CalculationProposal[]; acceptedCalculationIds?:string[]; acceptedCalculationRevisions?:Record<string,number>; entries: Array<{ parameterId: string; result: ResultValue }> },
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

  const catalogue = await LabTestParameter.find({
    testId: input.testId,
  }).exec();
  const savedRows = await LabTestResult.find({billId:bill._id,testId:input.testId}).exec();
  if(item.parameterVersionIds?.some(id=>!catalogue.some(p=>String(p._id)===id)))catalogue.push(...await ParameterVersion.find({_id:{$in:item.parameterVersionIds},testId:input.testId}).exec());
  const developmentPatient=await Patient.findById(bill.patientId).exec();
  const development=await cbpSyntheticExecution(bill,developmentPatient?.patientId,input.testId);
  const parameters = routeParameterVersions(catalogue,item.parameterVersionIds,savedRows).map(p=>development && development.bindings.some(b=>b.targetId===String(p._id)||b.calculation.dependencyIds?.includes(String(p._id))) ? LabTestParameter.hydrate({...p.toObject(),resultType:"NUMBER"}) : p);
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
  if (!input.entries.length || new Set(input.entries.map((entry) => entry.parameterId)).size !== input.entries.length) {
    throw new ApiError(422, "Submit at least one result with unique parameter IDs");
  }
  if (unknownParameters.length > 0) {
    throw new ApiError(
      422,
      "One or more parameters do not belong to this test",
    );
  }

  // Validate binding issues only for ACTIVE calculations. Inactive calculations
  // (enabled === false) are not executed and do not block submission of manual
  // results; resolveTestCalculations below skips them entirely.
  for (const parameter of parameters.filter(row=>row.calculation && hasExecutableCalculation(row))) {
    const issues=bindingIssues(parameters,parameter);
    if (issues.length) throw new ApiError(422,issues[0]);
  }
  // Central discovery at submission: a configured binding (direct or approved)
  // or an approved registry mapping is executable; a registry mapping that is
  // still PENDING is not, and is treated as a manual parameter.
  const resolutions = resolveTestCalculations(parameters.map(parameter=>({parameterId:String(parameter._id),parameterName:parameter.parameterName,unit:parameter.unit,itemType:parameter.itemType,active:parameter.active,resultType:parameter.resultType,calculation:parameter.calculation?.enabled === false ? parameter.calculation : parameter.calculation && hasExecutableCalculation(parameter) && !bindingIssues(parameters,parameter).length ? parameter.calculation : undefined})));
  if(development)for(const binding of development.bindings)resolutions.set(binding.targetId,{config:binding.calculation,status:"DEVELOPMENT"});
  const proposals=input.calculationProposals??[];
  const proposalPatient=proposals.length?await Patient.findById(bill.patientId).exec():undefined;
  if(proposals.length&&!developmentEditorAvailable(bill.billNumber,proposalPatient?.patientId))throw new ApiError(422,"One-time formula edits are restricted to the isolated development database");
  let proposedParameters;
  try {proposedParameters=applyCalculationProposals(parameters.map(parameter=>({parameterId:String(parameter._id),parameterName:parameter.parameterName,unit:parameter.unit,resultType:parameter.resultType,itemType:parameter.itemType,active:parameter.active,calculation:(["APPROVED","DEVELOPMENT"].includes(resolutions.get(String(parameter._id))?.status??""))?resolutions.get(String(parameter._id))?.config:undefined})),proposals);}catch(error){throw new ApiError(422,error instanceof Error?error.message:"Invalid formula proposal");}
  const executable = (parameter: { _id: unknown } | undefined) => {
    if (!parameter) return undefined;
    const resolution = resolutions.get(String(parameter._id));
    return resolution && ["APPROVED","DEVELOPMENT"].includes(resolution.status) ? proposedParameters.find(row=>row.parameterId===String(parameter._id))?.calculation??undefined : undefined;
  };
  const calculationParameters=parameters.map(parameter=>({parameterId:String(parameter._id),parameterName:parameter.parameterName,unit:parameter.unit,itemType:parameter.itemType,active:parameter.active,resultType:parameter.resultType,calculation:executable(parameter)}));
  const accepted = new Set(input.acceptedCalculationIds ?? []);
  if (accepted.size !== (input.acceptedCalculationIds ?? []).length || [...accepted].some(id=>!executable(parameterMap.get(id)))) throw new ApiError(422,"Accept only configured calculations in this test");
  if(proposals.some(p=>!accepted.has(p.parameterId)))throw new ApiError(422,"Preview and accept each proposed calculation before submitting");
  const submitted = Object.fromEntries(input.entries.map(entry=>[entry.parameterId,entry.result]));
  const kept = new Set<string>();
  for (const parameter of parameters.filter(row=>executable(row))) {
    const id = String(parameter._id);
    const revision=parameter.calculationApproval?.revision??0;
    if (accepted.has(id) && (input.acceptedCalculationRevisions?.[id]??0)!==revision) throw new ApiError(409,"The approved binding changed after preview. Reload and accept the current calculation");
    const previous = await LabTestResult.findOne({billId:bill._id,testId:input.testId,parameterId:parameter._id}).exec();
    const unchanged = previous && previous.result === submitted[id] && (previous.calculationSnapshot?.bindingRevision??0)===revision;
    if(unchanged&&!accepted.has(id)&&previous?.calculationSnapshot?.definitionKind==="DEVELOPMENT_ONE_TIME"){kept.add(id);continue;}
    if (previous && normalizeCalculationOverwrite(executable(parameter)?.overwrite)==="NEVER") {
      if (!unchanged) throw new ApiError(422,"The approved calculation policy keeps the existing result");
      kept.add(id);
    }
  }
  const calculation = recalculateConfigured(calculationParameters.map(row=>kept.has(row.parameterId)?{...row,calculation:undefined}:row),submitted);
  if(Object.keys(calculation.errors).length)throw new ApiError(422,Object.values(calculation.errors)[0]);
  for (const parameter of parameters.filter(row=>executable(row))) {
    const id = String(parameter._id);
    if (!kept.has(id) && submitted[id] !== undefined && (typeof submitted[id]!=="number" || submitted[id]!==calculation.values[id])) throw new ApiError(422,`Calculation for "${parameter.parameterName}" is missing or stale; preview and accept it again`);
  }
  // Never invent a result the user did not accept, or revise a kept result.
  const entries=input.entries.filter(entry=>!kept.has(entry.parameterId));
  if (!entries.length) return {results:await LabTestResult.find({billId:bill._id,testId:input.testId}).exec(),testId:input.testId};
  for (const entry of entries) {
    const parameter = parameterMap.get(entry.parameterId)!;
    assertParameterTypeMatches(parameter, entry.result);
  }

  return withSampleResultWrite(input.billId, input.testId, input.collectionId, async (session, collectionId) => {
  const options = session ? {session} : {};
  const now = new Date();
  const enteredBy = new Types.ObjectId(userId);
  const patient = await Patient.findById(bill.patientId).exec();
  const patientContext = {
    dateOfBirth: patient?.dateOfBirth ?? null,
    age: patient?.age ?? null,
    gender: patient?.gender ?? null,
  };

  // Atlas transactions serialize submissions with recollection through the bill
  // and sample fences. Unique result IDs and revisions remain unchanged.
  const first = entries[0];
  const anchor = await LabTestResult.findOne({ billId: bill._id, testId: input.testId, parameterId: first.parameterId, superseded: {$in:[true,false,null]} }, null, options).exec();
  const anchorId = anchor?._id ?? new Types.ObjectId();
  const confirmationData = { user: enteredBy, action: SUBMISSION_PENDING,
    entityType: "LabTestResult", entity: anchorId, timestamp: now,
    details:{acceptedCalculationIds:[...accepted],keptCalculationIds:[...kept],calculationAcceptance:"USER_ACCEPTED_AND_SERVER_VERIFIED"} };
  const confirmation = session ? (await AuditLog.create([confirmationData], options))[0] : await AuditLog.create(confirmationData);
  const saveEntry = async (entry: typeof first) => {
      const parameter = parameterMap.get(entry.parameterId)!;
      const effective = executable(parameter);
      const proposal=proposals.find(p=>p.parameterId===entry.parameterId);
      const calculationSnapshot = effective ? {expression:effective.expression,...(development?{definitionKind:"DEVELOPMENT_CONFIGURED" as const,developmentAuthorizedBy:development.authorizedBy,clinicalApproval:false}:{}),...(proposal?{definitionKind:"DEVELOPMENT_ONE_TIME" as const,expression:proposal.expression,dependencyIds:proposal.dependencyIds}:{}),formulaId:effective.formulaId,version:parameter.calculationApproval?.formulaVersion??"1",bindingRevision:parameter.calculationApproval?.revision??0,rounding:parameter.calculationApproval?.rounding??"HALF_UP",approvedBy:proposal||development?undefined:parameter.calculationApproval?.approvedBy??"registry",approvedAt:proposal||development?undefined:parameter.calculationApproval?.approvedAt??now,acceptedBy:userId,acceptedAt:now,precision:effective.precision??2,inputs:resolveCalculationDependencyIds(calculationParameters,calculationParameters.find(row=>row.parameterId===entry.parameterId)!).map(id=>({parameterId:id,value:calculation.values[id] as string|number,unit:parameterMap.get(id)?.unit}))} : undefined;
      const existing = await LabTestResult.findOne({
        billId: bill._id,
        testId: input.testId,
        parameterId: parameter._id,
        superseded: {$in:[true,false,null]},
      }, null, options).exec();

      if (!existing) {
        const data = {
          collectionId, superseded:false,
          ...(entry === first && !anchor ? { _id: anchorId } : {}),
          billId: bill._id,
          patientId: bill.patientId,
          testId: input.testId,
          parameterId: parameter._id,
          parameterSource: parameter instanceof ParameterVersion ? "ParameterVersion" : undefined,
          parameterName: parameter.parameterName,
          resultType: parameter.resultType,
          calculationSnapshot,
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
        };
        if (session) await LabTestResult.create([data], options);
        else await LabTestResult.create(data);
        return;
      }

      existing.revisions.push({
        result: existing.result,
        calculationSnapshot:existing.calculationSnapshot,
        enteredBy: existing.enteredBy,
        enteredAt: existing.enteredAt,
        version: existing.version,
      });
      if (existing.superseded) {
        // The previous collection's complete metadata is archived separately.
        existing.parameterName = parameter.parameterName;
        existing.resultType = parameter.resultType;
        existing.unit = parameter.unit;
        existing.referenceRange = parameter.referenceRange;
        existing.method = parameter.method;
      }
      existing.collectionId = collectionId;
      existing.superseded = false;
      existing.result = entry.result;
      existing.calculationSnapshot = calculationSnapshot;
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
  };
  await saveEntry(first);
  const writes = session ? await (async()=>{for(const entry of entries.slice(1))await saveEntry(entry);return [] as PromiseSettledResult<void>[];})() : await Promise.allSettled(entries.slice(1).map(saveEntry));
  const failed = writes.find((write): write is PromiseRejectedResult => write.status === "rejected");
  if (failed) throw failed.reason;
  confirmation.action = SUBMISSION_CONFIRMED;
  await confirmation.save();

  const auditEntry = {
    user: userId,
    action: "test_result.entered",
    entityType: "LabTestResult",
    entity: bill._id,
  };
  if (session) await AuditLog.create([{ ...auditEntry, timestamp: now }], options);
  else await recordAudit(auditEntry);

  const results = await LabTestResult.find({
    billId: bill._id,
    testId: input.testId,
  }, null, options)
    .sort({ enteredAt: -1 })
    .exec();

  return { results, testId: input.testId };
  });
}
