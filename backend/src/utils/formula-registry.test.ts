import test from "node:test";
import assert from "node:assert/strict";
import { resolveTestCalculations, formulaApproval, hasDuplicateCalculationSources } from "./configured-calculations";

const p = (parameterId: string, parameterName: string, unit: string | undefined, resultType = "NUMBER", itemType = "PARAMETER") =>
  ({ parameterId, parameterName, unit, resultType, itemType, active: true });

// Exact CBC names/units as stored in the development catalogue.
const cbc = [
  p("hb", "Hemoglobin (Hb)", "g/dL"),
  p("rbc", "RBC Count", "×10⁶/µL"),
  p("pcv", "Hematocrit (PCV)", "%"),
  p("mcv", "MCV", "fL"),
  p("mch", "MCH", "pg"),
  p("mchc", "MCHC", "g/dL"),
];

test("the central registry resolves CBC MCH/MCHC/PCV without any binding", () => {
  const resolved = resolveTestCalculations(cbc);
  assert.deepEqual(resolved.get("mch"), { config: { formulaId: "mch", dependencyIds: ["hb", "rbc"], precision: 2, overwrite: "CONFIRM" }, status: "APPROVED" });
  assert.deepEqual(resolved.get("mchc"), { config: { formulaId: "mchc", dependencyIds: ["hb", "pcv"], precision: 2, overwrite: "CONFIRM" }, status: "APPROVED" });
  assert.deepEqual(resolved.get("pcv"), { config: { formulaId: "pcv", dependencyIds: ["rbc", "mcv"], precision: 2, overwrite: "CONFIRM" }, status: "APPROVED" });
  assert.equal(resolved.get("mcv"), undefined, "MCV is blocked as the reciprocal of PCV");
  assert.equal(resolved.get("hb"), undefined, "measured sources are not calculated");
});

test("automatic mapping rejects inactive and nonnumeric targets even with valid numeric sources", () => {
  for (const replacement of [
    { resultType: "TEXT" },
    { resultType: "BOOLEAN" },
    { active: false },
    { itemType: "SUBTITLE" },
    { itemType: "TEXT_AREA" },
  ]) {
    const rows = cbc.map(row => row.parameterId === "mch" ? { ...row, ...replacement } : row);
    assert.equal(resolveTestCalculations(rows).get("mch"), undefined, JSON.stringify(replacement));
    assert.equal(resolveTestCalculations(rows).get("mchc")?.config.formulaId, "mchc");
  }
});

test("a persisted approved binding is preferred, and a PENDING persisted status is preserved", () => {
  const bound = cbc.map((row) => row.parameterId === "mch" ? { ...row, calculation: { formulaId: "mch", dependencyIds: ["hb", "rbc"], precision: 3, overwrite: "NEVER" } } : row);
  const resolved = resolveTestCalculations(bound);
  assert.deepEqual(resolved.get("mch"), { config: { formulaId: "mch", dependencyIds: ["hb", "rbc"], precision: 3, overwrite: "NEVER" }, status: "APPROVED" });
  const pending = cbc.map((row) => row.parameterId === "mch" ? { ...row, calculation: { formulaId: "mch", dependencyIds: ["hb", "rbc"] }, calculationStatus: "PENDING" as const } : row);
  assert.equal(resolveTestCalculations(pending).get("mch")?.status, "PENDING");
});

test("TEXT-typed CBP and HAEMOGRAM parameters never auto-resolve (no TEXT→NUMBER guessing)", () => {
  const cbp = [p("h", "Haemoglobin", "Grams %", "TEXT"), p("r", "Red Cell Count", "mill/cumm", "TEXT"), p("pc", "Hematocrit ( PCV )", "Vol %", "TEXT"), p("m", "Mean Corpuscular Hemoglobin(MCH)", "pg", "TEXT")];
  assert.equal(resolveTestCalculations(cbp).size, 0);
  const haemogram = [p("h", "Hemoglobin", "gms/dl", "TEXT"), p("r", "Red Cell Count", "mill/cumm", "TEXT"), p("pc", "P C V", "Vol%", "TEXT"), p("m", "M.C.H", "pg", "TEXT")];
  assert.equal(resolveTestCalculations(haemogram).size, 0);
});

test("ambiguous duplicate sources and missing units resolve to nothing rather than guessing", () => {
  const ambiguous = [...cbc, p("rbc2", "Red Cell Count", "×10⁶/µL")]; // two RBC-like sources
  assert.equal(resolveTestCalculations(ambiguous).get("mch"), undefined);
  assert.equal(resolveTestCalculations(ambiguous).get("pcv"), undefined);
  const missingUnit = cbc.map((row) => row.parameterId === "rbc" ? { ...row, unit: undefined } : row);
  assert.equal(resolveTestCalculations(missingUnit).get("mch"), undefined, "unknown units are never treated as known");
});

test("registry approval gates execution: the CBC formulas are APPROVED, the reciprocal and RDW stay BLOCKED", () => {
  assert.equal(formulaApproval("mch"), "APPROVED");
  assert.equal(formulaApproval("mchc"), "APPROVED");
  assert.equal(formulaApproval("pcv"), "APPROVED");
  assert.equal(formulaApproval("mcv"), "BLOCKED");
  assert.equal(formulaApproval("rdw"), "BLOCKED");
  assert.equal(hasDuplicateCalculationSources(["a", "a"]), true);
});
