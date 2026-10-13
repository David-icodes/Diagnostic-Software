import test from 'node:test';
import assert from 'node:assert/strict';
import {composeReferenceRange} from './lab-test-parameter.service';
import {resolveReferenceRange} from '../../utils/reference-resolver';
import {LabTestParameter} from '../../models/lab-test-parameter.model';
import {createLabTestParameterSchema} from '../../validations/lab-test-parameter';

test('explicit blank source display stays blank while omitted text composes numeric bounds',()=>{
 const source={referenceType:'GENERAL' as const,rangeFrom:0,rangeTo:0,rangeText:''};
 assert.equal(composeReferenceRange(source),'');
 assert.equal(composeReferenceRange({...source,rangeText:undefined}),'0–0');
 assert.equal(composeReferenceRange({...source,rangeText:'First line\nSecond line'}),'First line\nSecond line');
 const validated=createLabTestParameterSchema.parse({...source,testId:'000000000000000000000001',parameterName:'Synthetic'});
 assert.equal(validated.rangeText,''); assert.equal(composeReferenceRange(validated),'');
});

test('general blank range never uses inactive gender fields or silently flags zero bounds',()=>{
 const resolution=resolveReferenceRange({referenceType:'GENERAL',referenceRange:'',genderRanges:[{gender:'M',from:0,to:0},{gender:'F',from:0,to:0},{gender:'C',from:0,to:0}]},{gender:'male',age:30});
 assert.equal(resolution.status,'NOT_CONFIGURED'); assert.equal(resolution.displayValue,'');
 assert.equal(resolution.valueFrom,undefined); assert.equal(resolution.valueTo,undefined);
});

test('source provenance and multiline text persist through model casting without new approvals',()=>{
 const evidence={sourceSystem:'WILCO',sourceParameterId:'1601',sourceTestId:'2792',sourceDepartment:'BIO CHEMISTRY',sourceRow:2,fingerprint:'synthetic',originalSource:{range:'',units:'',raw:'First line\nSecond line'},originalUpload:'Original\trow\n'};
 const doc=new LabTestParameter({testId:'000000000000000000000001',parameterName:'Synthetic',createdBy:'000000000000000000000002',rangeText:'',referenceRange:'',rangeFrom:0,rangeTo:0,catalogueImport:evidence});
 assert.equal(doc.validateSync(),undefined); assert.deepEqual(doc.toObject().catalogueImport,evidence);
 assert.equal(doc.rangeText,''); assert.equal(doc.referenceRange,''); assert.equal(doc.rangeFrom,0);
 assert.equal(doc.calculation,undefined); assert.equal(doc.calculationApproval,undefined);
 assert.equal(LabTestParameter.schema.path('catalogueImport').options.immutable,true);
 assert.ok(LabTestParameter.schema.indexes().some(([keys,options])=>keys.testId===1&&keys.parameterName===1&&options.unique));
});

test('multiline source reference whitespace is preserved at validation, composition and storage',()=>{
 const raw=' First line\nSecond line\n';
 const input=createLabTestParameterSchema.parse({testId:'000000000000000000000001',parameterName:'Synthetic',rangeText:raw});
 assert.equal(input.rangeText,raw); assert.equal(composeReferenceRange(input),raw);
 const doc=new LabTestParameter({...input,createdBy:'000000000000000000000002',referenceRange:composeReferenceRange(input)});
 assert.equal(doc.validateSync(),undefined); assert.equal(doc.rangeText,raw); assert.equal(doc.referenceRange,raw);
 assert.equal(resolveReferenceRange(doc,{age:30,gender:'male'}).displayValue,'First line\nSecond line');
 assert.equal(createLabTestParameterSchema.safeParse({...input,rangeText:'x'.repeat(201)}).success,false);
});
