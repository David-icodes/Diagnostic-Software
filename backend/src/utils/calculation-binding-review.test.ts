import test from "node:test";
import assert from "node:assert/strict";
import { calculationBindingChanged, reviewCalculationBinding } from "./configured-calculations";

const sources = [{id:"hb",resultType:"NUMBER",unit:"g/dL"},{id:"rbc",resultType:"NUMBER",unit:"million/µL"}];
const target = {id:"mch",resultType:"NUMBER",unit:"pg",calculation:{formulaId:"mch",dependencyIds:["hb","rbc"],precision:2}};
test("review accepts explicit numeric MCH sources and compatible units",()=>assert.deepEqual(reviewCalculationBinding(sources,target),[]));
test("review refuses missing, legacy text and cross-test source IDs",()=>{
  assert.match(reviewCalculationBinding([],target).join(),/numeric/);
  assert.match(reviewCalculationBinding([{...sources[0],resultType:"TEXT"},sources[1]],target).join(),/numeric/);
  assert.match(reviewCalculationBinding(sources,{...target,calculation:{formulaId:"mch"}}).join(),/explicitly/);
});
test("review refuses incompatible units, self references and PCV-MCV cycles",()=>{
  assert.match(reviewCalculationBinding(sources,{...target,unit:"%"}).join(),/units/);
  assert.match(reviewCalculationBinding(sources,{...target,calculation:{formulaId:"mch",dependencyIds:["mch","rbc"]}}).join(),/itself/);
  const pcv={id:"pcv",unit:"%",resultType:"NUMBER",calculation:{formulaId:"pcv",dependencyIds:["rbc","mcv"]}};
  const mcv={id:"mcv",unit:"fL",resultType:"NUMBER",calculation:{formulaId:"mcv",dependencyIds:["pcv","rbc"]}};
  assert.match(reviewCalculationBinding([...sources,pcv,mcv],pcv).join(),/Circular/);
});
test("approval comparison is idempotent but detects changed units, sources or precision",()=>{
  assert.equal(calculationBindingChanged(target.calculation,{...target.calculation,precision:undefined},"pg","PG"),false);
  assert.equal(calculationBindingChanged(target.calculation,null,"pg"),true);
  assert.equal(calculationBindingChanged({...target.calculation,precision:3},target.calculation,"pg","pg"),true);
  assert.equal(calculationBindingChanged(target.calculation,target.calculation,"%","pg"),true);
  assert.equal(calculationBindingChanged(null,target.calculation),false);
});
