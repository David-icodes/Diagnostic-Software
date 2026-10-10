import { model, Schema, type Types } from "mongoose";

export type ParameterResultType =
  | "TEXT"
  | "TEXTAREA"
  | "NUMBER"
  | "BOOLEAN"
  | "SELECT"
  | "RANGE";
export type ParameterReferenceType = "GENERAL" | "GENDER_WISE";

/**
 * How the parameter's reference configuration is classified.
 *
 * This is deliberately separate from `ParameterReferenceType`, which only
 * decides which range-entry rows the form shows (one general row, or one row per
 * sex). The scope records *what kind* of reference a parameter needs so result
 * entry knows which structured system to resolve: a generic range, an age band, a
 * sex band, or both together.
 *
 * Adding the enum here does not migrate anything: an existing parameter without
 * the field reads as GENERIC, which is what its single general range already is.
 */
export type ParameterReferenceScope = "GENERIC" | "AGE" | "SEX" | "AGE_AND_SEX";

/**
 * How a parameter's reference range is selected for a patient.
 *
 * This is an additive, structured alternative to the legacy free-text
 * `referenceRange` / `genderRanges` fields. Existing rows keep those fields and
 * keep resolving exactly as before; nothing here is derived from them and no
 * legacy value is rewritten.
 */
export type ReferenceMappingType =
  | "GENERIC"
  | "AGE_WISE"
  | "SEX_WISE"
  | "AGE_SEX_WISE";

/** Shape of the value a mapping accepts. Decides whether a result is comparable. */
export type ReferenceValueType = "NUMERIC" | "NARRATIVE";

/** Patient sexes a mapping can be restricted to. */
export type ReferenceMappingSex = "MALE" | "FEMALE" | "BOTH";

/** Units an age window can be expressed in. */
export type ReferenceAgeUnit = "DAY" | "MONTH" | "YEAR";

/**
 * Which row a gender-wise range belongs to.
 *
 * `C` is the legacy "Child" row. It is kept as a separate category rather than
 * being folded into M/F because the source catalogues list a child range beside
 * the adult ones, and it is never used to resolve a patient's sex: a child range
 * has no patient-sex meaning, so it is stored and displayed but never selected
 * automatically. Structured age/sex resolution is what selects ranges per patient.
 */
export type GenderRangeGender = "M" | "F" | "C";

/** Row order used by the gender-wise range editor and its display text. */
export const GENDER_RANGE_GENDERS: GenderRangeGender[] = ["M", "F", "C"];

/** Display labels per gender-range row. `C` is spelled out to stay unambiguous. */
export const GENDER_RANGE_LABELS: Record<GenderRangeGender, string> = {
  M: "M",
  F: "F",
  C: "Child",
};

export interface IGenderRange {
  gender: GenderRangeGender;
  from?: number;
  to?: number;
  text?: string;
}

