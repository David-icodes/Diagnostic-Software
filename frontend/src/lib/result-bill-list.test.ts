import { test } from "node:test";
import assert from "node:assert/strict";
import { initialResultBillParams, resultBillParams, allResultBillPages } from "./result-bill-list.ts";

test("Today return context restores selection without searching its bill number", () => {
  const today = "2026-10-08";
  const context = { billId: "bill", testId: "test", billNumber: "OSP202600092", returnFilters: {
    mode: "today" as const, fromDate: today, toDate: today, billNumber: "", patientName: "", includeClients: false,
  } };
  assert.deepEqual(initialResultBillParams(today, context), resultBillParams({ mode: "criteria", today,
    fromDate: today, toDate: today, includeClients: false }));
  assert.equal("search" in initialResultBillParams(today, context), false);
  assert.equal(initialResultBillParams(today).billType, undefined);
  assert.equal(resultBillParams({ mode: "criteria", today, includeClients: false, billNumber: "OLD" }).search, "OLD");
});

test("complete result list consumes every matching API page", async () => {
  const calls: number[] = [];
  const rows = await allResultBillPages(async (page) => {
    calls.push(page); return { data: [page], pagination: { totalPages: 3 } };
  });
  assert.deepEqual(calls, [1, 2, 3]); assert.deepEqual(rows, [1, 2, 3]);
});
test("client inclusion leaves generated vendor bills eligible and duplicate page boundaries render once", async () => {
  assert.equal(resultBillParams({mode:"today",today:"2026-10-14",includeClients:true}).billType,undefined);
  const rows=await allResultBillPages(async page=>({data:page===1?[{id:"osp"},{id:"vendor"}]:[{id:"vendor"},{id:"vendor-2"}],pagination:{totalPages:2}}));
  assert.deepEqual(rows.map(row=>row.id),["osp","vendor","vendor-2"]);
});
