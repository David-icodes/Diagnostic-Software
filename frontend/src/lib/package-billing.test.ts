import test from "node:test";
import assert from "node:assert/strict";
import { groupedBillItems } from "./package-billing.ts";
test("invoice and edit display groups a package once without changing processing snapshots",()=>{
 const rows=[{testId:"A",packageId:"P",packageName:"XYZ",unitPrice:1000,total:1000,quantity:1},{testId:"B",packageId:"P",packageName:"XYZ",unitPrice:0,total:0,quantity:1},{testId:"C",unitPrice:200,total:200,quantity:1}];
 const copy=JSON.stringify(rows);const grouped=groupedBillItems(rows as never);assert.equal(grouped.length,2);assert.equal(grouped[0].testId,"P");assert.equal(grouped[0].testName,"XYZ");assert.equal(grouped[0].unitPrice,1000);assert.equal(grouped[1].testId,"C");assert.equal(JSON.stringify(rows),copy);
});
