import test from 'node:test';import assert from 'node:assert/strict';
import {resultEditMetadata} from './result-edit-metadata';
test('default edits require a real edit flag and a changed saved value; reloads never infer edits',()=>{
 const now=new Date('2026-10-26T00:00:00Z');
 const original=resultEditMetadata({result:'Default'},undefined,'Default',false,'synthetic',now);
 assert.equal(original.manuallyChanged,false);assert.equal(original.origin,'DEFAULT');
 const changed=resultEditMetadata({result:'Changed',manuallyEdited:true},{result:'Default',editMetadata:original},'New catalogue default',false,'synthetic',now);
 assert.equal(changed.manuallyChanged,true);assert.equal(changed.defaultValue,'Default');
 assert.deepEqual(resultEditMetadata({result:'Changed'},{result:'Changed',editMetadata:changed},'Another default',false,'synthetic',now),changed);
 assert.equal(resultEditMetadata({result:'Old saved value'},{result:'Old saved value'},'Different default',false,'synthetic',now).manuallyChanged,false);
 assert.equal(resultEditMetadata({result:'Default',manuallyEdited:true},undefined,'Default',false,'synthetic',now).manuallyChanged,false);
 assert.equal(resultEditMetadata({result:7,manuallyEdited:true},undefined,undefined,false,'synthetic',now).manuallyChanged,false);
 assert.equal(resultEditMetadata({result:7,manuallyEdited:true},undefined,'3',true,'synthetic',now).manuallyChanged,false);
});
