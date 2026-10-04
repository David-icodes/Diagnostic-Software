import type { Pagination } from "@/types/patient";
import type {
  ReferenceAgeUnit,
  ReferenceMappingSex,
  ReferenceMappingType,
} from "@/types/lab-masters";

export type SampleStatus =
  | "SELECT"
  | "COLLECTED"
  | "RECEIVED"
  | "PROCESSED"
  | "RECOLLECTED"
  | "REJECTED";

export const SAMPLE_STATUSES: SampleStatus[] = [
  "SELECT",
  "COLLECTED",
  "RECEIVED",
  "PROCESSED",
  "RECOLLECTED",
  "REJECTED",
];

export type SampleTestStatus = "OPEN" | "CLOSED";

export interface LabSampleRow {
  id: string;
  sampleId: string;
  billId: string;
  patientId: string;
  testId: string;
  billNumber: string;
  billDate?: string;
  patientCode?: string;
  patientName?: string;
  departmentName?: string;
  testCode?: string;
  testName?: string;
  /**
   * False when the ordered test could not be resolved from the bill item or the
   * Lab Test master. The UI must render an explicit "Test not linked" state
   * instead of a blank cell so an orphan sample is never read as a real test.
   */
  testLinked?: boolean;
  /** True when testName came from the bill item snapshot of the ordered test. */
  testNameFromBillItem?: boolean;
  sampleType?: string;
  containerType?: string;
  sampleStatus: SampleStatus;
  testStatus: SampleTestStatus;
  lastStatusChangeAt?: string;
  comments?: string;
}

/**
 * Sample lists are paged on the server. Pages are cut on lab bills, so `total`
 * counts the matched bills while `sampleCount` counts the sample rows returned on
 * this page (a bill can hold several ordered tests).
 */
export interface SamplePagination extends Pagination {
  sampleCount?: number;
}

export type SampleListMode = "today" | "criteria";

export interface SampleListParams {
  page?: number;
  limit?: number;
  mode?: SampleListMode;
  fromDate?: string;
  toDate?: string;
  billNumber?: string;
  patientId?: string;
  patientName?: string;
}

export interface SampleListResult {
  data: LabSampleRow[];
  pagination: SamplePagination;
}

export interface SampleListResponse {
  data: LabSampleRow[];
  pagination: SamplePagination;
}

export interface SampleStatusResponse {
  sample: LabSampleRow;
}

export interface UpdateSampleStatusRequest {
  status: SampleStatus;
  time?: string;
  comments?: string;
}

/** `TEXTAREA` renders a multi-line text result; it enters as a plain string. */
export type ParameterResultType =
  | "TEXT"
  | "TEXTAREA"
  | "NUMBER"
  | "BOOLEAN"
  | "SELECT"
  | "RANGE";

export interface LabTestParameter {
  id: string;
  testId: string;
  parameterName: string;
  displayOrder: number;
  resultType: ParameterResultType;
  unit?: string;
  referenceRange?: string;
  method?: string;
  options?: string[];
  /** True when the stored range cannot be applied to a patient result yet. */
  needsLabReview?: boolean;
  reviewReason?: string;
  active: boolean;
}

export interface ParametersResponse {
  parameters: LabTestParameter[];
}

export type ResultValue = string | number | boolean;

/**
 * How the reference range that applies to this patient was decided.
 *
 * `status` is the decision, `source` is which system supplied the range:
 * `MAPPING` a structured mapping matched, `LEGACY` the parameter's own
 * reference text, `NONE` nothing applies. A parameter with mappings never
 * silently falls back to its generic text when no mapping matches.
 */
export type ReferenceResolutionStatus =
  | "MATCHED"
  | "NOT_CONFIGURED"
  | "NO_MAPPING_FOR_PATIENT"
  | "AMBIGUOUS";

export type ReferenceSource = "MAPPING" | "LEGACY" | "NONE";

export interface ReferenceResolution {
  status: ReferenceResolutionStatus;
  source: ReferenceSource;
  mappingType?: ReferenceMappingType;
  mappingId?: string;
  valueType?: "NUMERIC" | "NARRATIVE";
  /** Text to show the technician. Empty when nothing applies. */
  displayValue?: string;
  valueFrom?: number;
  valueTo?: number;
  sex?: ReferenceMappingSex;
  ageUnit?: ReferenceAgeUnit;
  ageFrom?: number;
  ageTo?: number;
  patient: {
    age?: { years: number; months: number; days: number };
    ageSource?: "DATE_OF_BIRTH" | "AGE_FIELD" | "UNKNOWN";
    sex?: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
  };
  /** Why the range was or was not applied. Shown to the technician. */
  reason?: string;
  ambiguousMappings?: Array<{
    mappingId?: string;
    mappingType: ReferenceMappingType;
    displayValue: string;
  }>;
}

/** One ordered test of a bill, with the reference resolved for its patient. */
export interface BillTestParameter {
  parameterId: string;
  parameterName: string;
  subtitle?: string;
  displayOrder: number;
  resultType: ParameterResultType;
  parameterType?: string;
  defaultValue?: string;
  unit?: string;
  method?: string;
  options?: string[];
  onlyReferenceRange?: boolean;
  hasReferenceMappings: boolean;
  reference: ReferenceResolution;
}

export interface BillTestEntry {
  testId: string;
  testCode: string;
  testName: string;
  /** Position of this test in the bill's ordered items. */
  order: number;
  testLinked: boolean;
  parameters: BillTestParameter[];
}

/**
 * The bill-scoped result-entry view. The bill decides which ordered tests can be
 * edited and the backend decides which reference range applies to its patient.
 */
export interface BillResultEntry {
  billId: string;
  billNumber: string;
  patientId: string;
  patientCode?: string;
  patientName?: string;
  patientGender?: string;
  patientDateOfBirth?: string;
  patientAge?: number;
  tests: BillTestEntry[];
}

/** The reference that actually applied when a result was recorded. */
export interface ReferenceSnapshot {
  status: ReferenceResolutionStatus;
  source: ReferenceSource;
  mappingType?: ReferenceMappingType;
  mappingId?: string;
  valueType?: "NUMERIC" | "NARRATIVE";
  displayValue?: string;
  valueFrom?: number;
  valueTo?: number;
  sex?: string;
  ageUnit?: string;
  ageFrom?: number;
  ageTo?: number;
  patientAgeYears?: number;
  patientSex?: string;
  flag?: "IN_RANGE" | "OUT_OF_RANGE" | "NOT_COMPARABLE";
  reason?: string;
  capturedAt: string;
}

export interface LabTestResult {
  id: string;
  billId: string;
  patientId: string;
  testId: string;
  parameterId: string;
  parameterName: string;
  resultType: string;
  unit?: string;
  referenceRange?: string;
  /** Stored so a reprint shows the range that applied at entry time. */
  referenceSnapshot?: ReferenceSnapshot;
  method?: string;
  result: ResultValue;
  enteredBy: string;
  enteredAt: string;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ResultsResponse {
  results: LabTestResult[];
}

export interface SubmitResultsRequest {
  billId: string;
  testId: string;
  entries: Array<{
    parameterId: string;
    result: ResultValue;
  }>;
}

export interface SubmitResultsData {
  results: LabTestResult[];
  testId: string;
}

export interface LabTechnician {
  id: string;
  name: string;
  designation: string;
  qualification?: string;
  signatureNote?: string;
}

export interface TechniciansResponse {
  technicians: LabTechnician[];
}