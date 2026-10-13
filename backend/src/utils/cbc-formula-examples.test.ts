import test from "node:test";
import assert from "node:assert/strict";
import { recalculateConfigured, type CalculationParameter } from "./configured-calculations";

/** Synthetic sources only; units are the catalogue spellings the engine normalises. */
const sources: CalculationParameter[] = [
  { parameterId: "rbc", parameterName: "Red Cell Count", unit: "million/µL" },
  { parameterId: "mcvSrc", parameterName: "MCV", unit: "fL" },
  { parameterId: "hb", parameterName: "Haemoglobin", unit: "g/dL" },
  { parameterId: "sd", parameterName: "RBC volume SD", unit: "fL" },
];
const target = (
  parameterId: string,
  unit: string,
  formulaId: string,
  dependencyIds: string[],
  precision = 2,
): CalculationParameter => ({
  parameterId,
  parameterName: parameterId,
  unit,
  calculation: { formulaId, dependencyIds, precision, sourceVerification:formulaId==="rdw"?"Synthetic RBC volume-distribution SD fixture":undefined },
});

test("PCV = RBC count × MCV ÷ 10 → 5 × 90 ÷ 10 = 45 %", () => {
  const p = [...sources, target("pcv", "%", "pcv", ["rbc", "mcvSrc"])];
  const result = recalculateConfigured(p, { rbc: 5, mcvSrc: 90 });
  assert.deepEqual(result.errors, {});
  assert.equal(result.values.pcv, 45);
});

test("MCV = PCV × 10 ÷ RBC count → 45 × 10 ÷ 5 = 90 fL", () => {
  const p = [...sources, target("pcv", "%", "pcv", ["rbc", "mcvSrc"]), target("mcv", "fL", "mcv", ["pcv", "rbc"], 0)];
  const result = recalculateConfigured(p, { rbc: 5, mcvSrc: 90 });
  assert.deepEqual(result.errors, {});
  assert.equal(result.values.mcv, 90);
});

test("MCH = Hemoglobin × 10 ÷ RBC count → 15 × 10 ÷ 5 = 30 pg", () => {
  const p = [...sources, target("mch", "pg", "mch", ["hb", "rbc"])];
  const result = recalculateConfigured(p, { hb: 15, rbc: 5 });
  assert.deepEqual(result.errors, {});
  assert.equal(result.values.mch, 30);
});

test("MCHC = Hemoglobin × 100 ÷ PCV → 15 × 100 ÷ 45 = 33.33 g/dL at two decimals", () => {
  const p = [...sources, target("pcv", "%", "pcv", ["rbc", "mcvSrc"]), target("mchc", "g/dL", "mchc", ["hb", "pcv"])];
  const result = recalculateConfigured(p, { rbc: 5, mcvSrc: 90, hb: 15 });
  assert.deepEqual(result.errors, {});
  assert.equal(result.values.pcv, 45);
  assert.equal(result.values.mchc, 33.33);
});

test("RDW-CV = RBC volume SD ÷ MCV × 100 → 13.5 ÷ 90 × 100 = 15 %", () => {
  const p = [...sources, target("rdw", "%", "rdw", ["sd", "mcvSrc"])];
  const result = recalculateConfigured(p, { sd: 13.5, mcvSrc: 90 });
  assert.deepEqual(result.errors, {});
  assert.equal(result.values.rdw, 15);
});

test("RDW-CV uses only its approved SD source and refuses a substituted MCV or count", () => {
  const p = [...sources, target("rdw", "%", "rdw", ["sd", "mcvSrc"])];
  for (const values of [{ mcvSrc: 90 }, { mcvSrc: 90, rbc: 5, hb: 15 }, { mcvSrc: 90, sd: "" }, { mcvSrc: 90, sd: "abc" }]) {
    const result = recalculateConfigured(p, values);
    assert.ok(result.errors.rdw, `RDW must fail for ${JSON.stringify(values)}`);
    assert.equal(result.values.rdw, "");
  }
});

test("a binding without explicit source IDs never resolves and fails closed", () => {
  const p = [...sources, { parameterId: "mch", parameterName: "MCH", unit: "pg", calculation: { formulaId: "mch" } }];
  const result = recalculateConfigured(p, { hb: 15, rbc: 5, mch: 77 });
  assert.ok(result.errors.mch);
  assert.equal(result.values.mch, "");
});

test("RDW-CV stays blocked even with matching fL units until source provenance is verified",()=>{
 const p=[...sources,{...target("rdw","%","rdw",["sd","mcvSrc"]),calculation:{formulaId:"rdw",dependencyIds:["sd","mcvSrc"]}}];
 const result=recalculateConfigured(p,{sd:13.5,mcvSrc:90});
 assert.match(result.errors.rdw,/blocked/);assert.equal(result.values.rdw,"");
});
