import test from "node:test";
import assert from "node:assert/strict";
import {evaluateFormulaExpression,evaluateProposedExpression,applyCalculationProposals,recalculateConfigured,type CalculationParameter} from "./configured-calculations";
const parameters:CalculationParameter[]=[
 {parameterId:"hb",parameterName:"Hb",unit:"g/dL",resultType:"NUMBER"},
 {parameterId:"rbc",parameterName:"RBC",unit:"million/ul",resultType:"NUMBER"},
 {parameterId:"other",parameterName:"Other",unit:"g/dL",resultType:"NUMBER"},
 {parameterId:"mch",parameterName:"MCH",unit:"pg",resultType:"NUMBER",calculation:{formulaId:"mch",dependencyIds:["hb","rbc"],overwrite:"CONFIRM"}},
];
test("editable arithmetic preserves CBC results and half-up rounding",()=>{
 assert.equal(evaluateProposedExpression("(S1 × 10) ÷ S2","S1 * 10 / S2",[15,5],["g/dl","million/ul"]),30);
 const proposed=applyCalculationProposals(parameters,[{parameterId:"mch",formulaId:"mch",dependencyIds:["hb","rbc"],expression:"S1 * 10.001 / S2"}]);
 assert.deepEqual(recalculateConfigured(proposed,{hb:15,rbc:5,other:7}).values,{hb:15,rbc:5,other:7,mch:30});
 assert.equal(parameters[3].calculation?.expression,undefined,"shared default unchanged");
});
test("syntax, arbitrary code, missing variables, zero and incompatible dimensions fail safely",()=>{
 for(const expression of ["eval(S1)","S1.constructor", "S1 ** S2", "S1 * (S2", "S3", "S1", "S1 / (S2 - S2)", "S1 + S2"]){assert.throws(()=>evaluateProposedExpression(expression,"S1 / S2",[15,5],["g/dl","million/ul"]));}
 assert.throws(()=>evaluateFormulaExpression("(".repeat(20)+"S1"+")".repeat(20),[1]));
 assert.throws(()=>evaluateProposedExpression("S1 * S2","S1 / S2",[15,5],["g/dl","million/ul"]));
});
test("source IDs, numeric eligibility, units, unknown targets and cycles are reviewed explicitly",()=>{
 const proposal={parameterId:"mch",formulaId:"mch",dependencyIds:["hb","rbc"],expression:"S1 * 10 / S2"};
 for(const dependencyIds of [["missing","rbc"],["hb","hb"],["mch","rbc"],["rbc","hb"]])assert.throws(()=>applyCalculationProposals(parameters,[{...proposal,dependencyIds}]));
 assert.throws(()=>applyCalculationProposals(parameters,[{...proposal,parameterId:"missing"}]));
 assert.throws(()=>applyCalculationProposals(parameters.map(p=>p.parameterId==="hb"?{...p,itemType:"SUBTITLE"}:p),[proposal]));
 assert.throws(()=>applyCalculationProposals(parameters.map(p=>p.parameterId==="hb"?{...p,calculation:{formulaId:"configured-ratio",dependencyIds:["mch","other"]}}:p),[proposal]));
});
