import type {
  IGenderRange,
  IReferenceMapping,
  ReferenceAgeUnit,
  ReferenceMappingSex,
  ReferenceMappingType,
  ReferenceValueType,
} from "../models/lab-test-parameter.model";

/**
 * Backend-authoritative reference-range selection.
 *
 * The rules here are the only place a reference range is chosen for a patient.
 * They are deliberately conservative: a range is applied only when the stored
 * data unambiguously describes the patient. Anything the data cannot answer is
 * reported as such instead of being approximated, and nothing is ever invented.
 *
 * Resolution order
 * ----------------
 * 1. When a parameter has structured `referenceMappings`, they are the source
 *    of truth. Mapping types are evaluated in `REFERENCE_MAPPING_PRIORITY`
 *    (AGE_SEX_WISE, AGE_WISE, SEX_WISE, GENERIC) and the first type that
 *    matches the patient wins. The order is fixed, so which type applies does
 *    not depend on the order mappings happen to be stored in.
 * 2. `GENERIC` is never used as a fallback when the parameter also has
 *    age/sex specific mappings and none of them match. Showing a generic range
 *    for a patient who needs a specific one would be a guess.
 * 3. Two or more mappings of the *same* type that both match the patient are
 *    ambiguous. The first is never silently chosen.
 * 4. A parameter with no structured mappings keeps its legacy free-text range
 *    behaviour, unchanged. Legacy text is never parsed into bounds here.
 */

export type ReferenceResolutionStatus =
  /** Exactly one mapping applies. */
  | "MATCHED"
  /** The parameter has no reference range at all. */
  | "NOT_CONFIGURED"
  /** Mappings exist, but none of them describes this patient. */
  | "NO_MAPPING_FOR_PATIENT"
  /** More than one mapping of the same type matches; needs a human decision. */
  | "AMBIGUOUS";

/**
 * Which mechanism supplied the range that applies to this patient:
 * `MAPPING` a structured mapping matched, `LEGACY` the master's free-text
 * range, `NONE` nothing applies. `status` carries the reasoning.
 */
export type ReferenceSource = "MAPPING" | "LEGACY" | "NONE";

export interface PatientAge {
  /** Whole years elapsed since the date of birth. */
  years: number;
  /** Whole months elapsed since the date of birth. */
  months: number;
  /** Whole days elapsed since the date of birth. */
  days: number;
}

export type ResolvedPatientSex = "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";

export interface ReferenceResolution {
  status: ReferenceResolutionStatus;
  source: ReferenceSource;
  /** Mapping type that was applied, when a mapping matched. */
  mappingType?: ReferenceMappingType;
  /** Stable id of the applied mapping, so a result can snapshot exactly what applied. */
  mappingId?: string;
  valueType: ReferenceValueType;
  /** Text to display for this patient. Empty when nothing applies. */
  displayValue: string;
  valueFrom?: number;
  valueTo?: number;
  sex?: ReferenceMappingSex;
  ageUnit?: ReferenceAgeUnit;
  ageFrom?: number;
  ageTo?: number;
  /** Patient context actually used for the decision. */
  patient: {
    age?: PatientAge;
    /** Age taken from the stored age field, when there is no date of birth. */
    ageYearsFromRecord?: number;
    sex: ResolvedPatientSex;
    ageSource: "DATE_OF_BIRTH" | "AGE_FIELD" | "UNKNOWN";
  };
  /** Legacy free-text state, reported so nothing historical is hidden. */
  legacy?: {
    referenceRange?: string;
    referenceType?: string;
    genderRanges?: IGenderRange[];
  };
  /** Plain-language explanation of the outcome, safe to show to staff. */
  reason: string;
  /** Candidate mappings that matched when the status is AMBIGUOUS. */
  ambiguousMappings?: Array<{
    mappingId?: string;
    mappingType: ReferenceMappingType;
    displayValue?: string;
  }>;
}

export interface PatientContext {
  dateOfBirth?: Date | string | null;
  /** Authoritative age in years, used only when no date of birth exists. */
  age?: number | null;
  gender?: string | null;
}

