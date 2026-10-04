import type { Pagination } from "@/types/database";

export type LabTestResultMode =
  | "PARAMETER_BASED"
  | "TEMPLATE_BASED"
  | "SIMPLE_RESULT"
  | "CALCULATED";

export interface LabTestRow {
  id: string;
  testCode: string;
  testName: string;
  shortName: string;
  departmentId: string;
  departmentName: string;
  description?: string;
  sampleType?: string;
  containerType?: string;
  testType?: string;
  price: number;
  priceIp?: number;
  priceInsIp?: number;
  priceEr?: number;
  doctorPrice?: number;
  cghsCode?: string;
  nimsCode?: string;
  railwayCode?: string;
  nfcCode?: string;
  comments?: string;
  referralPercent?: number;
  reportNote1?: string;
  reportNote2?: string;
  active: boolean;
  resultMode: LabTestResultMode;
  createdAt?: string;
  updatedAt?: string;
}

export interface LabTestListResult {
  items: LabTestRow[];
  pagination: Pagination;
}

export interface LabTestResponse {
  test: LabTestRow;
}

export interface LabTestPayload {
  departmentId: string;
  testName: string;
  shortName?: string;
  description?: string;
  sampleType?: string;
  containerType?: string;
  testType?: string;
  price: number;
  priceIp?: number;
  priceInsIp?: number;
  priceEr?: number;
  doctorPrice?: number;
  cghsCode?: string;
  nimsCode?: string;
  railwayCode?: string;
  nfcCode?: string;
  comments?: string;
  referralPercent?: number;
  reportNote1?: string;
  reportNote2?: string;
  resultMode?: LabTestResultMode;
  active?: boolean;
}

export interface SpecimenOptions {
  sampleTypes: string[];
  containerTypes: string[];
}

export type ParameterReferenceType = "GENERAL" | "GENDER_WISE";
export type ParameterResultType =
  | "TEXT"
  | "TEXTAREA"
  | "NUMBER"
  | "BOOLEAN"
  | "SELECT"
  | "RANGE";

/**
 * What kind of reference a parameter needs. Independent of
 * `ParameterReferenceType`, which only decides how many range rows the form
 * shows (one general row, or one row per sex/child).
 */
export type ParameterReferenceScope = "GENERIC" | "AGE" | "SEX" | "AGE_AND_SEX";

export const PARAMETER_REFERENCE_SCOPES: readonly ParameterReferenceScope[] = [
  "GENERIC",
  "AGE",
  "SEX",
  "AGE_AND_SEX",
];

export const PARAMETER_REFERENCE_SCOPE_LABELS: Record<
  ParameterReferenceScope,
  string
> = {
  GENERIC: "Generic",
  AGE: "Age",
  SEX: "Sex",
  AGE_AND_SEX: "Age & Sex",
};

/**
 * Rows in the gender-wise range editor. `C` is the legacy "Child" row: it is
 * stored and displayed like the others but is never selected automatically,
 * because a child range carries no patient-sex meaning. Structured age/sex
 * mappings are what resolve a range per patient.
 */
export type GenderRangeGender = "M" | "F" | "C";

export const GENDER_RANGE_GENDERS: readonly GenderRangeGender[] = ["M", "F", "C"];

export const GENDER_RANGE_LABELS: Record<GenderRangeGender, string> = {
  M: "Male",
  F: "Female",
  C: "Child",
};

/**
 * The reference mapping systems offered for a parameter. `GENERIC` is the
 * backend's lowest-priority catch-all; the parameter master presents the
 * generic range as its own section instead, so it is deliberately absent from
 * `PARAMETER_MAPPING_TYPES`.
 */
export type ReferenceMappingType =
  | "GENERIC"
  | "AGE_WISE"
  | "SEX_WISE"
  | "AGE_SEX_WISE";

/** Only the age/sex specific systems are configured through the mapping modal. */
export const PARAMETER_MAPPING_TYPES = [
  "AGE_WISE",
  "SEX_WISE",
  "AGE_SEX_WISE",
] as const satisfies readonly ReferenceMappingType[];

export type ParameterMappingType = (typeof PARAMETER_MAPPING_TYPES)[number];

/** Most-specific-first, matching the backend's resolution order. */
export const REFERENCE_MAPPING_PRIORITY: readonly ReferenceMappingType[] = [
  "AGE_SEX_WISE",
  "AGE_WISE",
  "SEX_WISE",
];

export const REFERENCE_MAPPING_LABELS: Record<ReferenceMappingType, string> = {
  GENERIC: "Generic",
  AGE_WISE: "Age Wise",
  SEX_WISE: "Sex Wise",
  AGE_SEX_WISE: "Age & Sex Wise",
};

export const REFERENCE_MAPPING_DESCRIPTIONS: Record<
  ReferenceMappingType,
  string
> = {
  GENERIC: "A single range applied to every patient.",
  AGE_WISE: "Ranges selected by the patient's age.",
  SEX_WISE: "Ranges selected by the patient's sex.",
  AGE_SEX_WISE: "Ranges selected by the patient's age and sex together.",
};