export interface IReferenceMapping {
  mappingType: ReferenceMappingType;
  valueType: ReferenceValueType;
  /** Required for SEX_WISE and AGE_SEX_WISE. */
  sex?: ReferenceMappingSex;
  /** Required for AGE_WISE and AGE_SEX_WISE. */
  ageUnit?: ReferenceAgeUnit;
  /** Inclusive lower age bound, in ageUnit. */
  ageFrom?: number;
  /** Inclusive upper age bound, in ageUnit. */
  ageTo?: number;
  /** Inclusive lower bound of the accepted value, for NUMERIC mappings. */
  valueFrom?: number;
  /** Inclusive upper bound of the accepted value, for NUMERIC mappings. */
  valueTo?: number;
  /** Text to show for this mapping, e.g. "13.0 - 17.0 g/dL" or "Negative". */
  displayValue?: string;
  /**
   * Legacy Status flag (Y/N) kept for records that already carry it.
   *
   * It is displayed and preserved, but it is deliberately not the way a mapping
   * is managed: a mapping that should no longer be used is deleted. An inactive
   * row is still skipped when a range is resolved for a patient, so Status N
   * never silently resolves to a stale range.
   */
  active?: boolean;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ILabTestParameter {
  testId: Types.ObjectId;
  parameterName: string;
  /** Optional grouped heading / sub-title the parameter belongs under. */
  subtitle?: string;
  displayOrder: number;
  resultType: ParameterResultType;
  /** Category shown in the entry screen (e.g. Normal / Derived). */
  parameterType?: string;
  defaultValue?: string;
  unit?: string;
  /** Display string composed from the numeric range for reports/results. */
  referenceRange?: string;
  /** How the reference range is interpreted on the entry screen. */
  referenceType: ParameterReferenceType;
  /**
   * What kind of reference this parameter needs. Separate from `referenceType`:
   * a GENDER_WISE parameter can still be scoped SEX, and the resolved range comes
   * from the structured mappings, not from this value.
   */
  referenceScope?: ParameterReferenceScope;
  /** When true, only the range is collected (no patient value). */
  onlyReferenceRange?: boolean;
  rangeFrom?: number;
  rangeTo?: number;
  /** Free-text range such as "<200" when from/to do not apply. */
  rangeText?: string;
  genderRanges?: IGenderRange[];
  /**
   * Structured reference mappings.
   *
   * `undefined`/empty keeps the parameter on its legacy free-text range. A
   * non-empty array makes these mappings the authoritative source; the legacy
   * fields are still stored and reported so no historical text is lost.
   */
  referenceMappings?: IReferenceMapping[];
  /**
   * The mapping types this parameter supports, in most-specific-first order
   * (AGE_SEX_WISE, AGE_WISE, SEX_WISE, GENERIC). Stored explicitly so the
   * selection policy is a recorded decision rather than something inferred at
   * read time. Empty when the parameter uses only its legacy range.
   */
  mappingTypes?: ReferenceMappingType[];
  method?: string;
  options?: string[];
  /**
   * True when the source range is missing, incomplete or too ambiguous to be
   * applied automatically to a patient result. Such parameters are shown with a
   * "Needs Lab Review" marker and must be confirmed by the lab before any
   * abnormal flag is reported.
   */
  needsLabReview?: boolean;
  /** Why the parameter needs review (missing-unit / missing-range / ambiguous). */
  reviewReason?: string;
  /** Provenance for any range supplied from an external reference source. */
  rangeSource?: string;
  rangeSourceUrl?: string;
  active: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export const PARAMETER_RESULT_TYPES: ParameterResultType[] = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "BOOLEAN",
  "SELECT",
  "RANGE",
];

/** The reference scope options, in the order the select lists them. */
export const PARAMETER_REFERENCE_SCOPES: ParameterReferenceScope[] = [
  "GENERIC",
  "AGE",
  "SEX",
  "AGE_AND_SEX",
];

export const PARAMETER_REFERENCE_TYPES: ParameterReferenceType[] = [
  "GENERAL",
  "GENDER_WISE",
];

export const REFERENCE_MAPPING_TYPES: ReferenceMappingType[] = [
  "GENERIC",
  "AGE_WISE",
  "SEX_WISE",
  "AGE_SEX_WISE",
];

/**
 * Most-specific-first order used to choose between mapping types for a patient.
 * A parameter may support several types at once; this fixed order makes the
 * choice deterministic and reviewable instead of dependent on array order.
 */
export const REFERENCE_MAPPING_PRIORITY: ReferenceMappingType[] = [
  "AGE_SEX_WISE",
  "AGE_WISE",
  "SEX_WISE",
  "GENERIC",
];

export const REFERENCE_VALUE_TYPES: ReferenceValueType[] = ["NUMERIC", "NARRATIVE"];
export const REFERENCE_MAPPING_SEXES: ReferenceMappingSex[] = [
  "MALE",
  "FEMALE",
  "BOTH",
];
export const REFERENCE_AGE_UNITS: ReferenceAgeUnit[] = ["DAY", "MONTH", "YEAR"];

const referenceMappingSchema = new Schema<IReferenceMapping>(
  {
    mappingType: {
      type: String,
      enum: REFERENCE_MAPPING_TYPES,
      required: true,
    },
    valueType: {
      type: String,
      enum: REFERENCE_VALUE_TYPES,
      required: true,
      default: "NUMERIC",
    },
    sex: { type: String, enum: REFERENCE_MAPPING_SEXES },
    ageUnit: { type: String, enum: REFERENCE_AGE_UNITS },
    ageFrom: { type: Number },
    ageTo: { type: Number },
    valueFrom: { type: Number },
    valueTo: { type: Number },
    displayValue: { type: String, trim: true, maxlength: 200 },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    _id: true,
  },
);

referenceMappingSchema.pre("validate", function (next) {
  const mapping = this as unknown as IReferenceMapping;
  if (!mapping.mappingType) return next();

  const wantsSex =
    mapping.mappingType === "SEX_WISE" || mapping.mappingType === "AGE_SEX_WISE";
  const wantsAge =
    mapping.mappingType === "AGE_WISE" || mapping.mappingType === "AGE_SEX_WISE";

  if (wantsSex && !mapping.sex) {
    return next(
      new Error(`Sex is required for a ${mapping.mappingType} reference mapping`),
    );
  }
  if (!wantsSex && mapping.sex) {
    return next(
      new Error(
        `Sex applies only to SEX_WISE and AGE_SEX_WISE mappings, not ${mapping.mappingType}`,
      ),
    );
  }
  if (wantsAge && !mapping.ageUnit) {
    return next(
      new Error(`Age unit is required for a ${mapping.mappingType} reference mapping`),
    );
  }
  if (!wantsAge && (mapping.ageUnit || mapping.ageFrom !== undefined || mapping.ageTo !== undefined)) {
    return next(
      new Error(
        `Age bounds apply only to AGE_WISE and AGE_SEX_WISE mappings, not ${mapping.mappingType}`,
      ),
    );
  }
  if (wantsAge && mapping.ageFrom === undefined && mapping.ageTo === undefined) {
    return next(
      new Error(
        `At least one age bound is required for a ${mapping.mappingType} reference mapping`,
      ),
    );
  }
  if (
    mapping.ageFrom !== undefined &&
    mapping.ageTo !== undefined &&
    mapping.ageFrom > mapping.ageTo
  ) {
    return next(new Error("Age range start must not be greater than the age range end"));
  }
  if (mapping.valueType === "NUMERIC") {
    if (mapping.valueFrom === undefined && mapping.valueTo === undefined) {
      return next(
        new Error(
          "A NUMERIC reference mapping needs at least a lower or upper value bound",
        ),
      );
    }
    if (
      mapping.valueFrom !== undefined &&
      mapping.valueTo !== undefined &&
      mapping.valueFrom > mapping.valueTo
    ) {
      return next(
        new Error("Reference value start must not be greater than the value end"),
      );
    }
  }
  return next();
});

const labTestParameterSchema = new Schema<ILabTestParameter>(
  {
    testId: {
      type: Schema.Types.ObjectId,
      ref: "LabTest",
      required: true,
      index: true,
    },
    parameterName: { type: String, required: true, trim: true, maxlength: 150 },
    subtitle: { type: String, trim: true, maxlength: 150 },
    displayOrder: { type: Number, required: true, min: 0, default: 0 },
    resultType: {
      type: String,
      enum: PARAMETER_RESULT_TYPES,
      default: "TEXT",
    },
    parameterType: { type: String, trim: true, maxlength: 50 },
    defaultValue: { type: String, trim: true, maxlength: 120 },
    unit: { type: String, trim: true, maxlength: 50 },
    referenceRange: { type: String, trim: true, maxlength: 200 },
    referenceType: {
      type: String,
      enum: PARAMETER_REFERENCE_TYPES,
      default: "GENERAL",
    },
    referenceScope: {
      type: String,
      enum: PARAMETER_REFERENCE_SCOPES,
      default: "GENERIC",
    },
    onlyReferenceRange: { type: Boolean, default: false },
    rangeFrom: { type: Number },
    rangeTo: { type: Number },
    rangeText: { type: String, trim: true, maxlength: 200 },
    genderRanges: {
      type: [
        {
          gender: { type: String, enum: GENDER_RANGE_GENDERS, required: true },
          from: { type: Number },
          to: { type: Number },
          text: { type: String, trim: true, maxlength: 80 },
        },
      ],
      default: undefined,
    },
    referenceMappings: {
      type: [referenceMappingSchema],
      default: undefined,
    },
    mappingTypes: {
      type: [{ type: String, enum: REFERENCE_MAPPING_TYPES }],
      default: undefined,
    },
    method: { type: String, trim: true, maxlength: 120 },
    needsLabReview: { type: Boolean, default: false, index: true },
    reviewReason: { type: String, trim: true, maxlength: 200 },
    rangeSource: { type: String, trim: true, maxlength: 200 },
    rangeSourceUrl: { type: String, trim: true, maxlength: 500 },
    options: {
      type: [String],
      validate: [
        (v: string[]) => v.length <= 100,
        "A parameter can have at most 100 options",
      ],
    },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_doc: unknown, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        return ret;
      },
    },
  },
);

labTestParameterSchema.index(
  { testId: 1, parameterName: 1 },
  { unique: true },
);
labTestParameterSchema.index({ testId: 1, displayOrder: 1 });
labTestParameterSchema.index({ testId: 1, subtitle: 1 });
// Supports the master-page "Needs Lab Review" filter.
labTestParameterSchema.index({ needsLabReview: 1, testId: 1 });

export const LabTestParameter = model<ILabTestParameter>(
  "LabTestParameter",
  labTestParameterSchema,
);