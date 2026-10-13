import { businessDateInput } from "./business-date";
/** Completed calendar months, retaining days for newborns; never rounds age. */
export function patientAgeLabel(patient: {dateOfBirth?: Date|string;age?:number}, now=new Date()):string {
 if(patient.dateOfBirth){const birth=businessDateInput(patient.dateOfBirth);const today=businessDateInput(now);if(birth&&today&&birth<=today){const [y,m,d]=birth.split('-').map(Number);const [ty,tm,td]=today.split('-').map(Number);const months=(ty-y)*12+tm-m-(td<d?1:0);if(months>=12){const years=Math.floor(months/12),remaining=months%12;return years+' years'+(remaining?', '+remaining+' months':'');}if(months>0)return months+' months';const days=Math.floor((Date.UTC(ty,tm-1,td)-Date.UTC(y,m-1,d))/86400000);return days+(days===1?' day':' days');}}
 // A legacy zero without a valid DOB cannot distinguish an infant from
 // an omitted age. Do not present that missing information as a measured age.
 return typeof patient.age==='number'&&Number.isFinite(patient.age)&&patient.age>0?patient.age+' years':'Unknown';
}
