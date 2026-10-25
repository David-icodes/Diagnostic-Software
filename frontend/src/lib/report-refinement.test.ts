import test from 'node:test';
import assert from 'node:assert/strict';
import {initialResultText,initialResultBoolean} from './result-entry-default.ts';
import {previewFlag} from './result-preview.ts';
import {resolvePackageMembers} from './package-members.ts';
test('new defaults populate submitted drafts; saved empty, zero and manual text win',()=>{
 const p={resultType:'TEXT',defaultValue:'Configured text'};
 assert.equal(initialResultText(p,undefined),'Configured text');
 for(const value of ['',0,'Manual text'])assert.equal(initialResultText(p,{result:value}),String(value));
 assert.equal(initialResultText(p,{result:3,resultDisplay:'3.00'}),'3.00');
 assert.equal(initialResultText({...p,defaultValue:''},undefined),'');
 assert.equal(initialResultText({...p,calculation:{enabled:true}},undefined),'');
 assert.equal(initialResultText({resultType:'NUMBER',defaultValue:'bad'},undefined),'');
 assert.equal(initialResultBoolean('true',undefined),true);
 assert.equal(initialResultBoolean('true',{result:false}),false);
 const draft={parameterId:'synthetic',result:initialResultText(p,undefined)};
 assert.deepEqual(JSON.parse(JSON.stringify(draft)),{parameterId:'synthetic',result:'Configured text'});
});
test('packages resolve current departments and legacy flags; reject duplicate, disabled and missing',()=>{
 const a={id:'a',testName:'Synthetic A',departmentId:{_id:'d1'}},b={id:'b',testName:'Synthetic B',departmentId:'d2',active:true};
 const depts=[{id:'d1',name:'Synthetic Hematology'},{id:'d2',name:'Synthetic Chemistry'}];
 assert.deepEqual(resolvePackageMembers([a,b],depts).map(r=>r.departmentName),depts.map(d=>d.name));
 assert.throws(()=>resolvePackageMembers([a,a],depts),/duplicate/);
 assert.throws(()=>resolvePackageMembers([{...a,active:false}],depts),/unavailable/);
 assert.throws(()=>resolvePackageMembers([a],[]),/unavailable/);
});

test('abnormal preview covers low, high, normal, missing and categorical without new thresholds',()=>{
 const ref={status:'MATCHED',valueType:'NUMERIC',valueFrom:5,valueTo:10} as any;
 assert.equal(previewFlag(3,ref),'out-of-range');assert.equal(previewFlag(13,ref),'out-of-range');
 assert.equal(previewFlag(7,ref),'in-range');assert.equal(previewFlag(undefined,ref),'not-comparable');
 assert.equal(previewFlag('Non-reactive',{...ref,valueType:'TEXT'}),'not-comparable');
});
