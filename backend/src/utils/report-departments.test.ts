import test from "node:test";
import assert from "node:assert/strict";
import {departmentOrderedItems,reportSectionCount} from "./report-departments";
test("department PDF readiness counts consolidated sections, including partial external-report groups",()=>{
 const items=[{testId:"a",departmentId:"h",departmentName:"Hematology"},{testId:"b",departmentId:"c",departmentName:"Chemistry"},{testId:"c",departmentId:"h",departmentName:"Hematology"}];
 assert.deepEqual(departmentOrderedItems(items).map(i=>i.testId),["a","c","b"]);
 assert.equal(reportSectionCount({printMode:"department",reports:items.map(item=>({item}))}),2);
 assert.equal(reportSectionCount({printMode:"test",reports:items.map(item=>({item}))}),3);
 assert.equal(reportSectionCount({printMode:"department",reports:[]}),0);
 assert.equal(reportSectionCount({externalReport:{},printMode:"department",reports:[]}),1);
 assert.deepEqual(items.map(i=>i.testId),["a","b","c"]);
});
