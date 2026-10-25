/**
 * Patient salutation handling.
 *
 * A title is stored separately from the patient's registered name. Displaying
 * the title must never rewrite the stored name, and a title that already exists
 * inside a legacy `fullName` must not be duplicated.
 */
const TITLES: Record<string, string> = {
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

function titleKey(value: string): string {
  return value
    .trim()
    .replace(/\.+$/, "")
    .replace(/[_\s]+/g, "")
    .toLowerCase();
}

/** Returns the canonical stored title, or "" for the placeholder/unknown text. */
export function normalizePatientTitle(value?: string | null): string {
  const raw = (value ?? "").trim();
  if (!raw || raw === "--Select--") return "";
  return TITLES[titleKey(raw)] ?? raw.replace(/[_\s]+/g, " ").trim();
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
 * Display-only name formatting shared by bills, reports and list screens.
 * `fullName` remains the source of truth for identity; the title is prefixed
 * once, even for legacy records that stored it inside the name.
 */
export function formatPatientDisplayName(input: {
  title?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
}): string {
  const storedTitle = normalizePatientTitle(input.title);
  const full = (input.fullName ?? [input.firstName, input.lastName].filter(Boolean).join(" ")).trim();
  const legacy = splitPatientTitle(full);
  const name = legacy.title ? legacy.name : full;
  const title = storedTitle || legacy.title;
  if (!name) return title;
  return title ? `${title} ${name}`.trim() : name;
}
