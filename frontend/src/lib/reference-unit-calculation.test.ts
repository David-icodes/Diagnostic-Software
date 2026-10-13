import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateImmediately} from './immediate-calculation.ts';
test('numeric calculator output is independent of changed unit display metadata',()=>{
 for(const unit of ['', 'SYN-U4','Grams %']){
 const rows=[{parameterId:'h',parameterName:'Synthetic Hb',resultType:'NUMBER' as const,unit},{parameterId:'r',parameterName:'Synthetic RBC',resultType:'NUMBER' as const,unit},{parameterId:'m',parameterName:'Synthetic MCH',resultType:'NUMBER' as const,unit,calculationStatus:'DEVELOPMENT' as const,calculation:{formulaId:'mch' as const,dependencyIds:['h','r'],precision:2}}];
 const result=calculateImmediately(rows,{h:'12.1',r:'5.3',untouched:'77'},'m');assert.equal(result.error,undefined);assert.equal(result.values.m,22.83);assert.equal(result.values.untouched,'77');assert.deepEqual(result.changed,['m']);
 }
});
