import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { selectedTransfer, orderedPrintIds, hasEnteredResult, sampleIsCollected, sampleContextHref, resultContextHref, sampleContextFromQuery, matchesSampleContext, patientNameForUpdate } from "./lab-workflows.ts";

describe("focused lab workflows", () => {
  it("round-trips exact sample/result context and safe filters through a fixed local return route", () => {
    const context = { billId: "bill-1", testId: "test-2", billNumber: "OSP/123", sampleId: "sample-3", returnFilters: { mode: "criteria" as const, fromDate: "2026-10-01", toDate: "2026-10-08", billNumber: "", patientName: "query", includeClients: true } };
    const sample = new URL(sampleContextHref(context), "http://localhost:3000");
    const parsed = sampleContextFromQuery(Object.fromEntries(sample.searchParams));
    assert.deepEqual(parsed, context);
    const result = new URL(resultContextHref(parsed!), "http://localhost:3000");
    assert.equal(result.pathname, "/laboratory/test-result/parameter-based-test-results");
    assert.deepEqual(sampleContextFromQuery(Object.fromEntries(result.searchParams)), context);
    assert.equal(sampleContextFromQuery({ billId: ["a", "b"], testId: "test", billNumber: "bill" }), undefined);
    const next = sampleContextFromQuery({ billId: "different", testId: "other", billNumber: "OSP/456", returnUrl: "https://example.com" });
    assert.equal(next?.billId, "different");
    assert.equal(next?.sampleId, undefined);
    assert.equal(resultContextHref(next!).includes("example.com"), false);
  });
  it("keeps registered name casing and surname when only other OSP details change", () => {
    const existing = { firstName: "Rahul", lastName: "Sing" };
    const entered = { firstName: "RAHUL SING", lastName: "" };
    assert.deepEqual(patientNameForUpdate(entered, existing, true), existing);
    assert.deepEqual(patientNameForUpdate({ firstName: "EDITED NAME" }, existing, false), { firstName: "EDITED NAME", lastName: "" });
    assert.deepEqual(existing, { firstName: "Rahul", lastName: "Sing" });
  });
  it("transfers exactly the current test and prevents duplicates", () => {
    const tests = [{ id: "a" }, { id: "b" }];
    assert.deepEqual(selectedTransfer(tests, "a", new Set()), tests[0]);
    assert.deepEqual(selectedTransfer(tests, "b", new Set(["a"])), tests[1]);
    assert.equal(selectedTransfer(tests, "a", new Set(["a"])), undefined);
    assert.equal(selectedTransfer(tests, null, new Set()), undefined);
  });
  it("prints only selected ordered test IDs, once, never a same-name unrelated test", () => {
    assert.deepEqual(orderedPrintIds([{ testId: "b" }, { testId: "a" }, { testId: "b" }], { a: true, b: true, unrelated: true }), ["b", "a"]);
    assert.deepEqual(orderedPrintIds([{ testId: "a" }], { a: false }), []);
  });
  it("only-entered printing retains zero and false, excluding blank values", () => {
    for (const value of [undefined, null, "", "  "]) assert.equal(hasEnteredResult(value), false);
    for (const value of [0, false, "0", "Negative", 12]) assert.equal(hasEnteredResult(value), true);
  });
  it("distinguishes collected status from rejected and untouched samples", () => {
    for (const value of ["COLLECTED", "RECOLLECTED", "RECEIVED", "PROCESSED"]) assert.equal(sampleIsCollected(value), true);
    for (const value of [undefined, "SELECT", "REJECTED"]) assert.equal(sampleIsCollected(value), false);
  });
  it("preserves and strictly matches bill, test and sample IDs in navigation", () => {
    const context = { billId: "bill-1", testId: "test-1", billNumber: "OSP/1 & 2", sampleId: "sample-1" };
    const url = new URL(sampleContextHref(context), "http://localhost:3000");
    for (const [key,value] of Object.entries(context)) assert.equal(url.searchParams.get(key), value);
    assert.equal(matchesSampleContext({ billId: "bill-1", testId: "test-1", id: "sample-1" }, context), true);
    for (const row of [{ billId: "bill-2", testId: "test-1", id: "sample-1" }, { billId: "bill-1", testId: "test-2", id: "sample-1" }, { billId: "bill-1", testId: "test-1", id: "sample-2" }]) assert.equal(matchesSampleContext(row, context), false);
  });
});
