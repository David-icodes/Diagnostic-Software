import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatorControlState,
  isCalculatorCandidate,
} from "./configured-calculations.ts";
import type { CalculationParameter } from "./configured-calculations.ts";

const param = (
  parameterName: string,
  extra: Partial<CalculationParameter> = {},
): CalculationParameter => ({ parameterId: parameterName, parameterName, ...extra });

test("candidate derived targets are eligible but unconfigured without a persisted binding", () => {
  for (const name of [
    "MCH",
    "MCV",
    "MCHC",
    "RDW-CV",
    "P C V",
    "M.C.H",
    "R.D.W",
    "Mean Corpuscular Hemoglobin(MCH)",
    "Mean Corpuscular Volume(MCV)",
    "Hematocrit ( PCV )",
    "Mean Corpuscular Hemoglobin Concentration(MCHC)",
    "Red Cell Distribution Width(RDW-CV)",
    "Indirect Bilirubin",
    "Globulin",
    "A/G Ratio",
    "Estimated Average Glucose (EAG)",
    "Absolute Eosinophil Count (AEC)",
  ]) {
    assert.deepEqual(
      calculatorControlState(param(name)),
      { status: "unconfigured" },
      `${name} should be an unconfigured candidate`,
    );
  }
});

test("measured source parameters are never calculator targets", () => {
  for (const name of [
    "Haemoglobin",
    "Red Cell Count",
    "Total Leucocyte (WBC) count",
    "Eosinophils",
    "Platelets",
    "Total Bilirubin",
    "Direct Bilirubin",
    "Albumin",
    "Total Proteins",
    "Creatinine",
    "Glycosylated Hemoglobin(HBA 1C)",
  ]) {
    assert.equal(isCalculatorCandidate(param(name)), false, `${name} must stay ineligible`);
    assert.deepEqual(calculatorControlState(param(name)), { status: "ineligible" });
  }
});

test("subtitles and text areas are never calculator targets", () => {
  assert.deepEqual(calculatorControlState(param("MCH", { itemType: "SUBTITLE" })), { status: "ineligible" });
  assert.deepEqual(calculatorControlState(param("MCH", { itemType: "TEXT_AREA" })), { status: "ineligible" });
});

test("a valid persisted binding makes a row configured regardless of target name", () => {
  assert.deepEqual(
    calculatorControlState(param("Synthetic MCH", { calculation: { formulaId: "mch", dependencyIds: ["hb", "rbc"] } })),
    { status: "configured" },
  );
  assert.deepEqual(
    calculatorControlState(param("Unnamed derived value", { calculation: { formulaId: "mch", dependencyIds: ["hb", "rbc"] } })),
    { status: "configured" },
  );
});

test("a binding with an unknown formula is not configured", () => {
  const state = calculatorControlState(
    param("MCH", { calculation: { formulaId: "does-not-exist", dependencyIds: [] } }),
  );
  assert.notEqual(state.status, "configured");
  assert.equal(state.status, "unconfigured");
});

test("lipid derived targets are visible but remain pending until laboratory approval", () => {
  for (const name of ["LDL Cholesterol", "VLDL", "CHOL/HDL RATIO", "LDL/HDL RATIO", "CHOL/TGL RATIO"]) {
    assert.equal(isCalculatorCandidate(param(name)), true, `${name} should be a candidate`);
    assert.deepEqual(calculatorControlState(param(name)), { status: "pending" }, `${name} requires approval`);
  }
});
