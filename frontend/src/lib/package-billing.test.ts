import test from "node:test";
import assert from "node:assert/strict";
import { groupedBillItems } from "./package-billing.ts";
test("invoice and edit display groups a package once without changing processing snapshots",()=>{
 const rows=[{testId:"A",packageId:"P",packageName:"XYZ",unitPrice:1000,total:1000,quantity:1},{testId:"B",packageId:"P",packageName:"XYZ",unitPrice:0,total:0,quantity:1},{testId:"C",unitPrice:200,total:200,quantity:1}];
 const copy=JSON.stringify(rows);const grouped=groupedBillItems(rows as never);assert.equal(grouped.length,2);assert.equal(grouped[0].testId,"P");assert.equal(grouped[0].testName,"XYZ");assert.equal(grouped[0].unitPrice,1000);assert.deepEqual(grouped[0].includedTests?.map(row=>row.testId),["A","B"]);assert.equal(grouped[1].testId,"C");assert.equal(JSON.stringify(rows),copy);
});

test('package allocations preserve zero and decimal amounts without double charging or changing source snapshots',()=>{
 const rows=Array.from({length:11},(_,i)=>({testId:'member'+i,testName:'Member '+i,packageId:'pkg',packageName:'XYZ',unitPrice:i===0?1000.5:0,total:i===0?1000.5:0,quantity:1}));
 const before=JSON.stringify(rows),group=groupedBillItems(rows as never)[0];assert.equal(group.total,1000.5);assert.equal(group.includedTests?.length,11);assert.equal(group.includedTests?.[1].billedAmount,0);assert.equal(group.includedTests?.[0].billedAmount,1000.5);assert.equal(JSON.stringify(rows),before);
});
