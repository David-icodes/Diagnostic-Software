import test from "node:test";
import assert from "node:assert/strict";
import {groupDepartmentReports} from "./report-departments.ts";

test("consolidated selection groups interleaved departments once, keeping tests and metadata intact",()=>{
 const make=(testId:string,departmentId:string,departmentName:string)=>({item:{testId,departmentId,departmentName},parameters:[{id:testId+"-p"}],results:[{resultDisplay:"0.50"}]});
 const rows=[make("a","h","Hematology"),make("b","c","Biochemistry"),make("c","h","Hematology"),make("d","c","Biochemistry")];
 const groups=groupDepartmentReports(rows);
 assert.deepEqual(groups.map(g=>[g.name,g.reports.map(r=>r.item.testId)]),[["Hematology",["a","c"]],["Biochemistry",["b","d"]]]);
 assert.equal(groups[0].reports[1],rows[2]);assert.equal(groups[1].reports[0].results[0].resultDisplay,"0.50");
 assert.deepEqual(rows.map(r=>r.item.testId),["a","b","c","d"]);
 assert.deepEqual(groupDepartmentReports(rows.filter(r=>["b","c"].includes(r.item.testId))).flatMap(g=>g.reports.map(r=>r.item.testId)),["b","c"]);
});
test("empty selection stays empty; duplicate tests fail closed and distinct department IDs stay distinct",()=>{
 assert.deepEqual(groupDepartmentReports([]),[]);
 const row={item:{testId:"a",departmentId:"one",departmentName:"General"}};
 assert.throws(()=>groupDepartmentReports([row,row]),/Duplicate/);
 assert.equal(groupDepartmentReports([row,{item:{testId:"b",departmentId:"two",departmentName:"General"}}]).length,2);
});
