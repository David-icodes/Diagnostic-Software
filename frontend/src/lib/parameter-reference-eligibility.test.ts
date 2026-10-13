import test from 'node:test';
import assert from 'node:assert/strict';
import {usesClinicalReference} from './parameter-reference-eligibility.ts';
test('subtitle, explicit text area and legacy textarea never receive numeric reference controls',()=>{
 for(const parameter of [{itemType:'SUBTITLE',resultType:'TEXT'},{itemType:'TEXT_AREA',resultType:'TEXTAREA'},{itemType:'PARAMETER',resultType:'TEXTAREA'}])assert.equal(usesClinicalReference(parameter),false);
});
test('manual legacy text laboratory values and ordinary numeric parameters retain reference matching',()=>{
 for(const resultType of ['TEXT','NUMBER','RANGE','BOOLEAN','SELECT'])assert.equal(usesClinicalReference({itemType:'PARAMETER',resultType}),true);
});
