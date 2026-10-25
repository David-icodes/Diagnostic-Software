import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { Patient } from "../../models/patient.model";
import { hasRecordedPatientAge } from "../../utils/patient-age";
import { createLabBill } from "./lab-bill.service";
import type { CreateLabBillInput } from "../../validations/lab-bill";

const patientId = new Types.ObjectId();
const userId = new Types.ObjectId();
const testId = new Types.ObjectId();

function query(value: unknown) {
  const chain = { exec: async () => value };
  return chain;
}

test("OSP bill creation rejects missing, zero-only and invalid ages before pricing", async (t) => {
  let current: Record<string, unknown> = {
    _id: patientId,
    status: "active",
  };
  t.mock.method(Patient, "findById", () => query(current));

  const input = {
    patientId: String(patientId),
    items: [{ testId: String(testId), quantity: 1 }],
    paidAmount: 0,
    status: "draft" as const,
  } as unknown as CreateLabBillInput;

  for (const patch of [
    {},
    { age: 0 },
    { age: -1 },
    { age: 151 },
    { age: 1.5 },
    { age: Number.NaN },
    { dateOfBirth: "2030-01-01" },
    { dateOfBirth: "not-a-date" },
  ]) {
    current = { _id: patientId, status: "active", ...patch };
    await assert.rejects(
      createLabBill(String(userId), input),
      /Age is required for an OSP patient/,
      JSON.stringify(patch),
    );
  }
});

test("a valid DOB satisfies the same billing gate even when completed years are zero", () => {
  // The helper is exercised here; createLabBill's gate is `hasRecordedPatientAge`.
  // A newborn DOB must not be rejected the way an ambiguous zero-only age is.
  assert.equal(
    hasRecordedPatientAge({ dateOfBirth: new Date("2026-10-10"), age: 0 }),
    true,
  );
});
