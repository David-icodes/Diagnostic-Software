import { test } from "node:test";
import assert from "node:assert/strict";
import { bulkLabTariffSchema } from "./lab-tariff";
import { assignCommissionMappingsSchema } from "./commission-mapping";
import { applyClientTariffSchema } from "./client-tariff";

test("all tariff and commission save routes reject duplicate test IDs", () => {
  assert.equal(bulkLabTariffSchema.safeParse({ rows: [{ testId: "a", price: 10 }, { testId: "a", price: 20 }] }).success, false);
  assert.equal(assignCommissionMappingsSchema.safeParse({ doctorId: "doctor", departmentId: "dept", mappings: [{ testId: "a", commissionPercent: 10 }, { testId: "a", commissionAmount: 20 }] }).success, false);
  assert.equal(applyClientTariffSchema.safeParse({ clientId: "client", departmentId: "dept", rows: [{ testId: "a", price: 10 }, { testId: "a", price: 20 }] }).success, false);
});
test("save routes accept selected values and reject IDs masquerading as amounts", () => {
  assert.equal(bulkLabTariffSchema.safeParse({ rows: [{ testId: "a", price: 0 }, { testId: "b", price: 20 }] }).success, true);
  assert.equal(assignCommissionMappingsSchema.safeParse({ doctorId: "doctor", departmentId: "dept", mappings: [{ testId: "a", commissionPercent: 10, commissionAmount: 0 }] }).success, true);
  assert.equal(assignCommissionMappingsSchema.safeParse({ doctorId: "doctor", departmentId: "dept", mappings: [{ testId: "a", commissionAmount: "mapping-id" }] }).success, false);
  assert.equal(applyClientTariffSchema.safeParse({ clientId: "client", departmentId: "dept", rows: [{ testId: "a", price: 12.5 }] }).success, true);
});
