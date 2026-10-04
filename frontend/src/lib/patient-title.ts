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