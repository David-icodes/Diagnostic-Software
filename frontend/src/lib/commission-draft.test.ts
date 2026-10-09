import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCommissionDraft } from "./commission-draft.ts";
test("selection and copy retain saved values when drafts are untouched", () => assert.deepEqual(resolveCommissionDraft({ commissionPercent: 10, commissionAmount: 50 }, { percent: "12" }), { commissionPercent: 12, commissionAmount: 50 }));
test("invalid, missing and infinite commission drafts cannot submit", () => {
  for (const percent of ["Infinity", "NaN", "-1", "101"]) assert.throws(() => resolveCommissionDraft({}, { percent }));
  assert.throws(() => resolveCommissionDraft({}));
  assert.throws(() => resolveCommissionDraft({}, { amount: "Infinity" }));
});
test("zero commission is valid and an explicit blank can clear only one value", () => assert.deepEqual(resolveCommissionDraft({ commissionPercent: 10, commissionAmount: 50 }, { percent: "", amount: "0" }), { commissionPercent: undefined, commissionAmount: 0 }));
