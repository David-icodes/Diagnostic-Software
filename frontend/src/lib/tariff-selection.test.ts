import { test } from "node:test";
import assert from "node:assert/strict";
import { selectTariffScope, selectedTariffRows } from "./tariff-selection.ts";
import { resolveCommissionDraft } from "./commission-draft.ts";

test("Select All controls every scoped row without mutating existing selection", () => {
  const original = { outside: true, a: false };
  const next = selectTariffScope(original, ["a", "b", "b"], true);
  assert.deepEqual(next, { outside: true, a: true, b: true });
  assert.deepEqual(original, { outside: true, a: false });
  assert.deepEqual(selectTariffScope(next, ["a"], false), { outside: true, a: false, b: true });
});
test("save selection excludes unselected records and duplicate IDs", () => {
  const rows = [{ testId: "a", price: 10 }, { testId: "b", price: 20 }, { testId: "a", price: 99 }];
  assert.deepEqual(selectedTariffRows(rows, { a: true, b: false }), [rows[0]]);
  assert.deepEqual(selectedTariffRows(rows, {}), []);
});
test("copy selected commission set preserves only configured values and edits, not mapping IDs", () => {
  const rows = [{ testId: "a", id: "mapping-id", commissionPercent: 10, commissionAmount: 50 }, { testId: "b", id: "other-id", commissionPercent: 20 }];
  const copied = selectedTariffRows(rows, { a: true }).map((row) => ({ testId: row.testId, ...resolveCommissionDraft(row, { amount: "60" }) }));
  assert.deepEqual(copied, [{ testId: "a", commissionPercent: 10, commissionAmount: 60 }]);
  assert.equal("id" in copied[0], false);
  assert.throws(() => resolveCommissionDraft({}, { percent: "mapping-id" }));
});
