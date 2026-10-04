import { z } from "zod";
import {
  GENDER_RANGE_GENDERS,
  PARAMETER_REFERENCE_SCOPES,
  PARAMETER_REFERENCE_TYPES,
  PARAMETER_RESULT_TYPES,
  REFERENCE_AGE_UNITS,
  REFERENCE_MAPPING_SEXES,
  REFERENCE_MAPPING_TYPES,
  REFERENCE_VALUE_TYPES,
  type GenderRangeGender,
  type ParameterReferenceScope,
  type ParameterReferenceType,
  type ParameterResultType,
  type ReferenceAgeUnit,
  type ReferenceMappingSex,
  type ReferenceMappingType,
  type ReferenceValueType,
} from "../models/lab-test-parameter.model";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .or(z.literal(""))
    .optional()
    .transform((value) => value?.trim() || undefined);

const optionalRangeNumber = z
  .number()
  .finite()
  .min(-9999999, "Range value is invalid")
  .max(9999999, "Range value is too large")
  .optional();

const genderRangeSchema = z
  .object({
    gender: z.enum(
      GENDER_RANGE_GENDERS as unknown as [GenderRangeGender, ...GenderRangeGender[]],
    ),
    from: optionalRangeNumber,
    to: optionalRangeNumber,
    text: z
      .string()
      .trim()
      .max(80, "Range text is too long")
      .or(z.literal(""))
      .optional()
      .transform((value) => value?.trim() || undefined),
  })
  .strict();

const mappingTypeEnum = z.enum(
  REFERENCE_MAPPING_TYPES as unknown as [ReferenceMappingType, ...ReferenceMappingType[]],
);

const boundedNumber = (label: string) =>
  z
    .number({ message: `${label} must be a number` })
    .finite(`${label} must be a finite number`)
    .min(-9999999, `${label} is invalid`)
    .max(9999999, `${label} is too large`);

/**
 * One reference mapping.
 *
 * The cross-field rules live here rather than only on the schema so the API
 * rejects an inconsistent mapping with a readable message instead of storing it.
 */
const referenceMappingBase = z
  .object({
    mappingType: mappingTypeEnum,
    valueType: z
      .enum(REFERENCE_VALUE_TYPES as unknown as [ReferenceValueType, ...ReferenceValueType[]])
      .default("NUMERIC"),
    sex: z
      .enum(REFERENCE_MAPPING_SEXES as unknown as [ReferenceMappingSex, ...ReferenceMappingSex[]])
      .optional(),
    ageUnit: z
      .enum(REFERENCE_AGE_UNITS as unknown as [ReferenceAgeUnit, ...ReferenceAgeUnit[]])
      .optional(),
    ageFrom: boundedNumber("Age from").optional(),
    ageTo: boundedNumber("Age to").optional(),
    valueFrom: boundedNumber("Value from").optional(),
    valueTo: boundedNumber("Value to").optional(),
    displayValue: z
      .string()
      .trim()
      .max(200, "Display value is too long")
      .or(z.literal(""))
      .optional()
      .transform((value) => value?.trim() || undefined),
    /**
     * Legacy Status (Y/N). Accepted so old records keep their value and the
     * screen can show it; a mapping that is no longer wanted is deleted instead
     * of being toggled off.
     */
    active: z.boolean().optional(),
  })
  .strict();

/** Cross-field consistency rules shared by the create and update mapping schemas. */
function validateMappingRules(
  value: {
    mappingType?: ReferenceMappingType;
    valueType?: ReferenceValueType;
    sex?: ReferenceMappingSex;
    ageUnit?: ReferenceAgeUnit;
    ageFrom?: number;
    ageTo?: number;
    valueFrom?: number;
    valueTo?: number;
  },
  ctx: z.RefinementCtx,
): void {
  if (!value.mappingType) return;

  const wantsSex =
    value.mappingType === "SEX_WISE" || value.mappingType === "AGE_SEX_WISE";
  const wantsAge =
    value.mappingType === "AGE_WISE" || value.mappingType === "AGE_SEX_WISE";

  if (wantsSex && !value.sex) {
    ctx.addIssue({
      code: "custom",
      path: ["sex"],
      message: "Select Male, Female or Both for a sex-wise mapping",
    });
  }
  if (!wantsSex && value.sex) {
    ctx.addIssue({
      code: "custom",
      path: ["sex"],
      message: `Sex applies only to sex-wise and age-and-sex-wise mappings, not ${value.mappingType}`,
    });
  }

  if (wantsAge && !value.ageUnit) {
    ctx.addIssue({
      code: "custom",
      path: ["ageUnit"],
      message: "Select the unit the age is written in",
    });
  }
  if (
    !wantsAge &&
    (value.ageUnit || value.ageFrom !== undefined || value.ageTo !== undefined)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["ageUnit"],
      message: `Age applies only to age-wise and age-and-sex-wise mappings, not ${value.mappingType}`,
    });
  }
  if (wantsAge && value.ageFrom === undefined && value.ageTo === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["ageFrom"],
      message: "Enter at least one age bound",
    });
  }
  if (
    value.ageFrom !== undefined &&
    value.ageTo !== undefined &&
    value.ageFrom > value.ageTo
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["ageTo"],
      message: "Age to cannot be smaller than age from",
    });
  }

  if (value.valueType === "NUMERIC") {
    if (value.valueFrom === undefined && value.valueTo === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["valueFrom"],
        message: "A numeric range needs at least a lower or upper value bound",
      });
    }
    if (
      value.valueFrom !== undefined &&
      value.valueTo !== undefined &&
      value.valueFrom > value.valueTo
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["valueTo"],
        message: "Value to cannot be smaller than value from",
      });
    }
  }
}

