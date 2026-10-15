import assert from "node:assert/strict";
import { test } from "node:test";
import { billCompletion, pendingTestCount } from "./bill-completion";

test("one bill is one completion unit; partial multi-test bills stay pending", () => {
  const bills = [1, 3, 3, 5].map((count, index) => ({ id: String(index), patientId: "patient", testIds: Array.from({ length: count }, (_, i) => `t${i}`) }));
  const results = bills.flatMap((bill, index) => bill.testIds.slice(0, index === 1 ? 2 : undefined).map((testId) => ({ billId: bill.id, patientId: bill.patientId, testId, parameterId: `p${testId.slice(1)}`, result: 0, version: 1, enteredAt: new Date() })));
  const states = billCompletion(bills, results);
  assert.deepEqual([...states.values()], [true, false, true, true]);
  assert.equal([...states.values()].filter(Boolean).length, 3);
  assert.equal(states.size - [...states.values()].filter(Boolean).length, 1);
  const partial = bills[1]!;
  assert.equal(billCompletion([partial], results.filter((row) => row.billId === partial.id).slice(0, 1)).get(partial.id), false);
});
test("completion preserves CLOSED result state, exact bill/patient/test and safe empty bills", () => {
  const bills = [{ id: "a", patientId: "p", testIds: ["t"] }, { id: "empty", patientId: "p", testIds: [] }, { id: "unconfigured", patientId: "p", testIds: ["none"] }];
  const row = { billId: "a", patientId: "p", testId: "t", parameterId: "x", result: false, version: 1, enteredAt: new Date() };
  for (const result of ["", " ", null, undefined, NaN, Infinity]) {
    assert.equal(billCompletion(bills, [{ ...row, result }]).get("a"), false);
  }
  for (const wrong of [{ patientId: "other" }, { billId: "other" }, { testId: "other" }]) {
    assert.equal(billCompletion(bills, [{ ...row, ...wrong }]).get("a"), false);
  }
  const states = billCompletion(bills, [row, row]);
  assert.deepEqual([...states.values()], [true, false, false]);
});

test("pending count groups duplicate test and parameter records into one bill",()=>{const bills=[{id:"b",patientId:"p",testIds:["a","b","b","c"]}];const result={billId:"b",patientId:"p",testId:"a",parameterId:"x",result:0,version:1,enteredAt:new Date()};assert.equal(pendingTestCount(bills,[result,{...result,testId:"b",patientId:"other"}]),1);assert.equal(pendingTestCount([],[]),0);});

test("five completed tests count once; two incomplete patients count twice", () => {
  const bills = [5, 4, 3].map((count, index) => ({ id: `bill${index}`, patientId: `patient${index}`,
    testIds: Array.from({ length: count }, (_, i) => `test${i}`) }));
  const results = bills.flatMap((bill, index) => bill.testIds.slice(0, index === 0 ? 3 : index === 1 ? 0 : 3)
    .map(testId => ({ billId: bill.id, patientId: bill.patientId, testId, parameterId: "p", result: 0, version: 1, enteredAt: new Date() })));
  assert.deepEqual([...billCompletion(bills, results).values()], [false, false, true]);
  assert.equal(pendingTestCount(bills, results), 2);
  const five = bills[0];
  const allFive = five.testIds.map(testId => ({ billId: five.id, patientId: five.patientId, testId, parameterId: "p", result: false, version: 1, enteredAt: new Date() }));
  assert.deepEqual([...billCompletion([five], [...allFive, ...allFive]).values()], [true]);
  assert.equal(pendingTestCount([five], allFive), 0);
});

test("invalid, superseded and unsubmitted values cannot imply completion", () => {
  const bill = { id: "b", patientId: "p", testIds: ["t"] };
  const row = { id: "r", billId: "b", patientId: "p", testId: "t", parameterId: "x", result: 15, version: 1, enteredAt: new Date() };
  for (const changed of [{ version: 0 }, { enteredAt: new Date(NaN) }, { superseded: true }]) {
    assert.equal(billCompletion([bill], [{ ...row, ...changed }]).get("b"), false);
  }
  assert.equal(billCompletion([bill], [row], [{ entity: "r", action: "test_result.submission_pending" }, { entity: "r", action: "test_result.submission_confirmed" }]).get("b"), false);
  assert.equal(billCompletion([bill], [row], [{ entity: "r", action: "test_result.submission_confirmed" }]).get("b"), true);
});
