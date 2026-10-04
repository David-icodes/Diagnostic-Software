/**
 * Reference-range interpretation for the Parameter Based Test Results page.
 *
 * The CSV supplied by the lab is the only source of these strings, so this
 * module treats every range as *text that came from the source* and only
 * derives a numeric comparison when the text is unambiguous. It never invents a
 * range, never assumes a default, and never narrows a range that is conditioned
 * on something the UI does not know (age, cycle phase, pregnancy, ...).
 *
 * Rules implemented here:
 *  - gender-separated ranges ("Males : ...\nFemales: ...", "M 0.9-1.5 / F 0.8-1.3",
 *    "13.0-17.0 (M) / 12.0-15.0 (F)") resolve against the selected patient's sex;
 *  - a range that also depends on age / phase / pregnancy is *not* compared,
 *    even when one of its lines is gender specific ("Male ...\nFemale ...\nChild ...");
 *  - categorical banding ("<200 : Desirable", "80% - 100% : Normal") is *not*
 *    compared, because there is no single "inside" value;
 *  - a bare number without an operator ("13.5", "00") is *not* compared;
 *  - everything else is compared strictly, with inclusive bounds for "x-y",
 *    "upto" and ">=" forms, and strict bounds for "<" / ">".
 *
 * If a range cannot be resolved safely the UI keeps showing the full source
 * text and simply does not flag the result.
 */

export type GenderCode = "M" | "F" | "O";

/** How a reference-range string was understood. */
export type RangeKind =
  /** No range configured in the source. */
  | "empty"
  /** One clearly defined numeric range that applies as-is. */
  | "numeric"
  /** Male/female variants of one numeric range. */
  | "gender"
  /** Also depends on age / cycle phase / pregnancy / another condition. */
  | "conditional"
  /** Qualitative text with no single "inside" value (bands, words, units). */
  | "descriptive";

export interface RangeBounds {
  /** Lower bound of a two-sided range. */
  from: number;
  /** Upper bound of a two-sided range. */
  to: number;
}

export interface ApplicableRange {
  kind: RangeKind;
  /**
   * Text to display for this patient.
   * For gender/conditional ranges without a safe match this is the complete,
   * unmodified source text so the user can still read the source.
   */
  text: string;
  /** The source string as stored, never modified. */
  sourceText: string;
  /** Sex the resolved text applies to, when the source distinguishes sex. */
  appliesTo: GenderCode | null;
  /** True only when a numeric result may be compared against `text`. */
  comparable: boolean;
  /** Bounds to compare against; present only when `comparable` is true. */
  bounds?: RangeBounds;
  /** Staff-facing explanation when the range was not fully applied. */
  note?: string;
}

export type ResultStatus = "in-range" | "out-of-range" | "not-comparable";

export interface RangeClassification {
  status: ResultStatus;
  bounds?: RangeBounds;
  /** Explanation shown next to a result that could not be interpreted. */
  note?: string;
}

/** Qualitative band markers: presence of any of these blocks a numeric comparison. */
const CATEGORICAL_WORDS =
  /\b(normal|abnormal|desired|desirable|border ?line|borderline|mild|moderate|severe|critical|elevated|increased|decreased|low|high|negative|positive|equivocal|indeterminate|reactive|non-?reactive|trace|weakly)\b/i;

/** Age / life-stage / clinical-state markers: these need context the UI lacks. */
const CONDITION_WORDS =
  /\b(child|children|infant|infants|newborn|neonate|premature|adult|adults|birth|neonatal|day|days|week|weeks|month|months|year|years|yr|yrs|age|aged|trimester|phase|phases|follicular|luteal|ovulation|ovulatory|menopaus|pregnan|gestat|lactat|post ?partum|cycle|years?)\b/i;

/** Label words that introduce a numeric range. */
const GENDER_LABEL =
  /^\s*(male|males|female|females|man|woman|men|women|m|f)\s*(?:[:\-–—]\s*|\s+)(?=\S)/i;

interface Segment {
  gender: GenderCode | null;
  conditional: boolean;
  categorical: boolean;
  text: string;
}

/**
 * Prepares a stored range string for reading. Only presentation artefacts are
 * repaired (HTML breaks and escaped newlines); no numbers or words are changed.
 */
