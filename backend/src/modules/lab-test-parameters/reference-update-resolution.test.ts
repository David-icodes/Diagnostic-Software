import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveReferenceRange,evaluateValue} from '../../utils/reference-resolver';
import {composeReferenceRange} from './lab-test-parameter.service';
import {recordedParameterProjection} from '../../utils/parameter-version-routing';

test('updated explicit numeric display is the same interval used for abnormal comparisons',()=>{
 const referenceRange=composeReferenceRange({referenceType:'GENERAL',rangeFrom:30,rangeTo:40,rangeText:'30 - 40'});
 const reference=resolveReferenceRange({referenceRange},{gender:'female',age:30});
 assert.equal(reference.displayValue,'30 - 40');assert.equal(evaluateValue('25',reference),'OUT_OF_RANGE');assert.equal(evaluateValue('35',reference),'IN_RANGE');
});
test('units do not affect reference applicability or interval comparison',()=>{
 const parameter={referenceRange:'30 - 40',unit:'Synthetic arbitrary metadata'};
 const withUnit=resolveReferenceRange(parameter,{gender:'female',age:30});
 const blankUnit={...parameter,unit:''};const withoutUnit=resolveReferenceRange(blankUnit,{gender:'female',age:30});assert.deepEqual(withUnit,withoutUnit);
});
test('updated age/sex mapping applies to matching context and missing applicability stays explicit',()=>{
 const parameter={referenceRange:'40 - 50',mappingTypes:['AGE_SEX_WISE' as const],referenceMappings:[{mappingType:'AGE_SEX_WISE' as const,valueType:'NUMERIC' as const,sex:'FEMALE' as const,ageUnit:'YEAR' as const,ageFrom:20,ageTo:40,valueFrom:3,valueTo:5,active:true}]};
 const match=resolveReferenceRange(parameter,{gender:'female',age:30});assert.equal(match.displayValue,'3 - 5');assert.equal(evaluateValue('6',match),'OUT_OF_RANGE');
 const missing=resolveReferenceRange(parameter,{gender:'male',age:30});assert.equal(missing.status,'NO_MAPPING_FOR_PATIENT');assert.equal(missing.displayValue,'');
});
test('configured generic-only default applies while declared specific requirements prohibit fallback',()=>{
 const generic={mappingType:'GENERIC' as const,valueType:'NUMERIC' as const,valueFrom:1,valueTo:2};
 assert.equal(resolveReferenceRange({mappingTypes:['GENERIC'],referenceMappings:[generic]},{age:30}).displayValue,'1 - 2');
 assert.equal(resolveReferenceRange({mappingTypes:['SEX_WISE','GENERIC'],referenceMappings:[generic]},{gender:'female',age:30}).status,'NO_MAPPING_FOR_PATIENT');
});
test('saved historical unit and range remain pinned to their own snapshot',()=>{
 const master={unit:'new',referenceRange:'30 - 40',parameterName:'Synthetic',resultType:'NUMBER'};
 const saved={...master,unit:'old',referenceRange:'10 - 20'};
 const projected=recordedParameterProjection(master,saved);assert.equal(projected.unit,'old');assert.equal(projected.referenceRange,'10 - 20');assert.equal(master.unit,'new');
});
test('month-based ranges use total completed months, not the month remainder of age',()=>{
 const reference=resolveReferenceRange({mappingTypes:['AGE_SEX_WISE'],referenceMappings:[{mappingType:'AGE_SEX_WISE',valueType:'NUMERIC',sex:'FEMALE',ageUnit:'MONTH',ageFrom:360,ageTo:371,valueFrom:3,valueTo:5}]},{dateOfBirth:'1996-10-13',gender:'female'},new Date('2026-10-13T12:00:00'));
 assert.equal(reference.displayValue,'3 - 5');
});
test('year-only patient age never establishes a month or day mapping',()=>{
 for(const ageUnit of ['MONTH','DAY'] as const){
 const reference=resolveReferenceRange({referenceMappings:[{mappingType:'AGE_WISE',valueType:'NUMERIC',ageUnit,ageTo:400,valueFrom:3,valueTo:5}]},{age:30,gender:'female'});
 assert.equal(reference.status,'NO_MAPPING_FOR_PATIENT');
 }
});
