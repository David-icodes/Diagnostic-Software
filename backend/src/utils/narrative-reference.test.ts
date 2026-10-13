import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveReferenceRange,evaluateValue} from './reference-resolver';
test('headings and narrative fields skip numeric matching even when stale range metadata exists',()=>{
 for(const type of [{itemType:'SUBTITLE',resultType:'TEXT'},{itemType:'TEXT_AREA',resultType:'TEXTAREA'},{itemType:'PARAMETER',resultType:'TEXTAREA'}]){const resolution=resolveReferenceRange({...type,referenceRange:'1-2'},{gender:'female',age:30});assert.equal(resolution.status,'MATCHED');assert.equal(resolution.source,'NONE');assert.equal(resolution.displayValue,'');assert.equal(evaluateValue('9',resolution),'NOT_COMPARABLE');}
});
test('unresolved haemoglobin age boundaries retain warning rather than invent adult applicability',()=>{const resolution=resolveReferenceRange({itemType:'PARAMETER',resultType:'TEXT',referenceRange:'Male :13-17Grams %\nFemale :12-15Grams %\nChild :11.0-15.5Grams %'},{gender:'female',age:30});assert.equal(resolution.status,'NO_MAPPING_FOR_PATIENT');assert.equal(resolution.displayValue,'');});
