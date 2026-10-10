import { test } from "node:test";
import assert from "node:assert/strict";
import { packageDraftPayload } from "./package-draft.ts";
const form = { name: "Package", packageType: "Lab", amount: "125", insAmount: "0" };
test("package prices stay manual and item order/IDs are preserved", () => {
  const items = [{ testId: "B", departmentId: "D2" }, { testId: "A", departmentId: "D1" }];
  const result = packageDraftPayload(form, items);
  assert.equal(result.amount, 125); assert.equal(result.insAmount, 0); assert.deepEqual(result.items, items);
  assert.equal("active" in result, false);
});
test("package drafts reject missing, negative and non-finite prices and duplicate tests", () => {
  for (const amount of ["", "-1", "NaN", "Infinity"]) assert.throws(() => packageDraftPayload({ ...form, amount }, []));
  assert.throws(() => packageDraftPayload({ ...form, insAmount: "-1" }, []));
  assert.throws(() => packageDraftPayload(form, [{ testId: "A", departmentId: "D" }, { testId: "A", departmentId: "D" }]));
  assert.throws(() => packageDraftPayload({ ...form, name: " " }, []));
  assert.equal(packageDraftPayload({ ...form, amount: "0", insAmount: "" }, []).insAmount, undefined);
});
