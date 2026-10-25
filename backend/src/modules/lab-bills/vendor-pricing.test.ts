import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { LabTest } from "../../models/lab-test.model";
import { Department } from "../../models/department.model";
import { LabClientTariff } from "../../models/lab-client-tariff.model";
import { buildSnapshotItems } from "./lab-bill.service";

const clientA = new Types.ObjectId();
const clientB = new Types.ObjectId();
const testId = new Types.ObjectId();
const departmentId = new Types.ObjectId();

function chain(value: unknown) {
  const query: Record<string, unknown> = {
    select: () => query,
    exec: async () => value,
  };
  return query;
}

test("two vendor clients receive their own tariff while the default master price stays hidden from the vendor path", async (t) => {
  const tariffs: Record<string, { testId: string; departmentId: string; price: number }[]> = {
    [String(clientA)]: [{ testId: String(testId), departmentId: String(departmentId), price: 100 }],
    [String(clientB)]: [{ testId: String(testId), departmentId: String(departmentId), price: 250 }],
  };
  t.mock.method(LabTest, "find", () => chain([
    { _id: testId, departmentId, active: true, price: 999, testName: "Synthetic", testCode: "SYN" },
  ]));
  t.mock.method(Department, "find", () => chain([{ _id: departmentId, name: "Synthetic dept" }]));
  let wrongDepartment = false;
  t.mock.method(LabClientTariff, "find", (filter: { clientId: string }) => {
    if (wrongDepartment) {
      return chain([{ testId: String(testId), departmentId: String(new Types.ObjectId()), price: 100 }]);
    }
    return chain(tariffs[String(filter.clientId)] ?? []);
  });

  const items = [{ testId: String(testId), quantity: 1 }];
  const a = await buildSnapshotItems(items, "osp", [], String(clientA));
  const b = await buildSnapshotItems(items, "osp", [], String(clientB));
  assert.equal(a[0].unitPrice, 100);
  assert.equal(b[0].unitPrice, 250);
  assert.equal(a[0].total, 100);
  assert.equal(b[0].total, 250);

  // A client with no configured tariff is refused instead of silently receiving the default price.
  await assert.rejects(
    buildSnapshotItems(items, "osp", [], String(new Types.ObjectId())),
    /No active client-specific tariff/,
  );

  // A tariff configured for another department cannot be billed against the test.
  wrongDepartment = true;
  await assert.rejects(
    buildSnapshotItems(items, "osp", [], String(clientA)),
    /department does not match/,
  );
});
