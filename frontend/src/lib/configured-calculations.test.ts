import test from "node:test";
import assert from "node:assert/strict";
import { CALCULATION_FORMULAS, recalculateConfigured, type CalculationParameter } from "../../../backend/src/utils/configured-calculations.ts";

const source = (id: string, name: string, unit: string): CalculationParameter => ({parameterId:id,parameterName:name,unit});
const cases: Array<[string, string[], number[], string, number]> = [
 ["pcv",["million/µL","fL"],[4,90],"%",36], ["mcv",["%","million/µL"],[36,4],"fL",90],
 ["mch",["g/dL","million/µL"],[12,4],"pg",30], ["mchc",["g/dL","%"],[12,36],"g/dL",33.33],
 ["rdw",["fL","fL"],[12,90],"%",13.33],
 ...["neutrophil","lymphocyte","eosinophil","monocyte","basophil"].map((kind,index): [string,string[],number[],string,number]=>["absolute-"+kind,["cells/µL","%"],[8000,[60,30,4,5,1][index]],"cells/µL",[4800,2400,320,400,80][index]]),
];
for (const [formulaId, units, inputs, outputUnit, expected] of cases) {
 test(`configured ${formulaId}: correct value, saved dependencies and reload`,()=>{
  const params=[source("a","Custom source A",units[0]),source("b","Custom source B",units[1]),{...source("c","Custom output",outputUnit),calculation:{formulaId,dependencyIds:["a","b"]}}];
  const configured=JSON.parse(JSON.stringify(params));
  const result=recalculateConfigured(configured,{a:inputs[0],b:inputs[1],c:999});
  assert.deepEqual(result.errors,{}); assert.equal(result.values.c,expected); assert.equal(result.values.a,inputs[0]);
 });
}
test("graph recalculates in dependency order, cascades changes and clears stale outputs",()=>{
 const parameters=[source("rbc","RBC","million/µL"),source("mcv","MCV","fL"),source("hb","Hb","g/dL"),
 {...source("mchc","MCHC","g/dL"),calculation:{formulaId:"mchc",dependencyIds:["hb","pcv"]}},
 {...source("pcv","PCV","%"),calculation:{formulaId:"pcv",dependencyIds:["rbc","mcv"]}}];
 const initial={rbc:4,mcv:90,hb:12,pcv:999,mchc:999};
 assert.equal(recalculateConfigured(parameters,initial).values.mchc,33.33);
 assert.equal(recalculateConfigured(parameters,{...initial,rbc:5}).values.pcv,45);
 const cleared=recalculateConfigured(parameters,{...initial,rbc:""});
 assert.equal(cleared.values.pcv,""); assert.equal(cleared.values.mchc,""); assert.equal(initial.pcv,999);
});
test("bidirectional PCV/MCV configuration fails on a cycle without stale results",()=>{
 const params=[source("rbc","RBC","million/µL"),{...source("pcv","PCV","%"),calculation:{formulaId:"pcv",dependencyIds:["rbc","mcv"]}},{...source("mcv","MCV","fL"),calculation:{formulaId:"mcv",dependencyIds:["pcv","rbc"]}}];
 const result=recalculateConfigured(params,{rbc:4,pcv:36,mcv:90}); assert.equal(result.values.pcv,"");assert.equal(result.values.mcv,"");assert.equal(Object.keys(result.errors).length,2);
});
test("missing, ambiguous, narrative and incompatible dependencies fail closed",()=>{
 const target={...source("c","MCV","fL"),calculation:{formulaId:"mcv"}};
 const valid=[source("a","PCV","%"),source("b","RBC count","million/µL"),target];
 assert.equal(recalculateConfigured(valid,{a:36,b:4}).values.c,90);
 for(const params of [valid.slice(1),[...valid,source("duplicate","RBC","million/µL")],valid.map(p=>p.parameterId==="b"?{...p,unit:"cells/µL"}:p),valid.map(p=>p.parameterId==="a"?{...p,itemType:"TEXT_AREA"}:p),valid.map(p=>p.parameterId==="c"?{...p,calculation:{formulaId:"mcv",dependencyIds:["missing","b"]}}:p)]) {
  const result=recalculateConfigured(params,{a:36,b:4,c:123});assert.equal(result.values.c,""); assert.ok(result.errors.c);
 }
});
test("zero, missing, negative, boolean, nonfinite and overflow inputs cannot retain calculated values",()=>{
 const params=[source("a","PCV","%"),source("b","RBC","million/µL"),{...source("c","MCV","fL"),calculation:{formulaId:"mcv",dependencyIds:["a","b"]}}];
 for(const value of [0,"",-1,NaN,Infinity,true,null,undefined]) assert.equal(recalculateConfigured(params,{a:36,b:value,c:123}).values.c,"");
 assert.equal(recalculateConfigured(params,{a:1e308,b:1e-308,c:123}).values.c,"");
 assert.equal(recalculateConfigured(params,{a:0,b:4}).values.c,0);
});
test("absolute counts preserve configured WBC units and reject invalid differential percentages",()=>{
 const params=[source("a","WBC","10^9/L"),source("b","Neutrophils","%"),{...source("c","ANC","10^9/L"),calculation:{formulaId:"absolute-neutrophil",dependencyIds:["a","b"]}}];
 assert.equal(recalculateConfigured(params,{a:8,b:60}).values.c,4.8);
 assert.equal(recalculateConfigured(params,{a:8,b:101,c:999}).values.c,"");
 assert.equal(recalculateConfigured(params.map(p=>p.parameterId==="c"?{...p,unit:"cells/µL"}:p),{a:8,b:60}).values.c,"");
});
test("measured/manual results and narrative content remain unchanged without explicit configuration",()=>{
 const params=[source("hb","Hemoglobin","g/dL"),source("rbc","RBC","million/µL"),source("platelets","Platelet count","cells/µL"),source("mcv","MCV","fL")];
 const entered={hb:12,rbc:4,platelets:250000,mcv:90,narrative:"Synthetic text\nSecond line"};
 assert.deepEqual(recalculateConfigured(params,entered),{values:entered,errors:{}}); assert.equal(CALCULATION_FORMULAS.length,10);
});
