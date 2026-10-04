import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeParameterName,
  resolveCalculations,
  roundCalculatedValue,
  type CalcParameter,
  type CalcValueMap,
} from "./parameter-calculator.ts";

function p(parameterId: string, parameterName: string): CalcParameter {
  return { parameterId, parameterName };
}

/** The calculation that writes to `targetId`, or undefined. */
function calcFor(list: CalcParameter[], targetId: string) {
  return resolveCalculations(list).find((c) => c.parameterId === targetId);
}

function value(list: CalcParameter[], targetId: string, values: CalcValueMap): number | string {
  const calc = calcFor(list, targetId);
  assert.ok(calc, `expected a calculator for ${targetId}`);
  const result = calc!.run(values);
  return result.ok ? result.value : result.error;
}

describe("normalizeParameterName", () => {
  it("ignores case, punctuation and repeated whitespace", () => {
    assert.equal(normalizeParameterName("Mean Corpuscular Volume(MCV)"), "mean corpuscular volume mcv");
    assert.equal(normalizeParameterName("  Red   Cell Count "), "red cell count");
    assert.equal(normalizeParameterName("Hematocrit ( PCV )"), "hematocrit pcv");
  });
});

describe("roundCalculatedValue", () => {
  it("caps at two decimals and keeps integers", () => {
    assert.equal(roundCalculatedValue(33.333333333333336), 33.33);
    assert.equal(roundCalculatedValue(45), 45);
    assert.equal(roundCalculatedValue(4800), 4800);
  });
});

describe("PCV = RBC × MCV / 10", () => {
  const list = [p("pcv", "Hematocrit ( PCV )"), p("rbc", "Red Cell Count"), p("mcv", "Mean Corpuscular Volume(MCV)")];
  it("calculates 5 x 90 / 10 = 45", () => {
    assert.equal(value(list, "pcv", { rbc: "5", mcv: "90" }), 45);
  });
  it("accepts decimals", () => {
    assert.equal(value(list, "pcv", { rbc: 4.5, mcv: 88 }), 39.6);
  });
  it("does not calculate when a dependency is missing", () => {
    assert.match(String(value(list, "pcv", { rbc: "5" })), /Enter MCV first\./);
  });
});

describe("MCV = PCV × 10 / RBC", () => {
  const list = [p("mcv", "MCV"), p("pcv", "Hematocrit (PCV)"), p("rbc", "RBC Count")];
  it("calculates 45 x 10 / 5 = 90", () => {
    assert.equal(value(list, "mcv", { pcv: "45", rbc: "5" }), 90);
  });
  it("refuses a zero denominator", () => {
    assert.match(String(value(list, "mcv", { pcv: "45", rbc: "0" })), /denominator is zero/);
  });
});

describe("MCH = Hb × 10 / RBC", () => {
  const list = [p("mch", "Mean Corpuscular Hemoglobin(MCH)"), p("hb", "Hemoglobin (Hb)"), p("rbc", "RBC Count")];
  it("calculates 15 x 10 / 5 = 30", () => {
    assert.equal(value(list, "mch", { hb: "15", rbc: "5" }), 30);
  });
});

describe("MCHC = Hb × 100 / PCV", () => {
  const list = [p("mchc", "Mean Corpuscular Hemoglobin Concentration(MCHC)"), p("hb", "Haemoglobin"), p("pcv", "Hematocrit ( PCV )")];
  it("calculates 15 x 100 / 45 ≈ 33.33", () => {
    assert.equal(value(list, "mchc", { hb: "15", pcv: "45" }), 33.33);
  });
});

describe("RDW-CV = SD of RBC volume × 100 / MCV", () => {
  const list = [p("rdw", "Red Cell Distribution Width(RDW-CV)"), p("sd", "SD of RBC volume"), p("mcv", "MCV")];
  it("calculates 13 x 100 / 90 ≈ 14.44", () => {
    assert.equal(value(list, "rdw", { sd: "13", mcv: "90" }), 14.44);
  });
  it("is not offered when no SD parameter exists", () => {
    assert.equal(calcFor([p("rdw", "Red Cell Distribution Width(RDW-CV)"), p("mcv", "MCV")], "rdw"), undefined);
  });
});

describe("differential absolute counts (WBC × % / 100)", () => {
  const base = [p("wbc", "Total Leucocyte (WBC) count")];
  it("ANC = 8000 x 60 / 100 = 4800", () => {
    const list = [...base, p("anc", "Absolute Neutrophil Count"), p("neut", "Neutrophils")];
    assert.equal(value(list, "anc", { wbc: "8000", neut: "60" }), 4800);
  });
  it("ALC = 8000 x 30 / 100 = 2400", () => {
    const list = [...base, p("alc", "Absolute Lymphocyte Count"), p("lymph", "Lymphocytes")];
    assert.equal(value(list, "alc", { wbc: "8000", lymph: "30" }), 2400);
  });
  it("AMC = 8000 x 5 / 100 = 400", () => {
    const list = [...base, p("amc", "Absolute Monocyte Count"), p("mono", "Monocytes")];
    assert.equal(value(list, "amc", { wbc: "8000", mono: "5" }), 400);
  });
  it("AEC = 8000 x 3 / 100 = 240", () => {
    const list = [...base, p("aec", "Absolute Eosinophil Count"), p("eos", "Eosinophils")];
    assert.equal(value(list, "aec", { wbc: "8000", eos: "3" }), 240);
  });
  it("ABC = 8000 x 1 / 100 = 80", () => {
    const list = [...base, p("abc", "Absolute Basophil Count"), p("baso", "Basophils")];
    assert.equal(value(list, "abc", { wbc: "8000", baso: "1" }), 80);
  });
});

describe("calculator visibility", () => {
  it("does not offer a calculator for a plain parameter", () => {
    assert.equal(resolveCalculations([p("hb", "Hemoglobin"), p("plt", "Platelet Count")]).length, 0);
  });
  it("does not offer a calculator when a dependency name is ambiguous", () => {
    const list = [p("pcv1", "PCV"), p("pcv2", "PCV"), p("mcv", "MCV"), p("rbc", "RBC Count")];
    // Two parameters both named PCV: the MCV target cannot be resolved uniquely.
    assert.equal(calcFor(list, "mcv"), undefined);
  });
  it("resolves dependencies regardless of parameter order", () => {
    const list = [p("mcv", "MCV"), p("pcv", "PCV"), p("rbc", "RBC Count")];
    assert.equal(value(list, "mcv", { pcv: "45", rbc: "5" }), 90);
  });
});
