import test from "node:test";
import assert from "node:assert/strict";
import { resolveTestCalculations, recalculateConfigured, calculationBindingChanged, calculatorControlState, type CalculationParameter } from "./configured-calculations";
const rows: CalculationParameter[] = [
  {parameterId:"hb",parameterName:"Hb",resultType:"NUMBER",unit:"g/dL"},
  {parameterId:"rbc",parameterName:"RBC",resultType:"NUMBER",unit:"million/ul"},
  {parameterId:"mch",parameterName:"MCH",resultType:"NUMBER",unit:"pg",calculation:{formulaId:"mch",dependencyIds:["hb","rbc"],enabled:false}},
];
test("explicit disabled status blocks registry fallback and preserves existing manual value",()=>{
  assert.equal(resolveTestCalculations(rows).has("mch"),false);
  assert.equal(calculatorControlState(rows[2]).status,"ineligible");
  assert.equal(recalculateConfigured(rows,{hb:15,rbc:5,mch:29}).values.mch,29);
});
test("enabled explicit binding uses its expression and detects expression/status revisions",()=>{
  const binding={...rows[2].calculation!,enabled:true,expression:"S1 * 10 / S2"};
  const configured=rows.map(row=>row.parameterId==="mch"?{...row,calculation:binding}:row);
  assert.equal(recalculateConfigured(configured,{hb:15,rbc:5}).values.mch,30);
  assert.equal(calculationBindingChanged(binding,rows[2].calculation,"pg","pg"),true);
  assert.equal(calculationBindingChanged({...binding,expression:"S1 * 12 / S2"},binding,"pg","pg"),true);
});
