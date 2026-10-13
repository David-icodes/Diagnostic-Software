import test from "node:test";
import assert from "node:assert/strict";
import { recalculateParameterDraft, previewParameterCalculation } from "./calculation-draft.ts";

test("preview preserves downstream and uses the actually accepted ancestor",()=>{
  const graph: CalculationParameter[] = [
    {parameterId:"rbc",parameterName:"RBC",unit:"million/µL"},
    {parameterId:"mcv",parameterName:"MCV",unit:"fL"},
    {parameterId:"hb",parameterName:"Hb",unit:"g/dL"},
    {parameterId:"pcv",parameterName:"PCV",unit:"%",calculation:{formulaId:"pcv",dependencyIds:["rbc","mcv"]}},
    {parameterId:"mchc",parameterName:"MCHC",unit:"g/dL",calculation:{formulaId:"mchc",dependencyIds:["hb","pcv"]}},
  ];
  const values={rbc:5,mcv:90,hb:15,pcv:40,mchc:77};
  assert.deepEqual(previewParameterCalculation(graph,values,"pcv").values,{...values,pcv:45});
  assert.deepEqual(previewParameterCalculation(graph,values,"mchc").values,{...values,mchc:37.5});
});
import type { CalculationParameter } from "./configured-calculations.ts";

const parameters: CalculationParameter[] = [
  {parameterId:"hb",parameterName:"Measured Hb",unit:"g/dL"},
  {parameterId:"rbc",parameterName:"Measured RBC",unit:"million/µL"},
  {parameterId:"mch",parameterName:"Calculated MCH",unit:"pg",calculation:{formulaId:"mch",dependencyIds:["hb","rbc"]}},
  {parameterId:"total",parameterName:"Measured total",unit:"mg/dL"},
  {parameterId:"direct",parameterName:"Measured direct",unit:"mg/dL"},
  {parameterId:"indirect",parameterName:"Unrelated calculated value",unit:"mg/dL",calculation:{formulaId:"indirect-bilirubin",dependencyIds:["total","direct"]}},
  {parameterId:"heading",parameterName:"Heading",itemType:"SUBTITLE"},
  {parameterId:"note",parameterName:"Description",itemType:"TEXT_AREA"},
];

test("Calculate updates the selected target while preserving measured, unrelated saved and content values",()=>{
  const values={hb:"15",rbc:"5",mch:"",total:"9",direct:"3",indirect:"77",note:"Retained description"};
  const computed=recalculateParameterDraft(parameters,values,"mch");
  assert.deepEqual(computed.errors,{});
  assert.deepEqual(computed.values,{...values,mch:30});
  assert.equal(values.mch,"");
});

test("missing, invalid and zero source values prevent calculation without changing unrelated results",()=>{
  for(const rbc of ["","invalid","0"]){
    const computed=recalculateParameterDraft(parameters,{hb:15,rbc,mch:30,indirect:77},"mch");
    assert.ok(computed.errors.mch);
    assert.equal(computed.values.mch,"");
    assert.equal(computed.values.indirect,77);
    assert.equal(computed.values.rbc,rbc);
  }
});

test("source changes cascade only through their configured dependency graph",()=>{
  const computed=recalculateParameterDraft(parameters,{hb:15,rbc:5,mch:22,indirect:77},"hb");
  assert.equal(computed.values.mch,30);
  assert.equal(computed.values.indirect,77);
});

test("calculated ancestors and downstream targets use existing engine dependency order",()=>{
  const graph:CalculationParameter[]=[
    {parameterId:"rbc",parameterName:"RBC",unit:"million/µL"},
    {parameterId:"mcv",parameterName:"MCV",unit:"fL"},
    {parameterId:"hb",parameterName:"Hb",unit:"g/dL"},
    {parameterId:"pcv",parameterName:"PCV",unit:"%",calculation:{formulaId:"pcv",dependencyIds:["rbc","mcv"]}},
    {parameterId:"mchc",parameterName:"MCHC",unit:"g/dL",calculation:{formulaId:"mchc",dependencyIds:["hb","pcv"]}},
  ];
  for(const target of ["pcv","mchc"]){
    const result=recalculateParameterDraft(graph,{rbc:4,mcv:90,hb:12},target);
    assert.deepEqual(result.errors,{});
    assert.equal(result.values.pcv,36);
    assert.equal(result.values.mchc,33.33);
  }
});

test("unconfigured formula-like names remain manual and do not create calculated values",()=>{
  const result=recalculateParameterDraft([{parameterId:"mch",parameterName:"MCH",unit:"pg"}],{mch:""},"mch");
  assert.deepEqual(result.values,{mch:""});
  assert.deepEqual(result.errors,{});
});

test("a source ID reused for two slots fails closed and preserves every original value",()=>{
  const graph:CalculationParameter[]=[
    {parameterId:"hb",parameterName:"Measured Hb",unit:"g/dL"},
    {parameterId:"note",parameterName:"Description",itemType:"TEXT_AREA"},
    {parameterId:"mch",parameterName:"Calculated MCH",unit:"pg",calculation:{formulaId:"mch",dependencyIds:["hb","hb"]}},
  ];
  const original={hb:15,mch:77,note:"Retained description"};
  const result=recalculateParameterDraft(graph,{...original},"mch");
  assert.ok(result.errors.mch);
  assert.equal(result.values.mch,"");
  assert.equal(result.values.hb,15);
  assert.equal(result.values.note,"Retained description");
  assert.deepEqual(original,{hb:15,mch:77,note:"Retained description"});
});