interface ReferenceInput {
  referenceMappings?: IReferenceMapping[] | null;
  mappingTypes?: ReferenceMappingType[] | null;
  /** Legacy free-text range. */
  referenceRange?: string | null;
  referenceType?: string | null;
  genderRanges?: IGenderRange[] | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Normalises the patient's recorded sex.
 *
 * Only male and female map to a binary sex. `other` and anything unrecognised
 * stay distinct so a sex-specific range is never applied to a patient whose sex
 * the record does not state.
 */
export function resolvePatientSex(gender?: string | null): ResolvedPatientSex {
  const value = String(gender ?? "").trim().toLowerCase();
  if (!value) return "UNKNOWN";
  if (value === "male" || value === "m") return "MALE";
  if (value === "female" || value === "f") return "FEMALE";
  if (value === "other" || value === "o") return "OTHER";
  return "UNKNOWN";
}

/**
 * Whole years/months/days elapsed since the date of birth.
 *
 * Age bands are matched on completed units (a patient one day short of their
 * 18th birthday is still 17), which is how "18 years and above" is read on a
 * report.
 */
export function computeAgeFromDateOfBirth(
  dateOfBirth?: Date | string | null,
  now: Date = new Date(),
): PatientAge | undefined {
  if (!dateOfBirth) return undefined;
  const dob = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return undefined;

  // Compare at day granularity: a time-of-day difference must not change a
  // patient's whole-day age.
  const dobDay = Date.UTC(dob.getFullYear(), dob.getMonth(), dob.getDate());
  const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  if (nowDay < dobDay) return undefined;

  const days = Math.floor((nowDay - dobDay) / DAY_MS);

  // Total whole months since birth, then split into years + remainder.
  const totalMonths =
    (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  // Subtract one month when this month's day-of-month has not been reached yet.
  const months = totalMonths - (now.getDate() >= dob.getDate() ? 0 : 1);
  const years = Math.floor(months / 12);

  return { years, months: months - years * 12, days };
}

/** Total elapsed age expressed in the unit a mapping is written in. */
function ageInUnit(age: PatientAge, unit: ReferenceAgeUnit): number {
  switch (unit) {
    case "DAY":
      return age.days;
    case "MONTH":
      return age.months;
    case "YEAR":
      return age.years;
    default:
      return age.years;
  }
}

/**
 * Inclusive age check against a mapping window.
 *
 * Returns false when the patient's age could not be established in the mapping's
 * unit, so an unknown age never matches an age-specific range.
 */
export function ageMatches(
  mapping: IReferenceMapping,
  age: PatientAge | undefined,
): boolean {
  if (mapping.ageUnit === undefined) return true;
  if (!age) return false;
  const value = ageInUnit(age, mapping.ageUnit);
  if (mapping.ageFrom !== undefined && value < mapping.ageFrom) return false;
  if (mapping.ageTo !== undefined && value > mapping.ageTo) return false;
  return true;
}

/**
 * Inclusive sex check against a mapping.
 *
 * `BOTH` means "the same range for men and women" and therefore matches only a
 * recorded male or female sex. It is not applied to an unstated or `other` sex,
 * because that range was never stated for such a patient.
 */
export function sexMatches(
  mapping: IReferenceMapping,
  sex: ResolvedPatientSex,
): boolean {
  if (mapping.sex === undefined || mapping.sex === "BOTH") {
    return mapping.sex === undefined || sex === "MALE" || sex === "FEMALE";
  }
  if (mapping.sex === "MALE") return sex === "MALE";
  return sex === "FEMALE";
}

function mappingDisplayValue(mapping: IReferenceMapping): string {
  const explicit = mapping.displayValue?.trim();
  if (explicit) return explicit;
  const parts: string[] = [];
  if (mapping.valueFrom !== undefined && mapping.valueTo !== undefined) {
    parts.push(`${mapping.valueFrom} - ${mapping.valueTo}`);
  } else if (mapping.valueFrom !== undefined) {
    parts.push(`>= ${mapping.valueFrom}`);
  } else if (mapping.valueTo !== undefined) {
    parts.push(`<= ${mapping.valueTo}`);
  }
  return parts.join("");
}

/**
 * Qualitative wording with no single numeric interval. A range containing any of
 * these is never turned into a numeric comparison.
 */
const LEGACY_CATEGORICAL =
  /\b(normal|abnormal|desirable|border ?line|mild|moderate|severe|critical|elevated|increased|decreased|low|high|negative|positive|equivocal|indeterminate|reactive|non-?reactive|trace|deficient|insufficient|sufficient|weakly|adequate|poor|excellent|diabetic|diabetes)\b/i;

/**
 * Context words (age, life stage, cycle, pregnancy) a range may depend on. Such a
 * range is never compared automatically: choosing a value would need a rule that
 * was not established, and guessing one would be unsafe.
 */
const LEGACY_CONTEXT =
  /\b(child|children|infant|infants|newborn|neonate|adult|adults|birth|days?|weeks?|months?|years?|yrs?|age|trimester|phase|phases|follicular|luteal|ovulation|ovulatory|menopaus\w*|pregnan\w*|gestat\w*|cycle)\b/i;

const LEGACY_GENDER_LINE =
  /^\s*(males?|female|females|men|man|women|woman|m|f)\s*[:\-–—]\s*/i;

interface LegacySegment {
  sex?: "MALE" | "FEMALE";
  text: string;
}

function legacyGenderOf(label: string): "MALE" | "FEMALE" | undefined {
  const value = label.trim().toLowerCase();
  if (value.startsWith("m")) return "MALE";
  if (value.startsWith("f") || value.startsWith("w")) return "FEMALE";
  return undefined;
}

/** Splits legacy range text into one segment per line / per inline sex marker. */
function splitLegacySegments(text: string): LegacySegment[] {
  const normalized = text.replace(/<br\s*\/?>/gi, "\n").replace(/\r\n?/g, "\n");
  const segments: LegacySegment[] = [];
  for (const rawLine of normalized.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/\([MF]\)/i.test(line)) {
      for (const part of line.split("/")) {
        const marker = part.match(/\(([MF])\)/i);
        const sex = marker ? (marker[1].toUpperCase() === "M" ? "MALE" : "FEMALE") : undefined;
        const body = part.replace(/\([MF]\)/gi, "").trim();
        if (body) segments.push({ sex, text: body });
      }
      continue;
    }
    const label = line.match(LEGACY_GENDER_LINE);
    if (label) {
      segments.push({ sex: legacyGenderOf(label[1]), text: line.slice(label[0].length).trim() });
    } else {
      segments.push({ text: line });
    }
  }
  return segments;
}

function legacyNumber(token: string): number | undefined {
  const normalized = token.replace(/,/g, ".").replace(/%/g, "").trim();
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

/** Extracts a single numeric interval from one clean segment, or undefined. */
function parseLegacyBoundsText(text: string): { from?: number; to?: number } | undefined {
  if (/\d\s*:\s*\d/.test(text)) return undefined; // titre / dilution, no interval
  const cleaned = text.replace(/[a-z%/µμ]+/gi, " ").replace(/[()]/g, " ").trim();

  const pair = cleaned.match(
    /(-?\d+(?:[.,]\d+)?)\s*(?:[-–—~]|\bto\b)\s*(-?\d+(?:[.,]\d+)?)/i,
  );
  if (pair) {
    const a = legacyNumber(pair[1]);
    const b = legacyNumber(pair[2]);
    if (a === undefined || b === undefined) return undefined;
    if (a === 0 && b === 0) return undefined;
    return { from: Math.min(a, b), to: Math.max(a, b) };
  }

  const upto = cleaned.match(/^(?:up\s*to|upto)\s*(-?\d+(?:[.,]\d+)?)/i);
  if (upto) {
    const value = legacyNumber(upto[1]);
    if (value !== undefined) return { to: value };
  }

  const op = cleaned.match(/^\s*(<=|>=|≤|≥|<|>)\s*(-?\d+(?:[.,]\d+)?)/);
  if (op) {
    const value = legacyNumber(op[2]);
    if (value === undefined) return undefined;
    const isUpper = op[1] === "<" || op[1] === "<=" || op[1] === "≤";
    return isUpper ? { to: value } : { from: value };
  }

  return undefined;
}

/**
 * Attempts to read a single numeric interval from a parameter's legacy range so
 * the result can be flagged. Returns undefined for anything narrative, age- or
 * context-dependent, ambiguous, or sex-specific with no matching recorded sex —
 * in those cases the range is shown but never compared.
 */
function parseLegacyBounds(
  parameter: ReferenceInput,
  sex: ResolvedPatientSex,
): { from?: number; to?: number } | undefined {
  if (parameter.referenceType === "GENDER_WISE") {
    const want = sex === "MALE" ? "M" : sex === "FEMALE" ? "F" : undefined;
    if (!want) return undefined;
    const row = (parameter.genderRanges ?? []).find((range) => range.gender === want);
    if (!row) return undefined;
    if (row.from === undefined && row.to === undefined) return undefined;
    if (row.from === undefined) return { to: row.to };
    if (row.to === undefined) return { from: row.from };
    return { from: Math.min(row.from, row.to), to: Math.max(row.from, row.to) };
  }

  const text = parameter.referenceRange?.trim();
  if (!text) return undefined;
  const segments = splitLegacySegments(text);
  if (segments.length === 0) return undefined;
  if (segments.some((segment) => LEGACY_CONTEXT.test(segment.text))) return undefined;

  const gendered = segments.filter((segment) => segment.sex);
  let chosen: LegacySegment | undefined;
  if (gendered.length > 0) {
    if (sex !== "MALE" && sex !== "FEMALE") return undefined;
    chosen = gendered.find((segment) => segment.sex === sex);
  } else if (segments.length === 1) {
    chosen = segments[0];
  } else {
    return undefined; // several lines with no sex marker: narrative
  }
  if (!chosen || LEGACY_CATEGORICAL.test(chosen.text)) return undefined;
  return parseLegacyBoundsText(chosen.text);
}

/**
 * Chooses the reference range that applies to a patient.
 *
 * See the module comment for the full selection policy.
 */
export function resolveReferenceRange(
  parameter: ReferenceInput,
  patient: PatientContext | null | undefined,
  now: Date = new Date(),
): ReferenceResolution {
  const sex = resolvePatientSex(patient?.gender);
  const age = computeAgeFromDateOfBirth(patient?.dateOfBirth, now);
  const ageFromRecord =
    age === undefined &&
    typeof patient?.age === "number" &&
    Number.isFinite(patient.age) &&
    patient.age >= 0
      ? patient.age
      : undefined;

  const patientInfo: ReferenceResolution["patient"] = {
    sex,
    ageSource: age
      ? "DATE_OF_BIRTH"
      : ageFromRecord !== undefined
        ? "AGE_FIELD"
        : "UNKNOWN",
    ...(age ? { age } : {}),
    ...(ageFromRecord !== undefined ? { ageYearsFromRecord: ageFromRecord } : {}),
  };

  const legacy = {
    ...(parameter.referenceRange ? { referenceRange: parameter.referenceRange } : {}),
    ...(parameter.referenceType ? { referenceType: parameter.referenceType } : {}),
    ...(parameter.genderRanges && parameter.genderRanges.length
      ? { genderRanges: parameter.genderRanges }
      : {}),
  };

  const mappings = parameter.referenceMappings ?? [];

  // No structured mappings: keep the legacy free-text range exactly as stored.
  if (mappings.length === 0) {
    // Legacy gender-wise rows are configured mappings too. Use the same row
    // for display and comparison; never display the combined free-text fallback.
    if (parameter.referenceType === "GENDER_WISE" && parameter.genderRanges?.length) {
      const gender = sex === "MALE" ? "M" : sex === "FEMALE" ? "F" : undefined;
      const candidates = gender ? parameter.genderRanges.filter((row) => row.gender === gender) : [];
      if (candidates.length !== 1) {
        return { status: candidates.length > 1 ? "AMBIGUOUS" : "NO_MAPPING_FOR_PATIENT", source: "NONE", valueType: "NARRATIVE", displayValue: "", patient: patientInfo, legacy,
          reason: candidates.length > 1 ? "More than one gender-wise range matches this patient." : "No gender-wise range matches this patient." };
      }
      const row = candidates[0];
      const displayValue = row.text?.trim() || (row.from !== undefined && row.to !== undefined ? `${row.from} - ${row.to}` : row.from !== undefined ? `>= ${row.from}` : row.to !== undefined ? `<= ${row.to}` : "");
      const narrative = row.text && (LEGACY_CATEGORICAL.test(row.text) || LEGACY_CONTEXT.test(row.text));
      const bounds = narrative ? undefined : parseLegacyBounds(parameter, sex);
      return { status: displayValue ? "MATCHED" : "NOT_CONFIGURED", source: displayValue ? "LEGACY" : "NONE", valueType: bounds ? "NUMERIC" : "NARRATIVE", displayValue,
        ...(bounds?.from !== undefined ? { valueFrom: bounds.from } : {}), ...(bounds?.to !== undefined ? { valueTo: bounds.to } : {}), patient: patientInfo, legacy,
        reason: "Showing the configured gender-wise reference for this patient." };
    }
    const text = parameter.referenceRange?.trim() ?? "";
    if (!text && !parameter.genderRanges?.length) {
      return {
        status: "NOT_CONFIGURED",
        source: "NONE",
        valueType: "NARRATIVE",
        displayValue: "",
        patient: patientInfo,
        legacy,
        reason: "No reference range is configured for this parameter.",
      };
    }
    // The stored range is always shown as text; when it is a single safe numeric
    // interval it is also returned as bounds, so the result can be flagged. A
    // narrative, age- or sex-specific-with-no-sex range keeps no bounds and is
    // never compared.
    const bounds = parseLegacyBounds(parameter, sex);
    return {
      status: "MATCHED",
      source: "LEGACY",
      valueType: bounds ? "NUMERIC" : "NARRATIVE",
      displayValue: text,
      ...(bounds?.from !== undefined ? { valueFrom: bounds.from } : {}),
      ...(bounds?.to !== undefined ? { valueTo: bounds.to } : {}),
      patient: patientInfo,
      legacy,
      reason: text
        ? "Showing the stored reference range text."
        : "Showing the stored gender-wise reference range text.",
    };
  }

  // The recorded mapping types decide which types may apply, in the fixed
  // priority order. Types present in mappings but not in mappingTypes are
  // ignored so a stray row cannot silently take precedence.
  const declaredTypes = parameter.mappingTypes?.length
    ? parameter.mappingTypes
    : Array.from(new Set(mappings.map((mapping) => mapping.mappingType)));

  // GENERIC is never used as a fallback. Once a parameter declares an age or sex
  // specific requirement, a patient who does not satisfy it must be reported as
  // unmatched rather than quietly given the generic range: showing a generic
  // range for a patient who needs a specific one would be a guess. A generic
  // range therefore applies only when it is the sole configured type.
  const hasSpecificRequirement = declaredTypes.some((type) => type !== "GENERIC");
  const priority = (["AGE_SEX_WISE", "AGE_WISE", "SEX_WISE", "GENERIC"] as const)
    .filter((type) => declaredTypes.includes(type))
    .filter((type) => !(type === "GENERIC" && hasSpecificRequirement));

  // Age in years is available from the age field only; other units need a DOB.
  const effectiveAge: PatientAge | undefined =
    age ?? (ageFromRecord !== undefined ? { years: ageFromRecord, months: -1, days: -1 } : undefined);

  for (const mappingType of priority) {
    // A row with Status N is kept for history but must never be applied to a
    // patient result. Filtering here rather than at the top means a parameter
    // whose rows are all inactive still reports "no mapping matches" instead of
    // quietly falling back to its legacy free-text range.
    const candidates = mappings.filter(
      (mapping) =>
        mapping.mappingType === mappingType && mapping.active !== false,
    );
    const matches = candidates.filter(
      (mapping) => sexMatches(mapping, sex) && ageMatches(mapping, effectiveAge),
    );
    if (matches.length === 0) continue;

    if (matches.length > 1) {
      return {
        status: "AMBIGUOUS",
        source: "NONE",
        valueType: matches[0].valueType,
        mappingType,
        displayValue: "",
        patient: patientInfo,
        legacy,
        reason: `More than one ${mappingType.replace(/_/g, " ").toLowerCase()} range matches this patient. A lab user must choose one.`,
        ambiguousMappings: matches.map((mapping) => ({
          mappingId:
            typeof (mapping as { _id?: unknown })._id === "object"
              ? String((mapping as { _id?: unknown })._id)
              : undefined,
          mappingType: mapping.mappingType,
          displayValue: mappingDisplayValue(mapping),
        })),
      };
    }

    const mapping = matches[0];
    const rawId = (mapping as { _id?: unknown })._id;
    return {
      status: "MATCHED",
      source: "MAPPING",
      mappingType,
      mappingId: rawId ? String(rawId) : undefined,
      valueType: mapping.valueType,
      displayValue: mappingDisplayValue(mapping),
      ...(mapping.valueFrom !== undefined ? { valueFrom: mapping.valueFrom } : {}),
      ...(mapping.valueTo !== undefined ? { valueTo: mapping.valueTo } : {}),
      ...(mapping.sex !== undefined ? { sex: mapping.sex } : {}),
      ...(mapping.ageUnit !== undefined ? { ageUnit: mapping.ageUnit } : {}),
      ...(mapping.ageFrom !== undefined ? { ageFrom: mapping.ageFrom } : {}),
      ...(mapping.ageTo !== undefined ? { ageTo: mapping.ageTo } : {}),
      patient: patientInfo,
      legacy,
      reason: `Applied the configured ${mappingType.replace(/_/g, " ").toLowerCase()} reference range.`,
    };
  }

  // No configured type matched. Say precisely why, so staff can act on it.
  //
  // `source` is "where the displayed range came from", so it is NONE here: the
  // master declares mappings, but none applies to this patient, and legacy free
  // text is deliberately not used as a fallback once mappings exist.
  return {
    status: "NO_MAPPING_FOR_PATIENT",
    source: "NONE",
    valueType: "NARRATIVE",
    displayValue: "",
    patient: patientInfo,
    legacy,
    reason: noMatchReason(declaredTypes, priority, sex, effectiveAge),
  };
}

function noMatchReason(
  declaredTypes: ReferenceMappingType[],
  priority: readonly ReferenceMappingType[],
  sex: ResolvedPatientSex,
  age: PatientAge | undefined,
): string {
  if (declaredTypes.length === 0) return "No reference mapping type is configured.";
  if (priority.length === 0) return "No supported reference mapping type is configured.";

  const hasAgeRequirement = declaredTypes.some(
    (type) => type === "AGE_WISE" || type === "AGE_SEX_WISE",
  );
  const hasSexRequirement = declaredTypes.some(
    (type) => type === "SEX_WISE" || type === "AGE_SEX_WISE",
  );

  if (hasAgeRequirement && !age) {
    return "This parameter has an age-specific reference range, but the patient has no date of birth or recorded age.";
  }
  if (
    hasSexRequirement &&
    (sex === "UNKNOWN" || sex === "OTHER")
  ) {
    return sex === "UNKNOWN"
      ? "This parameter has a sex-specific reference range, but the patient has no recorded sex."
      : "This parameter has a sex-specific reference range, which is not stated for this patient's sex.";
  }
  return `No configured reference range matches this patient (age ${age ? `${age.years} year(s)` : "unknown"}, sex ${sex.toLowerCase()}).`;
}

export type ValueFlag = "IN_RANGE" | "OUT_OF_RANGE" | "NOT_COMPARABLE";

/**
 * Compares an entered value against a resolved reference.
 *
 * Only NUMERIC mappings with stored bounds are compared. A narrative range, or
 * a value that is not a number, is reported as not comparable rather than being
 * forced into a pass/fail decision.
 */
export function evaluateValue(
  value: string | number | boolean | null | undefined,
  resolution: ReferenceResolution,
): ValueFlag {
  // Both a structured NUMERIC mapping and a safely-parsed legacy numeric range
  // carry bounds; either may flag the value. Narrative resolutions never do.
  if (resolution.status !== "MATCHED") {
    return "NOT_COMPARABLE";
  }
  if (resolution.valueType !== "NUMERIC") return "NOT_COMPARABLE";
  if (resolution.valueFrom === undefined && resolution.valueTo === undefined) {
    return "NOT_COMPARABLE";
  }
  if (typeof value === "boolean") return "NOT_COMPARABLE";

  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value.trim())
        : Number.NaN;
  if (!Number.isFinite(numeric)) return "NOT_COMPARABLE";

  if (resolution.valueFrom !== undefined && numeric < resolution.valueFrom) {
    return "OUT_OF_RANGE";
  }
  if (resolution.valueTo !== undefined && numeric > resolution.valueTo) {
    return "OUT_OF_RANGE";
  }
  return "IN_RANGE";
}

/**
 * Reports whether a candidate mapping overlaps an existing one.
 *
 * Overlap is only meaningful between mappings of the same type that constrain the
 * same dimensions: two sex ranges for the same age window overlap, while an age
 * band and a sex band for the same parameter do not.
 */
export function overlapsMapping(
  candidate: Pick<
    IReferenceMapping,
    "mappingType" | "sex" | "ageUnit" | "ageFrom" | "ageTo"
  >,
  existing: Pick<
    IReferenceMapping,
    "mappingType" | "sex" | "ageUnit" | "ageFrom" | "ageTo"
  >,
): boolean {
  if (candidate.mappingType !== existing.mappingType) return false;
  if (candidate.ageUnit !== existing.ageUnit) return false;
  if (candidate.sex !== existing.sex) return false;

  const rangeLow = candidate.ageFrom ?? Number.NEGATIVE_INFINITY;
  const rangeHigh = candidate.ageTo ?? Number.POSITIVE_INFINITY;
  const existingLow = existing.ageFrom ?? Number.NEGATIVE_INFINITY;
  const existingHigh = existing.ageTo ?? Number.POSITIVE_INFINITY;
  return rangeLow <= existingHigh && existingLow <= rangeHigh;
}
