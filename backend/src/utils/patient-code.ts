/** Only the verified GP + four-digit year + zero-prefixed five-digit legacy sequence. */
export function displayPatientCode(value: string): string;
export function displayPatientCode(value: undefined): undefined;
export function displayPatientCode(value: string | undefined): string | undefined {
  if (typeof value !== "string") return value;
  return value.replace(/^(GP\d{4})0(\d{4})$/, "$1$2");
}
export function patientCodeAliases(value: string): string[] {
  const canonical=displayPatientCode(value);
  return /^GP\d{8}$/.test(canonical) ? [...new Set([canonical,canonical.slice(0,6)+"0"+canonical.slice(6)])] : [value];
}
export function patientCodePattern(value: string): string {
  const aliases=patientCodeAliases(value);
  const escape=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  return aliases.length>1 ? "^(?:"+aliases.map(escape).join("|")+")$" : escape(value);
}
