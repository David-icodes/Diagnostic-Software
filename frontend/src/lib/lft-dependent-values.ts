import {CALCULATION_FORMULAS,recalculateConfigured,type CalculationParameter} from "./configured-calculations.ts";
export const LFT_FORMULA_IDS=new Set(["indirect-bilirubin","globulin","ag-ratio"]);
export function automaticLft(parameter:CalculationParameter){return !!parameter.calculation && parameter.calculation.enabled!==false && LFT_FORMULA_IDS.has(parameter.calculation.formulaId) && parameter.calculation.overwrite==="CALCULATED" && ["APPROVED","DEVELOPMENT"].includes(parameter.calculationStatus??"");}
/** Serial source-value update. Explicit current-test IDs only; never numeric name matching. */
export function refreshLftDependents(parameters:CalculationParameter[],previous:Record<string,string>,sourceId:string,value:string,owned:Set<string>){
 const values={...previous,[sourceId]:value},affected=new Set([sourceId]),targets=new Set<string>();
 let found=true;while(found){found=false;for(const p of parameters)if(automaticLft(p)&&!affected.has(p.parameterId)&&p.calculation!.dependencyIds?.some(id=>affected.has(id))){affected.add(p.parameterId);targets.add(p.parameterId);found=true;}}
 const retained=parameters.filter(p=>automaticLft(p)&&owned.has(p.parameterId)&&p.parameterId!==sourceId&&!targets.has(p.parameterId)).map(p=>p.parameterId);
 const manual=parameters.find(p=>targets.has(p.parameterId)&&String(values[p.parameterId]??"").trim()&&!owned.has(p.parameterId));
 if(manual)return {values,calculated:retained,error:`${manual.parameterName}: preserve the manually entered result. Use Calculate explicitly before automatic updates.`};
 const result=recalculateConfigured(parameters.map(p=>targets.has(p.parameterId)?p:{...p,calculation:undefined}),values);
 const next={...values};for(const id of targets){const p=parameters.find(p=>p.parameterId===id)!,raw=result.values[id];next[id]=typeof raw==='number'?raw.toFixed(p.calculation!.precision??CALCULATION_FORMULAS.find(f=>f.id===p.calculation!.formulaId)?.precision??2):"";}
 return {values:next,calculated:[...retained,...targets],error:Object.values(result.errors)[0]};
}
