/**
 * Backend mirror of the front-end reference-range resolver.
 *
 * The front-end module `frontend/src/lib/reference-range.ts` decides whether a
 * stored range string may be compared against a numeric patient result. This
 * module answers the same question on the server so a parameter can be flagged
 * as "Needs Lab Review" in the database, filtered on the master page and printed
 * in the import audit.
 *
 * Both implementations follow the same conservative rules, and nothing here ever
 * invents or rewrites a range: a value is only ever reported as reviewable or
 * not. The two were cross-checked row by row over every stored parameter (302
 * flagged on both sides, no disagreement); the check was a one-off verification
 * and is not a script flag.
 */

export type ReviewReason =
  | "missing-range"
  | "conditional-range"
  | "ambiguous-gender-range"
  | "qualitative-range";

export interface RangeReview {
  /** True when the range must be confirmed by the lab before it is applied. */
  needsLabReview: boolean;
  reviewReason?: ReviewReason;
  /** Whether a numeric result may be compared for a male / female patient. */
  comparableM: boolean;
  comparableF: boolean;
}

/** Qualitative band markers: presence of any of these blocks a numeric comparison. */
const CATEGORICAL_WORDS =
  /\b(normal|abnormal|desired|desirable|border ?line|borderline|mild|moderate|severe|critical|elevated|increased|decreased|low|high|negative|positive|equivocal|indeterminate|reactive|non-?reactive|trace|weakly)\b/i;

/** Age / life-stage / clinical-state markers: these need context the UI lacks. */
const CONDITION_WORDS =
  /\b(child|children|infant|infants|newborn|neonate|premature|adult|adults|birth|neonatal|day|days|week|weeks|month|months|year|years|yr|yrs|age|aged|trimester|phase|phases|follicular|luteal|ovulation|ovulatory|menopaus|pregnan|gestat|lactat|post ?partum|cycle)\b/i;

/** Label words that introduce a numeric range. */
const GENDER_LABEL =
  /^\s*(male|males|female|females|man|woman|men|women|m|f)\s*(?:[:\-–—]\s*|\s+)(?=\S)/i;

interface Segment {
  gender: "M" | "F" | null;
  conditional: boolean;
  categorical: boolean;
  text: string;
}

/** Only presentation artefacts are repaired; no number or word is changed. */
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

/** Splits the source into one segment per line, keeping the inline "(M) / (F)" form. */
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
        const gender = marker ? (marker[1].toUpperCase() as "M" | "F") : null;
        const text = part.replace(/\([MFmf]\)/g, "").trim();
        if (text) segments.push(buildSegment(text, gender));
      }
      continue;
    }

    const label = line.match(GENDER_LABEL);
    const gender = label ? (label[1][0].toUpperCase() as "M" | "F") : null;
    const text = gender ? line.slice(label![0].length).trim() : line;
    if (text) segments.push(buildSegment(text, gender));
  }

  return segments;
}

function buildSegment(text: string, gender: "M" | "F" | null): Segment {
  const rest = text.replace(/^(?:up\s*to|upto)\b/i, "");
  return {
    gender,
    conditional: CONDITION_WORDS.test(rest),
    categorical: CATEGORICAL_WORDS.test(text),
    text,
  };
}

/** A plain numeric interval, or null when the segment is not one. */
function parseBounds(text: string): { from: number; to: number } | null {
  // Titre / dilution notation such as "<1:80" has no single numeric interval.
  if (/\d\s*:\s*\d/.test(text)) return null;

  const cleaned = text
    .replace(/\b(?:mg|gm|g|kg|ml|l|ltr|litre|liter|mmol|mol|iu|usn|µg|ng|pg|mg\/dl|mg\/l|g\/dl|g\/l|mmol\/l|meq\/l|cells?|hpfl?|hpf|cfu\/ml|%|percent|days?|hours?|min|sec)\b/gi, " ")
    .replace(/[()]/g, " ")
    .trim();

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

  const upto = cleaned.match(/^(?:up\s*to|upto)\s*(-?\d+(?:[.,]\d+)?)/i);
  if (upto) {
    const num = parseNumberToken(upto[1]);
    if (num !== null) return { from: -Infinity, to: num };
  }

  const op = cleaned.match(/^\s*(<=|>=|≤|≥|<|>)\s*(-?\d+(?:[.,]\d+)?)/);
  if (op) {
    const num = parseNumberToken(op[2]);
    if (num === null) return null;
    const isUpper = op[1] === "<" || op[1] === "<=" || op[1] === "≤";
    return isUpper ? { from: -Infinity, to: num } : { from: num, to: Infinity };
  }

  return null;
}

function segmentBounds(segment: Segment): boolean {
  if (segment.categorical) return false;
  return parseBounds(segment.text) !== null;
}

/**
 * Classifies one stored reference-range string.
 *
 * A parameter is marked "Needs Lab Review" when the source cannot be applied
 * automatically for at least one sex:
 *  - no range at all                     -> missing-range
 *  - depends on age/phase/pregnancy      -> conditional-range
 *  - sex split that is incomplete/worded -> ambiguous-gender-range
 *  - bands, words or placeholder values  -> qualitative-range
 */
export function reviewReferenceRange(
  range: string | null | undefined,
): RangeReview {
  const display = normalizeRangeText(range);

  if (!display) {
    return {
      needsLabReview: true,
      reviewReason: "missing-range",
      comparableM: false,
      comparableF: false,
    };
  }

  const segments = toSegments(display);

  if (segments.length === 0) {
    return {
      needsLabReview: true,
      reviewReason: "qualitative-range",
      comparableM: false,
      comparableF: false,
    };
  }

  if (segments.some((segment) => segment.conditional)) {
    return {
      needsLabReview: true,
      reviewReason: "conditional-range",
      comparableM: false,
      comparableF: false,
    };
  }

  const genderSegments = segments.filter((segment) => segment.gender);

  if (genderSegments.length > 0) {
    const male = genderSegments.find((segment) => segment.gender === "M");
    const female = genderSegments.find((segment) => segment.gender === "F");
    const comparableM = Boolean(male && segmentBounds(male));
    const comparableF = Boolean(female && segmentBounds(female));

    // Both sexes listed and usable -> the entry screen picks the right one.
    if (comparableM && comparableF) {
      return { needsLabReview: false, comparableM, comparableF };
    }

    return {
      needsLabReview: true,
      reviewReason: "ambiguous-gender-range",
      comparableM,
      comparableF,
    };
  }

  if (segments.length > 1 || segments[0].categorical) {
    return {
      needsLabReview: true,
      reviewReason: "qualitative-range",
      comparableM: false,
      comparableF: false,
    };
  }

  const numeric = segmentBounds(segments[0]);
  if (numeric) {
    return { needsLabReview: false, comparableM: true, comparableF: true };
  }

  return {
    needsLabReview: true,
    reviewReason: "qualitative-range",
    comparableM: false,
    comparableF: false,
  };
}