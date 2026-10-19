/**
 * Single source of truth for patient title/salutation handling.
 *
 * The OSP bill form, the patient forms and any future registration screen all
 * resolve the title-to-gender relationship from here so the mapping can never
 * drift between components.
 */

/** Title options offered by the OSP bill / patient entry screens. */
export const PATIENT_TITLES = [
  "--Select--",
  "Mr.",
  "Miss.",
  "Mrs.",
  "Dr.",
  "Ms.",
  "Baby_Boy.",
  "Baby_Girl.",
  "Baby_Of.",
  "Baby.",
  "Master.",
] as const;

export type PatientTitle = (typeof PATIENT_TITLES)[number];

const TITLE_LOOKUP: Record<string, string> = {
  mr: "Mr.",
  mrs: "Mrs.",
  ms: "Ms.",
  miss: "Miss.",
  dr: "Dr.",
  master: "Master.",
  babyboy: "Baby Boy.",
  babygirl: "Baby Girl.",
  babyof: "Baby Of.",
  baby: "Baby.",
};

function titleLookupKey(value: string): string {
  return value.trim().replace(/\.+$/, "").replace(/[_\s]+/g, "").toLowerCase();
}

/** Canonical stored title, or "" for the placeholder/unknown text. */
export function normalizePatientTitle(value?: string | null): string {
  const raw = (value ?? "").trim();
  if (!raw || raw === "--Select--") return "";
  return TITLE_LOOKUP[titleLookupKey(raw)] ?? raw.replace(/[_\s]+/g, " ").trim();
}

/** Splits a legacy full name that still begins with a salutation. */
export function splitPatientTitle(fullName?: string | null): { title: string; name: string } {
  const value = (fullName ?? "").trim();
  if (!value) return { title: "", name: "" };
  const match = value.match(/^(mr|mrs|ms|miss|dr|master|baby[ _-]?boy|baby[ _-]?girl|baby[ _-]?of|baby)\.?\s+/i);
  if (!match) return { title: "", name: value };
  return { title: normalizePatientTitle(match[1]), name: value.slice(match[0].length).trim() };
}

/**
 * Display-only formatting shared by bills, reports and patient lists.
 * The stored name is never changed and a title is only prefixed once.
 *
 * `displayName` is accepted as a fallback because API responses already carry
 * the title-prefixed name. Tickets and reports can therefore show Mr./Mrs.
 * even when the caller only received the display value.
 */
export function formatPatientDisplayName(
  input: {
    title?: string | null;
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
  },
  options: { omitSurname?: boolean } = {},
): string {
  const storedTitle = normalizePatientTitle(input.title);
  const display = (input.displayName ?? "").trim();
  const constructed = (input.fullName ?? [input.firstName, input.lastName].filter(Boolean).join(" ")).trim();
  const full = display || constructed;
  const legacy = splitPatientTitle(full);
  let name = legacy.title ? legacy.name : full;
  if (options.omitSurname) {
    name = (input.firstName ?? "").trim() || name.split(/\s+/)[0] || name;
  }
  const title = storedTitle || legacy.title;
  if (!name) return title;
  return title ? `${title} ${name}`.trim() : name;
}

/** Gender values as they are displayed in the form controls. */
export const GENDER_OPTIONS = ["", "Female", "Male"] as const;

export type DisplayGender = (typeof GENDER_OPTIONS)[number];

/**
 * Explicit project mapping of title to gender.
 *
 * `Dr.`, `Baby.`, `Baby_Of.` and the unselected placeholder carry no gender in
 * this project and therefore map to `null`: the operator chooses explicitly
 * rather than the system guessing from the title.
 */
const TITLE_GENDER: Record<string, Exclude<DisplayGender, "">> = {
  Mr: "Male",
  Master: "Male",
  Baby_Boy: "Male",
  Miss: "Female",
  Mrs: "Female",
  Ms: "Female",
  Baby_Girl: "Female",
};

/**
 * Titles are stored with a trailing dot in the UI but may arrive without one or
 * in a different case (older records, imports, API clients), so both forms must
 * resolve the same.
 */
function normalizeTitle(title: string): string {
  return title
    .trim()
    .replace(/\.+$/, "")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

/** Lookup keyed by the normalized title so casing and trailing dots cannot matter. */
const TITLE_GENDER_BY_KEY: Record<string, Exclude<DisplayGender, "">> =
  Object.fromEntries(
    Object.entries(TITLE_GENDER).map(([title, gender]) => [
      normalizeTitle(title),
      gender,
    ]),
  );

/**
 * Returns the gender implied by a title, or `null` when the title does not
 * determine one. Gender is never inferred from the patient's name.
 */
export function genderFromTitle(title: string): Exclude<DisplayGender, ""> | null {
  if (!title) return null;
  return TITLE_GENDER_BY_KEY[normalizeTitle(title)] ?? null;
}

/** Maps a stored patient gender (`male`/`female`/`other`) to its display label. */
export function genderLabel(gender: string): Exclude<DisplayGender, ""> | "" {
  if (gender === "male") return "Male";
  if (gender === "female") return "Female";
  return "";
}

/** Maps a display label back to the value persisted on the patient record. */
export function genderToStoredValue(gender: string): string {
  if (gender === "Male") return "male";
  if (gender === "Female") return "female";
  return "";
}

export interface GenderAfterTitleChange {
  /** Gender to display and save after the title changed. */
  gender: Exclude<DisplayGender, ""> | "";
  /** The gender the new title implies, to remember for the next change. */
  impliedGender: Exclude<DisplayGender, ""> | null;
}

/**
 * The single rule for a title change.
 *
 * A title that implies a gender always sets it, so a stale value can never
 * survive. A title that implies nothing (`Dr.`, `Baby.`, unselected) clears the
 * previous value only while it is still the one the title implied, so a gender
 * the operator chose by hand is never thrown away.
 */
export function resolveGenderForTitleChange({
  title,
  currentGender,
  impliedGender,
}: {
  title: string;
  currentGender: string;
  impliedGender: Exclude<DisplayGender, ""> | null;
}): GenderAfterTitleChange {
  const implied = genderFromTitle(title);
  if (implied) {
    return { gender: implied, impliedGender: implied };
  }
  const genderWasImplied =
    impliedGender !== null && currentGender === impliedGender;
  return { gender: genderWasImplied ? "" : (currentGender as GenderAfterTitleChange["gender"]), impliedGender: null };
}