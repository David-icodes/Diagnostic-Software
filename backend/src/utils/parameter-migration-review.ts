/** Pure preflight only. This module never connects to or writes a database. */
export function reviewNumericMigration(parameter:{id:string;testId:string;resultType:string;unit?:string;itemType?:string}, approved:{id:string;testId:string;unit:string}, historicalValues:unknown[]) {
  const issues:string[]=[];
  if (parameter.id!==approved.id || parameter.testId!==approved.testId) issues.push("Approved record identity does not match");
  if (parameter.itemType && parameter.itemType!=="PARAMETER") issues.push("Narrative items and headings cannot migrate to numeric parameters");
  const nonNumeric=historicalValues.filter(value=>typeof value!=="number" && typeof value!=="string" || typeof value==="string" && !value.trim() || !Number.isFinite(Number(value)));
  if (nonNumeric.length) issues.push(`${nonNumeric.length} historical values are not numeric`);
  if (historicalValues.length) issues.push("Recorded results require a separate parameter; in-place type migration is blocked");
  if (!approved.unit.trim()) issues.push("An approved output unit is required");
  return {allowed:issues.length===0,issues,before:{...parameter},proposed:{resultType:"NUMBER",unit:approved.unit},historicalCount:historicalValues.length,nonNumericCount:nonNumeric.length};
}
