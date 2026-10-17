import test from "node:test";
import assert from "node:assert/strict";
import {departmentFilter, everyCataloguePage, selectedColumns} from "./catalogue-selection.ts";

test("ALL filters omit a department ID and restoring ALL restores every paginated test", async () => {
  for (const id of [undefined, null, "", "ALL", "all", "__all"]) assert.equal(departmentFilter(id), undefined);
  assert.equal(departmentFilter("real-department"), "real-department");
  const pages: number[] = [];
  const rows = await everyCataloguePage(async page => { pages.push(page); return {items:[{id:String(page)},{id:"shared"}],pagination:{totalPages:4}}; });
  assert.deepEqual(pages, [1,2,3,4]); assert.equal(rows.length, 5);
  await assert.rejects(everyCataloguePage(async page => {if(page===2) throw Error("page failure"); return {items:[{id:"one"}],pagination:{totalPages:2}};}), /page failure/);
});
test("compact columns retain every test exactly once and follow five entries per column", () => {
  for (const count of [0,1,5,10,11,27]) {
    const rows=Array.from({length:count},(_,i)=>i+1), columns=selectedColumns(rows);
    assert.deepEqual(columns.flat(),rows); assert.ok(columns.every(column=>column.length<=5));
  }
  assert.deepEqual(selectedColumns(Array.from({length:10},(_,i)=>i+1)),[[1,2,3,4,5],[6,7,8,9,10]]);
});
