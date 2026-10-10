import test from "node:test";
import assert from "node:assert/strict";
import { submittedForTest, requireReportEligibility, reportStartsPage } from "./result-workflow.ts";

const saved = { billId: "bill", patientId: "patient", outstandingDue: 0, hasOutstandingDue: false,
  tests: [{ testId: "test", submitted: true }, { testId: "pending", submitted: false }] };

test("typed/selected/loading/failed states cannot unlock Print; persisted confirmation survives reopen", () => {
  assert.equal(submittedForTest(undefined, "bill", "test"), false);
  assert.equal(submittedForTest(saved, "bill", "pending"), false);
  assert.equal(submittedForTest(saved, "other", "test"), false);
  assert.equal(submittedForTest(JSON.parse(JSON.stringify(saved)), "bill", "test"), true);
  assert.equal(submittedForTest({ ...saved, tests: [{ testId: "test", submitted: false }] }, "bill", "test"), false);
});

test("report requires selected patient, submitted test and freshly verified zero dues", () => {
  assert.doesNotThrow(() => requireReportEligibility(saved, "bill", "patient", ["test"]));
  assert.throws(() => requireReportEligibility(saved, "bill", "other", ["test"]), /selected patient/);
  assert.throws(() => requireReportEligibility(saved, "bill", "patient", []), /Submit/);
  assert.throws(() => requireReportEligibility(saved, "bill", "patient", ["pending"]), /Submit/);
  assert.throws(() => requireReportEligibility(saved, "bill", "patient", ["not-ordered"]), /Submit/);
  assert.throws(() => requireReportEligibility({ ...saved, outstandingDue: 100 }, "bill", "patient", ["test"]), /outstanding due/);
  assert.throws(() => requireReportEligibility({ ...saved, hasOutstandingDue: true }, "bill", "patient", ["test"]), /outstanding due/);
  assert.throws(() => requireReportEligibility({ ...saved, outstandingDue: NaN }, "bill", "patient", ["test"]), /verified/);
});

test("print layouts retain order and insert only requested boundaries", () => {
  assert.equal(reportStartsPage("continuous", 1, "Hema", "Bio"), false);
  assert.equal(reportStartsPage("test", 0, "Hema"), false);
  assert.equal(reportStartsPage("test", 1, "Hema", "Hema"), true);
  assert.equal(reportStartsPage("department", 1, "Hema", "Hema"), false);
  assert.equal(reportStartsPage("department", 2, "Bio", "Hema"), true);
});
