import test from "node:test";
import assert from "node:assert/strict";
import {applyCalculationProposals,type CalculationParameter} from "./configured-calculations.ts";
import {previewParameterCalculation} from "./calculation-draft.ts";
const rows:CalculationParameter[]=[{parameterId:"hb",parameterName:"Hb",unit:"g/dL",resultType:"NUMBER"},{parameterId:"rbc",parameterName:"RBC",unit:"million/ul",resultType:"NUMBER"},{parameterId:"note",parameterName:"Note",itemType:"TEXT_AREA",resultType:"TEXT"},{parameterId:"mch",parameterName:"MCH",unit:"pg",resultType:"NUMBER",calculation:{formulaId:"mch",dependencyIds:["hb","rbc"]}}];
const proposal={parameterId:"mch",formulaId:"mch",dependencyIds:["hb","rbc"],expression:"S1 * 12 / S2"};
test("edited preview changes only the proposed target and leaves input drafts and registry configuration untouched",()=>{
 const original={hb:"15",rbc:"5",mch:"30",note:"manual"};const reviewed=applyCalculationProposals(rows,[proposal]);
 assert.deepEqual(previewParameterCalculation(reviewed,original,"mch").values,{hb:"15",rbc:"5",mch:36,note:"manual"});
 assert.equal(original.mch,"30");assert.equal(rows[3].calculation?.expression,undefined);
});
test("empty, zero and invalid source values disable the proposed preview without modifying manual drafts",()=>{
 for(const rbc of ["","0","-5","invalid"]){const original={hb:"15",rbc,note:"manual"};const preview=previewParameterCalculation(applyCalculationProposals(rows,[proposal]),original,"mch");assert(preview.errors.mch);assert.equal(original.rbc,rbc);assert.equal(preview.values.note,"manual");}
});
test("unconfigured manual and non-result targets cannot become calculation targets through an editor",()=>{
 for(const parameterId of ["hb","note","missing"])assert.throws(()=>applyCalculationProposals(rows,[{...proposal,parameterId}]));
});
