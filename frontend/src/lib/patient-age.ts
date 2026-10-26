/**
 * Patient age display and OSP age validation.
 *
 * Age is a mandatory OSP registration value, but a date of birth is an equally
 * valid source. A zero-only age without a DOB is treated as missing because
 * legacy forms wrote zero when the operator left the field blank.
 */

export interface PatientAgeSource {
  age?: number | null;
  dateOfBirth?: string | Date | null;
}

export interface OspAgeInput {
  dateOfBirth: string;
  ageYears: string;
  ageMonths: string;
  ageDays: string;
}

export const PATIENT_AGE_MIN = 1;
export const PATIENT_AGE_MAX = 150;

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function dateParts(value: string | Date | null | undefined): DateParts | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return {
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
    };
  }
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() + 1 !== month ||
    check.getUTCDate() !== day
  ) {
    return undefined;
  }
  return { year, month, day };
}

function todayParts(now: Date): DateParts {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function compareDate(left: DateParts, right: DateParts): number {
  return left.year - right.year || left.month - right.month || left.day - right.day;
}

/** Completed years derived from a valid DOB, or a positive legacy stored age. */
export function patientAgeYears(
  patient: PatientAgeSource,
  now = new Date(),
): number | undefined {
  const birth = dateParts(patient.dateOfBirth);
  const today = todayParts(now);
  if (birth && compareDate(birth, today) <= 0) {
    const completeMonths =
      (today.year - birth.year) * 12 +
      today.month -
      birth.month -
      (today.day < birth.day ? 1 : 0);
    const years = Math.floor(completeMonths / 12);
    return Number.isInteger(years) && years >= 0 && years <= PATIENT_AGE_MAX
      ? years
      : undefined;
  }

  return typeof patient.age === "number" &&
    Number.isInteger(patient.age) &&
    patient.age >= PATIENT_AGE_MIN &&
    patient.age <= PATIENT_AGE_MAX
    ? patient.age
    : undefined;
}

/** A bill/report age label; empty when the record has no usable age. */
export function patientAgeLabel(patient: PatientAgeSource, now = new Date()): string {
  const years = patientAgeYears(patient, now);
  return years === undefined ? "" : `${years} years`;
}

/**
 * Validates the OSP age controls. A valid DOB satisfies the requirement even
 * for a newborn. Without a DOB, an explicit whole age of 1-150 is required.
 */
export function validateOspAge(input: OspAgeInput, now = new Date()): string | undefined {
  const rawDob = input.dateOfBirth.trim();
  if (rawDob) {
    const birth = dateParts(rawDob);
    if (!birth) return "Enter a valid date of birth (YYYY-MM-DD).";
    if (compareDate(birth, todayParts(now)) > 0) {
      return "Date of birth cannot be in the future.";
    }
    if(patientAgeYears({dateOfBirth:rawDob},now)===undefined)return "Age cannot exceed 150 years.";
    return undefined;
  }

  const rawYears = input.ageYears.trim();
  if (!rawYears) return "Age is required. Enter age in years or a date of birth.";
  if (!/^\d+$/.test(rawYears)) return "Age must be a whole number.";
  const years = Number(rawYears);
  if (years < PATIENT_AGE_MIN || years > PATIENT_AGE_MAX) {
    return "Age must be between 1 and 150 years. For a patient under one year, enter a date of birth.";
  }

  const rawMonths = input.ageMonths.trim();
  if (rawMonths) {
    if (!/^\d+$/.test(rawMonths) || Number(rawMonths) > 11) {
      return "Age months must be between 0 and 11.";
    }
  }
  const rawDays = input.ageDays.trim();
  if (rawDays) {
    if (!/^\d+$/.test(rawDays) || Number(rawDays) > 30) {
      return "Age days must be between 0 and 30.";
    }
  }

  return undefined;
}

export function patientAgeDetailedLabel(patient:PatientAgeSource,now=new Date()):string {
 const years=patientAgeYears(patient,now);if(years===undefined)return "";
 const birth=dateParts(patient.dateOfBirth),today=todayParts(now);if(!birth)return `${years} years`;
 const months=((today.year-birth.year)*12+today.month-birth.month-(today.day<birth.day?1:0))%12;
 return `${years} years, ${months} months`;
}
