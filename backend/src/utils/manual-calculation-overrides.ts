import {ApiError} from './api-error';
type Entry={parameterId:string;result:unknown;manuallyEdited?:boolean;calculationOverride?:boolean};
/** Explicit, numeric and version-checked by the caller; never a silent formula bypass. */
export function manualCalculationOverrides(entries:Entry[],configured:Set<string>,accepted:Set<string>,saved:Array<{parameterId:unknown;result:unknown;superseded?:boolean;calculationSnapshot?:{definitionKind?:string}}>) {
 const ids=new Set<string>();
 for(const entry of entries.filter(row=>row.calculationOverride)){
  const previous=saved.find(row=>String(row.parameterId)===entry.parameterId&&!row.superseded);
  const retained=previous?.calculationSnapshot?.definitionKind==='MANUAL_OVERRIDE'&&previous.result===entry.result;
  if(!configured.has(entry.parameterId)||!accepted.has(entry.parameterId)||(!entry.manuallyEdited&&!retained)||typeof entry.result!=='number'||!Number.isFinite(entry.result)||entry.result<0)throw new ApiError(422,'A manual calculation override must be explicitly entered as a valid nonnegative number for a current configured parameter');
  ids.add(entry.parameterId);
 }
 return ids;
}