export type ReferenceValueType = "NUMERIC" | "NARRATIVE";
export type ReferenceMappingSex = "MALE" | "FEMALE" | "BOTH";
export type ReferenceAgeUnit = "DAY" | "MONTH" | "YEAR";

export const REFERENCE_AGE_UNITS: readonly ReferenceAgeUnit[] = [
  "DAY",
  "MONTH",
  "YEAR",
];

export const REFERENCE_MAPPING_SEXES: readonly ReferenceMappingSex[] = [
  "MALE",
  "FEMALE",
  "BOTH",
];

export interface ReferenceMapping {
  id: string;
  mappingType: ReferenceMappingType;
  valueType: ReferenceValueType;
  sex?: ReferenceMappingSex;
  ageUnit?: ReferenceAgeUnit;
  ageFrom?: number;
  ageTo?: number;
  valueFrom?: number;
  valueTo?: number;
  displayValue?: string;
  notes?: string;
  /** Legacy Status (Y/N). A row with Status N is never applied to a result. */
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Types this parameter supports, most-specific-first. */
export interface ReferenceMappingSummary {
  mappingTypes: ReferenceMappingType[];
  mappingCount: number;
  counts: Partial<Record<ReferenceMappingType, number>>;
}

export interface ParameterRow {
  id: string;
  testId: string;
  departmentId?: string;
  departmentName?: string;
  testName?: string;
  parameterName: string;
  subtitle?: string;
  displayOrder: number;
  resultType: ParameterResultType;
  parameterType?: string;
  defaultValue?: string;
  unit?: string;
  referenceRange?: string;
  referenceType: ParameterReferenceType;
  referenceScope: ParameterReferenceScope;
  onlyReferenceRange?: boolean;
  rangeFrom?: number;
  rangeTo?: number;
  rangeText?: string;
  genderRanges?: GenderRangeInput[];
  method?: string;
  options?: string[];
  /** Set when the source range cannot be applied to a patient result yet. */
  needsLabReview?: boolean;
  reviewReason?: string;
  rangeSource?: string;
  rangeSourceUrl?: string;
  active: boolean;
  /** Types this parameter supports, most-specific-first. */
  mappingTypes?: ReferenceMappingType[];
  /** How many mappings exist in total. */
  mappingCount?: number;
  /** Per-type counts, used for the compact list summary. */
  counts?: Partial<Record<ReferenceMappingType, number>>;
}

export interface ParameterDetail extends ParameterRow {
  referenceMappings: ReferenceMapping[];
}

export interface GenderRangeInput {
  gender: GenderRangeGender;
  from?: number;
  to?: number;
  text?: string;
}

export interface PaginatedParameters {
  data: ParameterRow[];
  pagination: Pagination;
}

export interface ParameterResponse {
  parameter: ParameterDetail;
}

/** The four systems share one endpoint; the body is identical to a mapping. */
export interface ReferenceMappingPayload {
  mappingType: ReferenceMappingType;
  valueType: ReferenceValueType;
  sex?: ReferenceMappingSex;
  ageUnit?: ReferenceAgeUnit;
  ageFrom?: number;
  ageTo?: number;
  valueFrom?: number;
  valueTo?: number;
  displayValue?: string;
  notes?: string;
  /** Legacy Status (Y/N). Omitted means "keep whatever is already stored". */
  active?: boolean;
}

export interface ReferenceMappingsResponse {
  data: ReferenceMapping[];
  summary: ReferenceMappingSummary;
}

export interface ParameterPayload {
  testId: string;
  parameterName: string;
  subtitle?: string;
  displayOrder?: number;
  resultType: ParameterResultType;
  parameterType?: string;
  defaultValue?: string;
  unit?: string;
  referenceType: ParameterReferenceType;
  referenceScope?: ParameterReferenceScope;
  onlyReferenceRange?: boolean;
  rangeFrom?: number;
  rangeTo?: number;
  rangeText?: string;
  genderRanges?: GenderRangeInput[];
  method?: string;
  options?: string[];
  active?: boolean;
}

export interface TariffRow {
  testId: string;
  departmentName: string;
  testName: string;
  price: number;
  priceIp?: number;
  priceInsIp?: number;
  priceEr?: number;
}

export interface PaginatedTariffs {
  data: TariffRow[];
  pagination: Pagination;
}

export interface TariffPriceInput {
  testId: string;
  price: number;
  priceIp?: number;
  priceInsIp?: number;
  priceEr?: number;
}

export interface CommissionMappingRow {
  testId: string;
  testName: string;
  amount: number;
  commissionPercent?: number;
  commissionAmount?: number;
  configured: boolean;
}

export interface CommissionMappingInput {
  testId: string;
  commissionPercent?: number;
  commissionAmount?: number;
}

export interface ClientTariffRow {
  testId: string;
  testName: string;
  price: number;
  clientPrice?: number;
  configured: boolean;
}

export interface CommissionActionResult {
  assigned: number;
  removed: number;
}

export interface ClientTariffApplyResult {
  applied: number;
  removed: number;
}