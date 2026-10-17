import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshLftDependents} from './lft-dependent-values.ts';
const source=(parameterId:string,unit='gms/dl')=>({parameterId,parameterName:parameterId,resultType:'NUMBER',active:true,unit});
const derived=(id:string,formulaId:string,dependencyIds:string[],unit='gms/dl')=>({...source(id,unit),calculationStatus:'DEVELOPMENT',calculation:{formulaId,dependencyIds,enabled:true,overwrite:'CALCULATED' as const,precision:2}});
const parameters=[source('tp'),source('alb'),source('tb','mg/dl'),source('db','mg/dl'),source('ast','IU/L'),derived('glob','globulin',['tp','alb']),derived('ag','ag-ratio',['alb','glob'],'ratio'),derived('ib','indirect-bilirubin',['tb','db'],'mg/dl')];
test('approved LFT chain calculates numeric values and preserves measured and unrelated calculated values',()=>{
 const first=refreshLftDependents(parameters,{alb:'4.2',ast:'25'},'tp','7.2',new Set());
 assert.equal(first.values.glob,'3.00');assert.equal(first.values.ag,'1.40');assert.equal(first.values.ast,'25');assert.equal(first.error,undefined);
 const next=refreshLftDependents(parameters,{...first.values,db:'0.5'},'tb','1.8',new Set(first.calculated));
 assert.equal(next.values.ib,'1.30');assert.ok(next.calculated.includes('glob'));assert.ok(next.calculated.includes('ag'));
});
test('manual LFT values survive edits and missing inputs and zero denominators fail safely',()=>{
 const manual=refreshLftDependents(parameters,{alb:'4.2',glob:'9',ag:'0.47'},'tp','7.2',new Set());assert.equal(manual.values.glob,'9');assert.match(manual.error??'',/manual/);
 for(const value of ['', 'invalid']){const next=refreshLftDependents(parameters,{alb:'4.2',glob:'3.00',ag:'1.40'},'tp',value,new Set(['glob','ag']));assert.equal(next.values.glob,'');assert.equal(next.values.ag,'');assert.ok(next.error);}
 const zero=refreshLftDependents(parameters,{alb:'4.2'},'tp','4.2',new Set());assert.equal(zero.values.ag,'');assert.ok(zero.error);
});
