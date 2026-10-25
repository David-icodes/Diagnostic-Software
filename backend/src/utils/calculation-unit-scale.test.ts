import test from 'node:test';
import assert from 'node:assert/strict';
import {recalculateConfigured} from './configured-calculations';
test('explicit binding normalizes compatible scales and preserves sources and manual fields',()=>{
 const p=[{parameterId:'a',parameterName:'A',unit:'g/L'},{parameterId:'b',parameterName:'B',unit:'g/dL'},{parameterId:'out',parameterName:'G',unit:'g/L',calculation:{formulaId:'globulin',dependencyIds:['a','b'],precision:2}}];
 const r=recalculateConfigured(p,{a:70,b:4,manual:99});
 assert.deepEqual(r.errors,{});assert.equal(r.values.out,30);assert.equal(r.values.a,70);assert.equal(r.values.b,4);assert.equal(r.values.manual,99);
 assert.ok(recalculateConfigured(p,{a:70}).errors.out);
 p[1].unit='mmol/L';assert.ok(recalculateConfigured(p,{a:70,b:4}).errors.out);
});
test('ratio normalizes before dividing, preserves precision and rejects zero',()=>{
 const p=[{parameterId:'a',parameterName:'A',unit:'g/L'},{parameterId:'b',parameterName:'B',unit:'g/dL'},{parameterId:'o',parameterName:'Ratio',unit:'ratio',calculation:{formulaId:'ag-ratio',dependencyIds:['a','b'],precision:3}}];
 assert.equal(recalculateConfigured(p,{a:40,b:3}).values.o,1.333);
 assert.match(recalculateConfigured(p,{a:40,b:0}).errors.o,/zero/);
});
