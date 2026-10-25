import test from 'node:test';
import assert from 'node:assert/strict';
import {CALCULATION_FORMULAS,recalculateConfigured,roundCalculationValue} from './configured-calculations';
const examples:Record<string,[number[],number]>={
 'pcv-hb-approx':[[12.1],36.3],'indirect-bilirubin':[[1.2,.3],.9],globulin:[[7,4],3],'ag-ratio':[[4,3],1.33],'non-hdl':[[200,50],150],
 'bun-from-urea':[[30],14],'urea-from-bun':[[14],30],eag:[[7],154.2],'anion-gap':[[140,104,24],12],'urine-acr':[[3,100],30],
 'configured-difference':[[100,20],80],'configured-ratio':[[10,4],2.5],pcv:[[5.3,68.49],36.3],mcv:[[36.3,5.3],68.49],mch:[[12.1,5.3],22.83],mchc:[[12.1,36.3],33.33],rdw:[[10,90],11.11],
 'ldl-friedewald':[[200,50,150],120],'ldl-friedewald-mmol':[[5.2,1.3,1.5],3.22],vldl:[[150],30],'vldl-mmol':[[1.5],0.68],
 'chol-hdl-ratio':[[200,50],4],'ldl-hdl-ratio':[[120,50],2.4],'chol-tgl-ratio':[[200,150],1.33],
};
for(const formula of CALCULATION_FORMULAS){
 const [inputs,expected]=examples[formula.id]??(formula.id.startsWith('absolute-')?[[10000,25],2500]:[[],NaN]);
 test('registry execution matrix: '+formula.id,()=>{
  assert.equal(inputs.length,formula.sources.length,'Every registry definition needs an explicit software fixture');
  const units=formula.units.map(unit=>unit==='same'?'g/dl':unit==='count'?'cells/ul':unit);
  const sources=units.map((unit,i)=>({parameterId:'synthetic-source-'+i,parameterName:formula.sources[i],resultType:'NUMBER',active:true,unit}));
  const target={parameterId:'synthetic-target',parameterName:'Synthetic target',resultType:'NUMBER',active:true,unit:formula.outputUnit==='same'?units[0]:formula.outputUnit==='count'?'cells/ul':formula.outputUnit,calculation:{formulaId:formula.id,dependencyIds:sources.map(p=>p.parameterId),sourceVerification:'Synthetic execution fixture only; not clinical approval'}};
  const parameters=[...sources,target];const values=Object.fromEntries(inputs.map((v,i)=>[sources[i].parameterId,v]));
  const good=recalculateConfigured(parameters,values);assert.deepEqual(good.errors,{});assert.equal(good.values[target.parameterId],expected);
  assert.ok(recalculateConfigured(parameters,{}).errors[target.parameterId]);
  assert.ok(recalculateConfigured(parameters,{...values,[sources[0].parameterId]:'not numeric'}).errors[target.parameterId]);
  if(formula.denominator!==undefined)assert.ok(recalculateConfigured(parameters,{...values,[sources[formula.denominator].parameterId]:0}).errors[target.parameterId]);
  const zeros=inputs.map((_,i)=>formula.denominator===i?1:0),zeroValues=Object.fromEntries(zeros.map((v,i)=>[sources[i].parameterId,v]));
  const raw=formula.compute(zeros),zero=recalculateConfigured(parameters,zeroValues);
  if(!formula.allowNegative&&raw<0)assert.ok(zero.errors[target.parameterId]);else{assert.deepEqual(zero.errors,{});assert.equal(zero.values[target.parameterId],roundCalculationValue(raw,formula.precision??2));}
 });
}
