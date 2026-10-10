/** India business-calendar dates; stored timestamps remain exact instants. */
export const BUSINESS_TIME_ZONE = "Asia/Kolkata";
export function businessDateInput(value: string | Date = new Date()): string {
 if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value ? value : "";
 }
 const date = new Date(value); if (!Number.isFinite(date.getTime())) return "";
 return new Intl.DateTimeFormat("en-CA", {year:"numeric",month:"2-digit",day:"2-digit",timeZone:BUSINESS_TIME_ZONE}).format(date);
}
export function businessDayStart(value?: string | null): Date | undefined {
 if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return undefined;
 const valid = businessDateInput(value.trim()); return valid ? new Date(valid + "T00:00:00+05:30") : undefined;
}
export function businessDateLabel(value?: string | Date | null): string {
 if (!value) return "—"; const input = businessDateInput(value); if (!input) return "—";
 return new Intl.DateTimeFormat("en-IN", {day:"2-digit",month:"short",year:"numeric",timeZone:BUSINESS_TIME_ZONE}).format(new Date(input + "T00:00:00+05:30"));
}
export function businessTimeInput(value: Date = new Date()): string {
 return new Intl.DateTimeFormat("en-GB", {hour:"2-digit",minute:"2-digit",hourCycle:"h23",timeZone:BUSINESS_TIME_ZONE}).format(value);
}