export const referenceMappingInputSchema = referenceMappingBase.superRefine(
  validateMappingRules,
);
export type ReferenceMappingInput = z.infer<typeof referenceMappingInputSchema>;

export const createReferenceMappingSchema = referenceMappingBase.superRefine(
  validateMappingRules,
);
export const updateReferenceMappingSchema = referenceMappingBase
  .partial()
  .superRefine(validateMappingRules);

const baseFields = {
  testId: z.string().min(1, "Test ID is required"),
  parameterName: z
    .string()
    .trim()
    .min(1, "Parameter name is required")
    .max(150, "Parameter name is too long"),
  subtitle: optionalText(150, "Subtitle is too long"),
  displayOrder: z.number().int().min(0, "Order number cannot be negative").max(9999, "Order number is too large").default(0),
  resultType: z
    .enum(PARAMETER_RESULT_TYPES as unknown as [ParameterResultType, ...ParameterResultType[]])
    .default("TEXT"),
  parameterType: optionalText(50, "Parameter type is too long"),
  defaultValue: optionalText(120, "Default value is too long"),
  unit: optionalText(50, "Unit is too long"),
  method: optionalText(120, "Method name is too long"),
  referenceType: z
    .enum(PARAMETER_REFERENCE_TYPES as unknown as [ParameterReferenceType, ...ParameterReferenceType[]])
    .default("GENERAL"),
  onlyReferenceRange: z.boolean().default(false).optional(),
  rangeFrom: optionalRangeNumber,
  rangeTo: optionalRangeNumber,
  rangeText: optionalText(200, "Range text is too long"),
  genderRanges: z
    .array(genderRangeSchema)
    .max(GENDER_RANGE_GENDERS.length, "At most three gender ranges")
    .optional(),
  referenceScope: z
    .enum(
      PARAMETER_REFERENCE_SCOPES as unknown as [
        ParameterReferenceScope,
        ...ParameterReferenceScope[],
      ],
    )
    .default("GENERIC")
    .optional(),
  /**
   * The mapping types this parameter supports, in most-specific-first order.
   * Declaring them explicitly is what makes the reference-selection policy a
   * recorded decision instead of something inferred from stored rows.
   */
  mappingTypes: z
    .array(mappingTypeEnum)
    .max(REFERENCE_MAPPING_TYPES.length, "Too many reference mapping types")
    .optional(),
  options: z.array(z.string().trim().min(1)).max(100, "A parameter can have at most 100 options").optional(),
  active: z.boolean().default(true).optional(),
};

function validateRanges(
  value: {
    rangeFrom?: number;
    rangeTo?: number;
    genderRanges?: Array<{
      gender: GenderRangeGender;
      from?: number;
      to?: number;
      text?: string;
    }>;
  },
  ctx: z.RefinementCtx,
): void {
  if (value.rangeFrom !== undefined && value.rangeTo !== undefined && value.rangeFrom > value.rangeTo) {
    ctx.addIssue({
      code: "custom",
      path: ["rangeTo"],
      message: "To value cannot be smaller than From value",
    });
  }
  for (const [index, range] of (value.genderRanges ?? []).entries()) {
    if (range.from !== undefined && range.to !== undefined && range.from > range.to) {
      ctx.addIssue({
        code: "custom",
        path: ["genderRanges", index, "to"],
        message: "To value cannot be smaller than From value",
      });
    }
  }
}

const rawParameterSchema = z.object(baseFields).strict();

export const createLabTestParameterSchema = rawParameterSchema.superRefine(validateRanges);
export const updateLabTestParameterSchema = rawParameterSchema.partial().superRefine(validateRanges);

/**
 * Rejects a duplicate mapping type, and two mappings of the same type whose sex
 * and age windows overlap. Either case would make the applicable range ambiguous
 * for some patient, so it is refused at save time rather than surfaced later as
 * an ambiguous result.
 */
export function validateMappingSet(
  mappings: Array<{
    mappingType: ReferenceMappingType;
    sex?: ReferenceMappingSex;
    ageUnit?: ReferenceAgeUnit;
    ageFrom?: number;
    ageTo?: number;
  }>,
  ctx: z.RefinementCtx,
  path: (string | number)[] = [],
): void {
  const overlaps = (a: (typeof mappings)[number], b: (typeof mappings)[number]) => {
    if (a.mappingType !== b.mappingType) return false;
    if (a.ageUnit !== b.ageUnit) return false;
    if (a.sex !== b.sex) return false;
    const low = a.ageFrom ?? Number.NEGATIVE_INFINITY;
    const high = a.ageTo ?? Number.POSITIVE_INFINITY;
    const otherLow = b.ageFrom ?? Number.NEGATIVE_INFINITY;
    const otherHigh = b.ageTo ?? Number.POSITIVE_INFINITY;
    return low <= otherHigh && otherLow <= high;
  };

  for (const [index, mapping] of mappings.entries()) {
    for (const [otherIndex, other] of mappings.entries()) {
      if (otherIndex <= index) continue;
      if (!overlaps(mapping, other)) continue;
      ctx.addIssue({
        code: "custom",
        path: [...path, index, "mappingType"],
        message:
          "Another mapping of the same type already covers this sex and age range. " +
          "Overlapping ranges would make it unclear which one applies.",
      });
    }
  }
}

export type LabTestParameterFormData = z.infer<typeof createLabTestParameterSchema>;