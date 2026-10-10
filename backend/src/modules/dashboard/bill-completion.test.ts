import assert from "node:assert/strict";
import { test } from "node:test";
import { billCompletion } from "./bill-completion";

test("one bill is one completion unit; partial multi-test bills stay pending", () => {
  const bills = [1, 3, 3, 5].map((count, index) => ({ id: String(index), patientId: "patient", testIds: Array.from({ length: count }, (_, i) => `t${i}`) }));
  const results = bills.flatMap((bill, index) => bill.testIds.slice(0, index === 1 ? 2 : undefined).map((testId) => ({ billId: bill.id, patientId: bill.patientId, testId, parameterId: `p${testId.slice(1)}`, result: 0 })));
  const states = billCompletion(bills, results);
  assert.deepEqual([...states.values()], [true, false, true, true]);
  assert.equal([...states.values()].filter(Boolean).length, 3);
  assert.equal(states.size - [...states.values()].filter(Boolean).length, 1);
  const partial = bills[1]!;
  assert.equal(billCompletion([partial], results.filter((row) => row.billId === partial.id).slice(0, 1)).get(partial.id), false);
});
test("completion preserves CLOSED result state, exact bill/patient/test and safe empty bills", () => {
  const bills = [{ id: "a", patientId: "p", testIds: ["t"] }, { id: "empty", patientId: "p", testIds: [] }, { id: "unconfigured", patientId: "p", testIds: ["none"] }];
  const row = { billId: "a", patientId: "p", testId: "t", parameterId: "x", result: false };
  for (const result of ["", " ", null, undefined, NaN, Infinity]) {
    assert.equal(billCompletion(bills, [{ ...row, result }]).get("a"), false);
  }
  for (const wrong of [{ patientId: "other" }, { billId: "other" }, { testId: "other" }]) {
    assert.equal(billCompletion(bills, [{ ...row, ...wrong }]).get("a"), false);
  }
  const states = billCompletion(bills, [row, row]);
  assert.deepEqual([...states.values()], [true, false, false]);
});