export function normalizeRangeText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\\r\\n|\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function parseNumberToken(token: string): number | null {
  const normalized = token.replace(",", ".").replace(/%/g, "").trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

/**
 * Splits the source into one segment per line, keeping the inline
 * "value (M) / value (F)" form of the older master catalog intact. A "/" is only
 * treated as a separator when a sex marker is present, so units such as
 * "cells/hpf" and ratios such as "0-3 gms/dl" are never split.
 */
function toSegments(range: string): Segment[] {
  const lines = range
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const segments: Segment[] = [];

  for (const line of lines) {
    if (/\([MFmf]\)/.test(line)) {
      for (const part of line.split("/")) {
        const marker = part.match(/\(([MFmf])\)/);
        const gender = marker ? (marker[1].toUpperCase() as GenderCode) : null;
        const text = part.replace(/\([MFmf]\)/g, "").trim();
        if (text) segments.push(buildSegment(text, gender));
      }
      continue;
    }

    const label = line.match(GENDER_LABEL);
    const gender = label
      ? (label[1][0].toUpperCase() as GenderCode)
      : null;
    const text = gender ? line.slice(label![0].length).trim() : line;
    if (text) segments.push(buildSegment(text, gender));
  }

  return segments;
}

function buildSegment(text: string, gender: GenderCode | null): Segment {
  const rest = text.replace(/^(?:up\s*to|upto)\b/i, "");
  return {
    gender,
    conditional: CONDITION_WORDS.test(rest),
    categorical: CATEGORICAL_WORDS.test(text),
    text,
  };
}

/**
 * Extracts a usable numeric interval from one segment.
 *
 * Returns null unless the text is a plain interval: an explicit operator or an
 * "x - y" pair, with no categorical banding and not a bare number.
 */
function parseBounds(text: string): RangeBounds | null {
  // Titre / dilution notation such as "<1:80" has no single numeric interval.
  if (/\d\s*:\s*\d/.test(text)) return null;

  const cleaned = text
    .replace(/\b(?:mg|gm|g|kg|ml|l|ltr|litre|liter|mmol|mol|iu|usn|µg|ng|pg|mg\/dl|mg\/l|g\/dl|g\/l|mmol\/l|meq\/l|cells?|hpfl?|hpf|cfu\/ml|%|percent|days?|hours?|min|sec)\b/gi, " ")
    .replace(/[()]/g, " ")
    .trim();

  // "0-3", "0 - 7 %", "60-30 mg/dL", "26.0 to 34.3", "1.10 - 1.35"
  const pair = cleaned.match(
    /(-?\d+(?:[.,]\d+)?)\s*(?:[-–—~]|\bto\b)\s*(-?\d+(?:[.,]\d+)?)/i,
  );
  if (pair) {
    const a = parseNumberToken(pair[1]);
    const b = parseNumberToken(pair[2]);
    if (a === null || b === null) return null;
    // "0-0" is a placeholder in the source, not a real interval.
    if (a === 0 && b === 0) return null;
    return { from: Math.min(a, b), to: Math.max(a, b) };
  }

  // "Upto 0.1 mg/dL", "up to 20 IU/ml" — an inclusive upper bound.
  const upto = cleaned.match(
    /^(?:up\s*to|upto)\s*(-?\d+(?:[.,]\d+)?)/i,
  );
  if (upto) {
    const num = parseNumberToken(upto[1]);
    if (num !== null) return { from: -Infinity, to: num };
  }

  // "< 150", ">4%", "<= 40", "≥ 10" — "<" and ">" stay strict in withinBounds.
  const op = cleaned.match(/^\s*(<=|>=|≤|≥|<|>)\s*(-?\d+(?:[.,]\d+)?)/);
  if (op) {
    const num = parseNumberToken(op[2]);
    if (num === null) return null;
    const isUpper = op[1] === "<" || op[1] === "<=" || op[1] === "≤";
    return isUpper ? { from: -Infinity, to: num } : { from: num, to: Infinity };
  }

  return null;
}

/**
 * Compares an interval that came from an operator against the value.
 * "<" / ">" are strict, "<=" / ">=" and "upto" include the bound.
 */
function withinBounds(
  value: number,
  bounds: RangeBounds,
  operator?: "<" | ">" | "<=" | ">=",
): boolean {
  switch (operator) {
    case "<":
      return value < bounds.to;
    case ">":
      return value > bounds.from;
    case "<=":
      return value <= bounds.to;
    case ">=":
      return value >= bounds.from;
    default:
      return value >= bounds.from && value <= bounds.to;
  }
}

function operatorOf(text: string): "<" | ">" | "<=" | ">=" | undefined {
  if (/^\s*up\s?to\b|^\s*upto\b/i.test(text)) return "<=";
  if (/^\s*<=/.test(text) || /^\s*≤/.test(text)) return "<=";
  if (/^\s*>=/.test(text) || /^\s*≥/.test(text)) return ">=";
  if (/^\s*</.test(text)) return "<";
  if (/^\s*>/.test(text)) return ">";
  return undefined;
}

/**
 * Resolves the range that applies to a patient of the given sex.
 *
 * `gender` accepts the values stored on a patient ("Male", "female", "M", ...).
 * When the source distinguishes sex and the patient's sex is unknown or does
 * not match, the full source text is returned un-comparable together with a
 * note, so the user sees exactly what the lab supplied.
 */
export function resolveRangeForGender(
  referenceRange: string | null | undefined,
  gender?: string | GenderCode | null,
): ApplicableRange {
  const sourceText = referenceRange?.trim() ?? "";
  const displayText = normalizeRangeText(referenceRange);

  if (!displayText) {
    return {
      kind: "empty",
      text: "",
      sourceText,
      appliesTo: null,
      comparable: false,
    };
  }

  const segments = toSegments(displayText);
  if (segments.length === 0) {
    return {
      kind: "descriptive",
      text: displayText,
      sourceText,
      appliesTo: null,
      comparable: false,
      note: "Reference range needs review",
    };
  }

  // Age / phase / pregnancy dependence: never compare, even when a line is
  // gender specific.
  if (segments.some((segment) => segment.conditional)) {
    const genders = new Set(segments.map((s) => s.gender).filter(Boolean));
    return {
      kind: "conditional",
      text: displayText,
      sourceText,
      appliesTo: genders.size === 1 ? ([...genders][0] as GenderCode) : null,
      comparable: false,
      note: "Range depends on age or clinical state and is shown in full",
    };
  }

  const genderSegments = segments.filter((segment) => segment.gender);
  if (genderSegments.length > 0) {
    const resolved = resolveGender(gender);
    const match = genderSegments.find((segment) => segment.gender === resolved);
    if (match && !match.categorical) {
      const bounds = parseBounds(match.text);
      if (bounds) {
        return {
          kind: "gender",
          text: match.text,
          sourceText,
          appliesTo: match.gender,
          comparable: true,
          bounds,
        };
      }
    }
    return {
      kind: "gender",
      text: displayText,
      sourceText,
      appliesTo: null,
      comparable: false,
      note: resolved
        ? `Sex-specific range does not list a range for this patient (${resolved === "M" ? "Male" : "Female"})`
        : "Sex-specific range: select a patient with a recorded sex",
    };
  }

  if (segments.some((segment) => segment.categorical) || segments.length > 1) {
    return {
      kind: "descriptive",
      text: displayText,
      sourceText,
      appliesTo: null,
      comparable: false,
      note: "Categorical reference range — verify against the source report",
    };
  }

  const segment = segments[0];
  const bounds = parseBounds(segment.text);
  if (bounds) {
    return {
      kind: "numeric",
      text: segment.text,
      sourceText,
      appliesTo: null,
      comparable: true,
      bounds,
    };
  }

  return {
    kind: "descriptive",
    text: displayText,
    sourceText,
    appliesTo: null,
    comparable: false,
    note: "Reference range needs review",
  };
}

function resolveGender(
  gender: string | GenderCode | null | undefined,
): GenderCode | undefined {
  if (!gender) return undefined;
  const value = String(gender).trim().toLowerCase();
  if (value === "m" || value === "male" || value === "males") return "M";
  if (value === "f" || value === "female" || value === "females") return "F";
  return undefined;
}

/**
 * Classifies a result value against a resolved range.
 *
 * Returns "not-comparable" for non-numeric input and for ranges that are not a
 * single unambiguous interval, so the UI shows no abnormal flag in those cases.
 */
export function classifyResult(
  value: string | number | boolean | null | undefined,
  applicable: ApplicableRange,
): RangeClassification {
  const num =
    typeof value === "number"
      ? Number.isFinite(value)
        ? value
        : null
      : typeof value === "string" && value.trim() !== ""
        ? Number(value.trim().replace(",", "."))
        : NaN;

  if (num === null || !Number.isFinite(num)) {
    return { status: "not-comparable" };
  }
  if (!applicable.comparable || !applicable.bounds) {
    return { status: "not-comparable", note: applicable.note };
  }

  const operator = operatorOf(applicable.text);
  return {
    status: withinBounds(num, applicable.bounds, operator) ? "in-range" : "out-of-range",
    bounds: applicable.bounds,
  };
}

/**
 * Convenience wrapper used by the results table.
 */
export function classifyResultInRange(
  result: string | number | boolean | null | undefined,
  referenceRange: string | null | undefined,
  gender?: string | GenderCode | null,
): RangeClassification {
  return classifyResult(result, resolveRangeForGender(referenceRange, gender));
}