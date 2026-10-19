import { businessDateInput } from './business-date.ts';

export function parseOspDob(input: string, now = new Date()): {date: string; error?: string} {
  if (!input) return {date: ''};
  input = compactOspDob(input);
  if (!/^\d{8}$/.test(input)) return {date: '', error: 'Enter all eight digits in DDMMYYYY order.'};
  const date = `${input.slice(4)}-${input.slice(2,4)}-${input.slice(0,2)}`;
  if (Number(input.slice(4)) < 1 || !businessDateInput(date)) return {date: '', error: 'Enter a valid calendar date.'};
  if (date > businessDateInput(now)) return {date: '', error: 'Date of birth cannot be in the future.'};
  return {date};
}
export function compactOspDob(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.slice(8,10)+value.slice(5,7)+value.slice(0,4) : value;
}
export function ospBirthAge(value: string | Date, now = new Date()) {
  const birth = businessDateInput(value), today = businessDateInput(now);
  if (!birth || birth > today) return {years:0, months:0, days:0};
  const [y,m,d]=birth.split('-').map(Number),[ty,tm,td]=today.split('-').map(Number);
  const completeMonths=(ty-y)*12+tm-m-(td<d?1:0);
  const previousMonthDays=new Date(Date.UTC(ty,tm-1,0)).getUTCDate();
  return {years:Math.floor(completeMonths/12),months:completeMonths%12,days:td>=d?td-d:Math.max(0,td+previousMonthDays-d)};
}
