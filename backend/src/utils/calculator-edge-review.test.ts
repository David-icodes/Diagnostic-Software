import test from "node:test";
import assert from "node:assert/strict";
import { reviewCalculationBinding, recalculateConfigured, normalizeCalculationUnit, type CalculationParameter } from "./configured-calculations";

const sources = [{id:"hb",resultType:"NUMBER",unit:"g/dL"},{id:"rbc",resultType:"NUMBER",unit:"million/µL"}];
const target = {id:"mch",resultType:"NUMBER",unit:"pg",calculation:{formulaId:"mch",dependencyIds:["hb","rbc"]}};
const parameters: CalculationParameter[] = sources.map(p=>({parameterId:p.id,parameterName:p.id,unit:p.unit}));
parameters.push({parameterId:"mch",parameterName:"MCH",unit:"pg",calculation:target.calculation});

test("binding review permits active PARAMETER sources and refuses inactive, subtitle and narrative items",()=>{
 for(const resultType of ["NUMBER","RANGE","TEXT"]) assert.deepEqual(reviewCalculationBinding(sources.map(p=>({...p,resultType})),target),[]);
 for(const patch of [{active:false},{itemType:"SUBTITLE"},{itemType:"TEXT_AREA"}])
  assert.match(reviewCalculationBinding([{...sources[0],...patch},sources[1]],target).join(),/active parameters/);
});
test("supported spelling aliases preserve magnitude; CBP legacy labels do not change numeric execution",()=>{
 for(const unit of ["million/µL","millions/ul","million/cumm","10^6/ul"]) {
  assert.equal(normalizeCalculationUnit(unit),"million/ul");
  assert.deepEqual(reviewCalculationBinding([sources[0],{...sources[1],unit}],target),[]);
 }
 for(const [index,unit] of [[0,"Grams %"],[0,"gm/dL"],[1,"mill/cumm"]] as const) {
  assert.deepEqual(reviewCalculationBinding(sources.map((p,i)=>i===index?{...p,unit}:p),target),[]);
 }
});
test("CBP display units never trigger conversion or mutate numeric source values",()=>{
 const p=parameters.map(row=>row.parameterId==="rbc"?{...row,unit:"10^9/L"}:row);
 const original={hb:15,rbc:5,mch:77};const result=recalculateConfigured(p,original);
 assert.deepEqual(result.errors,{});assert.equal(result.values.mch,30);assert.deepEqual(original,{hb:15,rbc:5,mch:77});
 assert.equal(result.values.rbc,5);
});
test("explicit missing source IDs never fall back to matching display names",()=>{
 const p=parameters.map(row=>row.parameterId==="mch"?{...row,calculation:{formulaId:"mch",dependencyIds:["missing","rbc"]}}:row);
 p[0].parameterName="Haemoglobin";
 assert.match(recalculateConfigured(p,{hb:15,rbc:5,mch:77}).errors.mch,/missing or ambiguous/);
 for(const dependencyIds of [[],["hb"],["","rbc"]]) assert.match(reviewCalculationBinding(sources,{...target,calculation:{formulaId:"mch",dependencyIds}}).join(),/explicitly/);
});
test("ambiguous name-only configuration fails and is never accepted by binding review",()=>{
 const p=[...parameters.map(row=>row.parameterId==="mch"?{...row,calculation:{formulaId:"mch"}}:row),{parameterId:"alternative",parameterName:"RBC",unit:"million/µL"}];
 p[0].parameterName="Hb";p[1].parameterName="RBC";
 assert.match(recalculateConfigured(p,{hb:15,rbc:5,alternative:6}).errors.mch,/ambiguous/);
 assert.match(reviewCalculationBinding(sources,{...target,calculation:{formulaId:"mch"}}).join(),/explicitly/);
});
test("zero denominators and invalid numeric representations fail; zero numerator is valid",()=>{
 for(const rbc of [0,"0","   ",false,null,"NaN","Infinity","5 pg",-5]) {
  const result=recalculateConfigured(parameters,{hb:15,rbc,mch:77});assert.ok(result.errors.mch);assert.equal(result.values.mch,"");assert.equal(result.values.rbc,rbc);
 }
 assert.equal(recalculateConfigured(parameters,{hb:0,rbc:5}).values.mch,0);
});
test("cycle errors propagate without mutating the original saved results",()=>{
 const graph:CalculationParameter[]=[{parameterId:"rbc",parameterName:"RBC",unit:"million/µL"},{parameterId:"pcv",parameterName:"PCV",unit:"%",calculation:{formulaId:"pcv",dependencyIds:["rbc","mcv"]}},{parameterId:"mcv",parameterName:"MCV",unit:"fL",calculation:{formulaId:"mcv",dependencyIds:["pcv","rbc"]}}];
 const saved={rbc:5,pcv:40,mcv:80};const result=recalculateConfigured(graph,saved);
 assert.equal(Object.keys(result.errors).length,2);assert.equal(result.values.pcv,"");assert.equal(result.values.mcv,"");assert.deepEqual(saved,{rbc:5,pcv:40,mcv:80});
});
test("precision zero through four rounds recurring values without modifying measured inputs",()=>{
 for(const [precision,expected] of [[0,33],[1,33.3],[2,33.33],[3,33.333],[4,33.3333]]) {
  const p=parameters.map(row=>row.parameterId==="mch"?{...row,calculation:{...target.calculation,precision}}:row);
  const result=recalculateConfigured(p,{hb:10,rbc:3});assert.equal(result.values.mch,expected);assert.equal(result.values.hb,10);assert.equal(result.values.rbc,3);
 }
});
test("a source ID reused for two slots is rejected by review and never executes",()=>{
 const reused={formulaId:"mch",dependencyIds:["hb","hb"]};
 assert.match(reviewCalculationBinding(sources,{...target,calculation:reused}).join(),/exactly once/);
 const p=parameters.map(row=>row.parameterId==="mch"?{...row,calculation:reused}:row);
 const original={hb:15,rbc:5,mch:77};const result=recalculateConfigured(p,original);
 assert.ok(result.errors.mch);assert.equal(result.values.mch,"");assert.deepEqual(original,{hb:15,rbc:5,mch:77});assert.equal(result.values.hb,15);assert.equal(result.values.rbc,5);
});
