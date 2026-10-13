import {calculatorControlState, recalculateConfigured, type CalculationParameter, type CalculationValues} from './configured-calculations.ts';

/** Explicit user Calculate action; no submission and no name-based configuration. */
export function calculateImmediately(parameters:CalculationParameter[], values:CalculationValues, targetId:string) {
 const target=parameters.find(p=>p.parameterId===targetId);
 if(!target || target.calculationStatus==='BLOCKED' || calculatorControlState(target).status!=='configured') return {values:{...values},changed:[] as string[],error:'No valid enabled configuration for this parameter.'};
 const affected=new Set([targetId]);
 for(const p of parameters)if(affected.has(p.parameterId)){
  if(!p.calculation?.dependencyIds?.length)return {values:{...values},changed:[] as string[],error:`${p.parameterName}: exact source IDs are not configured.`};
  for(const id of p.calculation.dependencyIds){const source=parameters.find(s=>s.parameterId===id);if(!source)return {values:{...values},changed:[] as string[],error:`${p.parameterName}: configured source ${id} is missing.`};if(!affected.has(id)&&(!String(values[id]??'').trim()||!Number.isFinite(Number(values[id]))))return {values:{...values},changed:[] as string[],error:`Enter a valid numeric result for ${source.parameterName}.`};}
 }
 for(const p of parameters) if(affected.has(p.parameterId)&&p.calculation?.overwrite==='NEVER'&&String(values[p.parameterId]??'').trim()) return {values:{...values},changed:[] as string[],error:`${p.parameterName}: configuration prevents replacing an existing result.`};
 const result=recalculateConfigured(parameters.map(p=>affected.has(p.parameterId)?p:{...p,calculation:undefined}),values);
 const error=Object.values(result.errors)[0];
 if(error)return {values:{...values},changed:[] as string[],error};
 return {values:result.values,changed:[...affected],error:undefined};
}
