import test from 'node:test';import assert from 'node:assert/strict';import {formatMoney} from './money-display.ts';
test('whole monetary amounts omit decimal zeros while real fractions and balances remain accurate',()=>{
 assert.equal(formatMoney(2000),'2,000');assert.equal(formatMoney(2000.0000),'2,000');assert.equal(formatMoney(0),'0');assert.equal(formatMoney(undefined),'0');assert.equal(formatMoney(2000.5),'2,000.5');assert.equal(formatMoney(2000.75),'2,000.75');
});
