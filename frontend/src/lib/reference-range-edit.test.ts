import test from 'node:test';
import assert from 'node:assert/strict';
import {editRangeBounds,needsExplicitRangeComposition} from './reference-range-edit.ts';
test('numeric bound edits synchronize the text actually sent to persistence',()=>{
 const original={from:'10',to:'20',text:'10–20'};
 const updated=editRangeBounds(editRangeBounds(original,{from:'20'}),{to:'30'});
 assert.deepEqual(updated,{from:'20',to:'30',text:'20 - 30'});
 assert.equal(needsExplicitRangeComposition(original,updated),false);
 assert.deepEqual(original,{from:'10',to:'20',text:'10–20'});
});
test('one-sided and negative numeric bounds retain numeric meaning',()=>{
 assert.equal(editRangeBounds({from:'',to:'20',text:'<= 20'},{to:'30'}).text,'<= 30');
 assert.equal(editRangeBounds({from:'-10',to:'-1',text:'-10–-1'},{from:'-20'}).text,'-20 - -1');
});
test('narrative and unit-bearing source text need explicit composition, never silent replacement',()=>{
 for(const text of ['10-20 pg','<20 Deficient\n20-30 Insufficient','']){
  const original={from:'10',to:'20',text},updated=editRangeBounds(original,{to:'30'});
  assert.equal(updated.text,text);assert.equal(needsExplicitRangeComposition(original,updated),true);
  assert.equal(needsExplicitRangeComposition(original,{...updated,text:'10 - 30'}),false);
 }
});
test('unchanged bounds and invalid intermediate input do not rewrite source values',()=>{
 const original={from:'10',to:'20',text:'10–20'};
 assert.equal(editRangeBounds(original,{from:'invalid'}).text,original.text);
 assert.equal(needsExplicitRangeComposition(original,original),false);
});
