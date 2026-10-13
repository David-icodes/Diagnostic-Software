import test from 'node:test';
import assert from 'node:assert/strict';
import {recalculateConfigured,formulaApproval,CALCULATION_FORMULAS,type CalculationParameter} from './configured-calculations';
const parameters:CalculationParameter[]=[
 {parameterId:'hb',parameterName:'Synthetic Hb',unit:'g/dL'},
 {parameterId:'rbc',parameterName:'Synthetic RBC',unit:'million/µL'},
 ...[['pcv','%','pcv-hb-approx',['hb'],1],['mch','pg','mch',['hb','rbc'],2],['mcv','fL','mcv',['pcv','rbc'],2],['mchc','g/dL','mchc',['hb','pcv'],2]].map(([parameterId,unit,formulaId,dependencyIds,precision])=>({parameterId,parameterName:'Synthetic '+parameterId,unit,calculation:{formulaId,dependencyIds,precision,overwrite:'CONFIRM',sourceVerification:'Explicit synthetic Hb-based approximation'}} as CalculationParameter))
];
test('requested synthetic chain produces 36.3%, 22.83 pg, 68.49 fL and 33.33 g/dL',()=>{const r=recalculateConfigured(parameters,{hb:12.1,rbc:5.3,unrelated:77});assert.deepEqual(r.errors,{});assert.deepEqual([r.values.pcv,r.values.mch,r.values.mcv,r.values.mchc],[36.3,22.83,68.49,33.33]);assert.equal(r.values.unrelated,77);});
test('missing or nonnumeric sources and zero denominators fail closed',()=>{for(const input of [{rbc:5.3},{hb:12.1},{hb:'abc',rbc:5.3},{hb:12.1,rbc:0}]){const r=recalculateConfigured(parameters,input);assert.ok(Object.keys(r.errors).length);assert.equal(r.values.mch,'');}const r=recalculateConfigured(parameters,{hb:0,rbc:5.3});assert.match(r.errors.mchc,/zero/);});
test('approximation never auto-approves name-matched parameters',()=>{assert.equal(formulaApproval('pcv-hb-approx'),'BLOCKED');assert.deepEqual(CALCULATION_FORMULAS.find(f=>f.id==='pcv-hb-approx')!.targets,[]);});
test('disabled, missing-source and missing-config targets preserve unrelated entered values',()=>{const p=structuredClone(parameters);p[2].calculation!.enabled=false;assert.equal(recalculateConfigured(p,{hb:12.1,rbc:5.3,pcv:44}).values.pcv,44);p[2].calculation!.enabled=true;p[2].calculation!.dependencyIds=['unknown'];assert.ok(recalculateConfigured(p,{hb:12.1,rbc:5.3}).errors.pcv);p[2].calculation=null;assert.equal(recalculateConfigured(p,{pcv:36.3,hb:12.1,rbc:5.3}).values.pcv,36.3);});

test('CBP arithmetic ignores blank, legacy and incompatible display units',()=>{
 for(const unit of ['', 'Grams %', 'mill/cumm', 'Vol %', 'unrelated label']) {
  const p=structuredClone(parameters).map(row=>({...row,unit}));
  for(const row of p) if(row.calculation) row.calculation.expression=CALCULATION_FORMULAS.find(f=>f.id===row.calculation!.formulaId)!.expression;
  const r=recalculateConfigured(p,{hb:12.1,rbc:5.3,manual:77});
  assert.deepEqual(r.errors,{});assert.deepEqual([r.values.pcv,r.values.mch,r.values.mcv,r.values.mchc],[36.3,22.83,68.49,33.33]);assert.equal(r.values.manual,77);
 }
});
