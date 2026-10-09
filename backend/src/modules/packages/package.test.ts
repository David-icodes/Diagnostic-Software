import { test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { createPackageSchema, updatePackageSchema } from "../../validations/package";
import { LabPackage } from "../../models/lab-package.model";
import { LabTest } from "../../models/lab-test.model";
import { Department } from "../../models/department.model";
import { createPackage, getPackage, updatePackage } from "./package.service";
const a = "507f1f77bcf86cd799439011", b = "507f1f77bcf86cd799439012", dept = "507f1f77bcf86cd799439013";
test("package schema preserves supported prices/status and prevents duplicate tests", () => {
  const input = { name: "Synthetic package", packageType: "Lab", amount: 100, insAmount: 150, items: [{ testId: a, departmentId: dept }] };
  assert.equal(createPackageSchema.safeParse(input).success, true);
  assert.equal(createPackageSchema.safeParse({ ...input, items: [input.items[0], input.items[0]] }).success, false);
  assert.equal(createPackageSchema.safeParse({ ...input, amount: Infinity }).success, false);
  assert.equal(updatePackageSchema.safeParse({ active: false }).success, true);
});
test("mocked package create/reopen/edit retains item order, manual prices and inactive state", async () => {
  const originals = [LabPackage.create, LabPackage.findById, LabTest.find, Department.find];
  const query = (value: unknown) => ({ select() { return this; }, exec: async () => value });
  let stored: any;
  try {
    (LabPackage as any).create = async (input: unknown) => { stored = new LabPackage(input); stored.save = async () => stored; return stored; };
    (LabPackage as any).findById = () => query(stored);
    (LabTest as any).find = () => query([{ _id: a, testCode: "A", testName: "Test A" }, { _id: b, testCode: "B", testName: "Test B" }]);
    (Department as any).find = () => query([{ _id: dept, name: "Existing department" }]);
    const user = "507f1f77bcf86cd799439014";
    const input = createPackageSchema.parse({ name: "Synthetic package", packageType: "Lab", amount: 125, insAmount: 0, active: false, items: [{ testId: b, departmentId: dept }, { testId: a, departmentId: dept }] });
    const created = await createPackage(user, input as any);
    assert.deepEqual(created.items.map((item) => item.testId), [b, a]); assert.equal(created.amount, 125);
    const reopened = await getPackage(created.id); assert.equal(reopened.active, false); assert.equal(reopened.insAmount, 0);
    const edited = await updatePackage(created.id, user, { amount: 90, items: [{ testId: new Types.ObjectId(a), departmentId: new Types.ObjectId(dept) }] });
    assert.equal(edited.amount, 90); assert.equal(edited.active, false); assert.deepEqual(edited.items.map((item) => item.testId), [a]);
  } finally { [LabPackage.create, LabPackage.findById, LabTest.find, Department.find] = originals as [typeof LabPackage.create, typeof LabPackage.findById, typeof LabTest.find, typeof Department.find]; }
});
