import assert from "node:assert/strict";
import { test } from "node:test";
import { billFinancialSummary } from "./bill-financial-summary";

test("summary counts persisted income/dues once per represented bill and never invents profit", () => {
  const bills = [{ billNumber: "a", paidAmount: 300, dueAmount: 100 }, { billNumber: "b", paidAmount: 20.25, dueAmount: 0 }, { billNumber: "excluded", paidAmount: 900, dueAmount: 500 }];
  assert.deepEqual(billFinancialSummary(bills, new Set(["a", "a", "b"])), { totalBills: 2, income: 320.25, due: 100, profit: null });
  assert.deepEqual(billFinancialSummary(bills, new Set()), { totalBills: 0, income: 0, due: 0, profit: null });
});
