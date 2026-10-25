import { businessDateInput } from "./business-date";

/**
 * Completed age in years, used where a bill/report needs the numeric age.
 *
 * A valid date of birth is the strongest source because it preserves the
 * completed-year boundary. A positive stored age is the legacy fallback. A
 * zero-only age without a date of birth is deliberately not treated as a real
 * age: older forms silently wrote zero when the operator left the field blank,
 * so that value cannot be distinguished from an omitted age.
 */
export function patientAgeYears(
  patient: { dateOfBirth?: Date | string; age?: number },
  now = new Date(),
): number | undefined {
  const birth = patient.dateOfBirth ? businessDateInput(patient.dateOfBirth) : "";
  const today = businessDateInput(now);
  if (birth && today && birth <= today) {
    const [year, month, day] = birth.split("-").map(Number);
    const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
    const months =
      (todayYear - year) * 12 +
      todayMonth -
      month -
      (todayDay < day ? 1 : 0);
    const years = Math.floor(months / 12);
    if (Number.isInteger(years) && years >= 0 && years <= 150) return years;
    return undefined;
  }

  return typeof patient.age === "number" &&
    Number.isInteger(patient.age) &&
    patient.age > 0 &&
    patient.age <= 150
    ? patient.age
    : undefined;
}

/** True when the patient carries a usable age (DOB or a positive legacy age). */
export function hasRecordedPatientAge(
  patient: { dateOfBirth?: Date | string; age?: number },
  now = new Date(),
): boolean {
  return patientAgeYears(patient, now) !== undefined;
}

/** Completed calendar months, retaining days for newborns; never rounds age. */
export function patientAgeLabel(patient: {dateOfBirth?: Date|string;age?:number}, now=new Date()):string {
 if(patient.dateOfBirth){const birth=businessDateInput(patient.dateOfBirth);const today=businessDateInput(now);if(birth&&today&&birth<=today){const [y,m,d]=birth.split('-').map(Number);const [ty,tm,td]=today.split('-').map(Number);const months=(ty-y)*12+tm-m-(td<d?1:0);if(months>=12){const years=Math.floor(months/12),remaining=months%12;return years+' years'+(remaining?', '+remaining+' months':'');}if(months>0)return months+' months';const days=Math.floor((Date.UTC(ty,tm-1,td)-Date.UTC(y,m-1,d))/86400000);return days+(days===1?' day':' days');}}
 // A legacy zero without a valid DOB cannot distinguish an infant from
 // an omitted age. Do not present that missing information as a measured age.
 return typeof patient.age==='number'&&Number.isFinite(patient.age)&&patient.age>0?patient.age+' years':'Unknown';
}
