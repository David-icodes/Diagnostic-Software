import { test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { LabTest } from "../../models/lab-test.model";
import { Department } from "../../models/department.model";
import { OutsideLab } from "../../models/outside-lab.model";
import type { IBillItem } from "../../models/lab-bill.model";
import { buildSnapshotItems } from "./lab-bill.service";
test("billing Out choices preserve prices, centre snapshots and historical timestamps without writing samples", async () => {
  const id = new Types.ObjectId("507f1f77bcf86cd799439011");
  const centre = new Types.ObjectId("507f1f77bcf86cd799439012");
  const other = new Types.ObjectId("507f1f77bcf86cd799439013");
  const department = new Types.ObjectId("507f1f77bcf86cd799439014");
  const original = [LabTest.find, Department.find, OutsideLab.find];
  const query = (value: unknown) => ({ select() { return this; }, exec: async () => value });
  let centreActive = true;
  try {
    LabTest.find = (() => query([{ _id: id, active: true, testCode: "SYN", testName: "Synthetic", price: 50, departmentId: department }])) as unknown as typeof LabTest.find;
    Department.find = (() => query([{ _id: department, name: "Synthetic department" }])) as unknown as typeof Department.find;
    OutsideLab.find = (() => query([{ _id: centre, active: centreActive, name: "Synthetic centre" }, { _id: other, active: true, name: "Other synthetic centre" }])) as unknown as typeof OutsideLab.find;
    const item = { testId: String(id), quantity: 2 };
    const [inhouse] = await buildSnapshotItems([item], "osp");
    const [out] = await buildSnapshotItems([{ ...item, out: true, outsideLabId: String(centre) }], "osp");
    assert.equal(inhouse.total, 100); assert.equal(out.total, 100);
    assert.equal(String(out.outsideLabId), String(centre)); assert.equal(out.outsideLabName, "Synthetic centre");
    assert.ok(out.sentOutAt instanceof Date);
    const historical = { ...out, sentOutAt: new Date("2026-10-07T03:00:00Z") } as IBillItem;
    centreActive = false;
    const [retained] = await buildSnapshotItems([{ ...item, out: true, outsideLabId: String(centre) }], "osp", [historical]);
    assert.equal(retained.sentOutAt?.toISOString(), historical.sentOutAt?.toISOString());
    await assert.rejects(buildSnapshotItems([{ ...item, out: true, outsideLabId: String(centre) }], "osp"), /active outside lab/);
    const [cleared] = await buildSnapshotItems([{ ...item, out: false, outsideLabId: null }], "osp", [historical]);
    assert.equal(cleared.outsideLabId, null); assert.equal(cleared.sentOutAt, null); assert.equal(cleared.total, 100);
    const [changed] = await buildSnapshotItems([{ ...item, out: true, outsideLabId: String(other) }], "osp", [historical]);
    assert.equal(String(changed.outsideLabId), String(other)); assert.equal(changed.total, 100);
    const [undated] = await buildSnapshotItems([item], "osp", [{ ...historical, sentOutAt: undefined }]);
    assert.equal(undated.sentOutAt, undefined);
  } finally {
    [LabTest.find, Department.find, OutsideLab.find] = original as [typeof LabTest.find, typeof Department.find, typeof OutsideLab.find];
  }
});
