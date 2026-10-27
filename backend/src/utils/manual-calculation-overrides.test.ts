import test from 'node:test';import assert from 'node:assert/strict';
import {manualCalculationOverrides} from './manual-calculation-overrides';
test('manual calculator values require explicit entry, a configured target, acceptance and a finite nonnegative number',()=>{
 const configured=new Set(['target']),accepted=new Set(['target']);const entry={parameterId:'target',result:42,manuallyEdited:true,calculationOverride:true};
 assert.deepEqual([...manualCalculationOverrides([entry],configured,accepted,[])],['target']);
 for(const changed of [{...entry,manuallyEdited:false},{...entry,parameterId:'foreign'},{...entry,result:-1},{...entry,result:NaN},{...entry,result:'42'}])assert.throws(()=>manualCalculationOverrides([changed],configured,accepted,[]));
 assert.throws(()=>manualCalculationOverrides([entry],configured,new Set(),[]));
 assert.deepEqual([...manualCalculationOverrides([{...entry,manuallyEdited:false}],configured,accepted,[{parameterId:'target',result:42,calculationSnapshot:{definitionKind:'MANUAL_OVERRIDE'}}])],['target']);
 assert.throws(()=>manualCalculationOverrides([{...entry,manuallyEdited:false}],configured,accepted,[{parameterId:'target',result:42,superseded:true,calculationSnapshot:{definitionKind:'MANUAL_OVERRIDE'}}]));
});
