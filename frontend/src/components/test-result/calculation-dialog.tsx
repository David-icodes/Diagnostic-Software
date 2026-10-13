"use client";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CALCULATION_FORMULAS, resolveCalculationDependencyIds, overwriteDecision, type CalculationParameter, type CalculationValues } from "@/lib/configured-calculations";
import { applyCalculationProposals, type CalculationProposal } from "@/lib/calculation-proposal";
import { previewParameterCalculation } from "@/lib/calculation-draft";

export function CalculationDialog({target,parameters,values,testName,onApply,onClose,editingAllowed=false,proposal}:{target:CalculationParameter;parameters:CalculationParameter[];values:CalculationValues;testName:string;editingAllowed?:boolean;proposal?:CalculationProposal;onApply:(values:CalculationValues,proposal?:CalculationProposal)=>void;onClose:()=>void}) {
  const formula=CALCULATION_FORMULAS.find(row=>row.id===target.calculation?.formulaId);
  const defaultIds=resolveCalculationDependencyIds(parameters,target);
  const [ids,setIds]=useState(proposal?.dependencyIds??defaultIds);
  const [expression,setExpression]=useState(proposal?.expression??target.calculation?.expression??formula?.expression??"");
  const [blocked,setBlocked]=useState<string|null>(null);
  const changed=expression!==formula?.expression||JSON.stringify(ids)!==JSON.stringify(defaultIds);
  const editable=editingAllowed&&!!formula?.expression;
  const previewExpression=expression||(formula?.id==="mcv"?"S1 * 10 / S2":"");
  const substituted=previewExpression.replace(/\bS([1-9]\d*)\b/g,(_token,index)=>String(values[ids[Number(index)-1]]??"missing"));
  const proposed:CalculationProposal={parameterId:target.parameterId,formulaId:formula?.id??"",dependencyIds:ids,expression};
  let error:string|undefined,result:CalculationValues[string];
  try {
    const reviewed=editable?applyCalculationProposals(parameters,[proposed]):parameters;
    const missing=ids.map(id=>parameters.find(p=>p.parameterId===id)).filter(source=>source&&String(values[source.parameterId]??"").trim()==="");
    if(missing.length)throw new Error("Enter required inputs: "+missing.map(source=>source!.parameterName).join(", ")+".");
    const computed=previewParameterCalculation(reviewed,values,target.parameterId);
    error=computed.errors[target.parameterId];result=computed.values[target.parameterId];
  }catch(failure){error=failure instanceof Error?failure.message:"Invalid calculation.";}
  const apply=()=>{
    if(error||result===""||result===undefined)return;
    const before=String(values[target.parameterId]??"");
    const decision=overwriteDecision(target.calculation?.overwrite,before.trim()!==""&&before!==String(result));
    if(decision==="BLOCK"){setBlocked("The approved policy keeps the existing value. This calculation cannot replace it.");return;}
    if(decision==="CONFIRM"&&!window.confirm("Replace the existing target value in this draft? Nothing is saved until Submit."))return;
    onApply({...values,[target.parameterId]:result},editable&&changed?proposed:undefined);onClose();
  };
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}} title={target.parameterName+" Calculator"} description={testName} size="md">
    <div className="space-y-3">
      <p className="text-sm font-medium">Formula: {formula?.label}</p>
      {target.calculationStatus==="DEVELOPMENT"&&<p className="text-sm text-amber-800">Synthetic development calculation — not clinically approved</p>}
      {formula?.method&&<p className="text-xs text-amber-800">{formula.method}</p>}
      <p className="text-xs text-muted-foreground">ID {formula?.id} · Version {formula?.version??"1"} · {target.calculation?.precision??formula?.precision??2} decimal places · Half up</p>
      {ids.map((id,index)=>{const source=parameters.find(row=>row.parameterId===id);return <div key={index} className="grid grid-cols-[1fr_120px] gap-2 text-sm">
        <label>Source S{index+1}<select aria-label={"Source S"+(index+1)} value={id} disabled={!editable} onChange={event=>{setIds(current=>current.map((value,slot)=>slot===index?event.target.value:value));setBlocked(null);}} className="block h-8 w-full rounded border bg-white px-2">
          {parameters.map(parameter=><option key={parameter.parameterId} value={parameter.parameterId} disabled={parameter.parameterId===target.parameterId||parameter.active===false||!["NUMBER","RANGE"].includes(parameter.resultType??"")||(!!parameter.itemType&&parameter.itemType!=="PARAMETER")}>{parameter.parameterName} ({parameter.unit??"unit required"})</option>)}
        </select></label>
        <label>Current value<Input aria-label={source?.parameterName??"Source value"} className="h-8" value={String(values[id]??"")} readOnly /><span className="text-xs text-muted-foreground">{source?.unit}</span></label>
      </div>;})}
      {formula?.expression&&<label className="block text-sm">Expression<Input aria-label="Formula expression" value={expression} readOnly={!editable} onChange={event=>{setExpression(event.target.value);setBlocked(null);}} className="h-8" /></label>}
      {previewExpression&&<p className="text-sm" aria-label="Substituted calculation">Substitution: {substituted}</p>}
      {editable&&<div className="flex gap-1" aria-label="Formula operators">{["+","−","×","÷","(",")"].map(operator=><Button key={operator} variant="outline" className="h-8 min-w-8 px-2" onClick={()=>setExpression(current=>current+" "+operator+" ")}>{operator}</Button>)}</div>}
      {changed&&editable&&<p className="text-xs text-amber-800">Proposed one-time development formula. No clinical approval or shared configuration changes.</p>}
      {error?<p role="alert" className="text-sm text-destructive">{error}</p>:<div className="rounded bg-slate-50 p-3"><p className="text-sm">Calculated {target.parameterName}</p><output className="text-2xl font-bold">{Number(result).toFixed(target.calculation?.precision??formula?.precision??2)}</output><span className="ml-2 text-sm" aria-label="Display unit">{target.unit}</span></div>}
      {blocked&&<p role="alert" className="text-sm text-destructive">{blocked}</p>}
      <p className="text-xs text-muted-foreground">Preview only. Apply changes this target in the draft; Submit saves it. Source results stay unchanged.</p>
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={apply} disabled={!!error||!ids.length}>Apply Result</Button></div>
    </div>
  </Dialog>;
}
