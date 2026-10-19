import test from 'node:test';
import assert from 'node:assert/strict';
import {enteredReportParameters} from './entered-report-parameters.ts';
test('only entered parameters excludes missing and blank results including unsaved narrative defaults',()=>{
 const parameters=[{id:'default-narrative',defaultValue:'Configured narrative'},{id:'blank'},{id:'entered'}];
 assert.deepEqual(enteredReportParameters(parameters,[{parameterId:'blank',result:'  '},{parameterId:'entered',result:'Negative'}]).map(row=>row.id),['entered']);
});
test('only entered parameters retains valid numeric zero and false',()=>{
 assert.equal(enteredReportParameters([{id:'zero'},{id:'false'}],[{parameterId:'zero',result:0},{parameterId:'false',result:false}]).length,2);
});
test('empty section headings are excluded while headings for entered results remain',()=>{
 const parameters=[{id:'empty-section',itemType:'SUBTITLE'},{id:'empty'},{id:'section',itemType:'SUBTITLE'},{id:'value'}];
 assert.deepEqual(enteredReportParameters(parameters,[{parameterId:'value',result:'1.00'}]).map(row=>row.id),['section','value']);
});
