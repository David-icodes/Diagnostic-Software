import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyResult,
  classifyResultInRange,
  normalizeRangeText,
  resolveRangeForGender,
} from "./reference-range.ts";

describe("normalizeRangeText", () => {
  it("converts HTML breaks and escaped newlines into real newlines", () => {
    assert.equal(
      normalizeRangeText("Male :30-63mg/dl<br/>Female :35-75mg/dl"),
      "Male :30-63mg/dl\nFemale :35-75mg/dl",
    );
    assert.equal(
      normalizeRangeText("Male :30-63mg/dl\\nFemale :35-75mg/dl"),
      "Male :30-63mg/dl\nFemale :35-75mg/dl",
    );
    assert.equal(normalizeRangeText("a<br>b"), "a\nb");
  });

  it("leaves plain text untouched", () => {
    assert.equal(normalizeRangeText("0.0 - 17.0 mg/dl"), "0.0 - 17.0 mg/dl");
    assert.equal(normalizeRangeText(""), "");
  });
});

describe("resolveRangeForGender", () => {
  it("resolves a male line for a male patient", () => {
    const range = resolveRangeForGender(
      "Male :13.0-17.0\nFemale :12.0-15.0",
      "Male",
    );
    assert.equal(range.kind, "gender");
    assert.equal(range.appliesTo, "M");
    assert.equal(range.text, "13.0-17.0");
    assert.equal(range.comparable, true);
    assert.deepEqual(range.bounds, { from: 13, to: 17 });
  });

  it("resolves a female line for a female patient", () => {
    const range = resolveRangeForGender(
      "Male :13.0-17.0\nFemale :12.0-15.0",
      "female",
    );
    assert.equal(range.appliesTo, "F");
    assert.equal(range.text, "12.0-15.0");
    assert.deepEqual(range.bounds, { from: 12, to: 15 });
  });

  it("supports the M / F line format from the source", () => {
    const male = resolveRangeForGender("M 0.9-1.5mg/dL\nF 0.6-1.3mg/dL", "M");
    assert.equal(male.text, "0.9-1.5mg/dL");
    assert.deepEqual(male.bounds, { from: 0.9, to: 1.5 });
    const female = resolveRangeForGender("M 0.9-1.5mg/dL\nF 0.6-1.3mg/dL", "F");
    assert.equal(female.text, "0.6-1.3mg/dL");
    assert.deepEqual(female.bounds, { from: 0.6, to: 1.3 });
  });

  it("supports the inline (M) / (F) master-catalog format", () => {
    const range = resolveRangeForGender(
      "13.0–17.0 (M) / 12.0–15.0 (F)",
      "Female",
    );
    assert.equal(range.appliesTo, "F");
    assert.deepEqual(range.bounds, { from: 12, to: 15 });
  });

  it("keeps the full source text and does not compare when sex is unknown", () => {
    const range = resolveRangeForGender(
      "Male :13.0-17.0\nFemale :12.0-15.0",
      undefined,
    );
    assert.equal(range.comparable, false);
    assert.equal(
      range.text,
      "Male :13.0-17.0\nFemale :12.0-15.0",
      "must display the complete source, not a guess",
    );
    assert.match(range.note ?? "", /recorded sex/i);
  });

  it("does not compare when only the other sex is listed", () => {
    const range = resolveRangeForGender("Males : upto 45 U/L", "F");
    assert.equal(range.comparable, false);
    assert.equal(range.text, "Males : upto 45 U/L");
  });

  it("never compares a range that also depends on age", () => {
    const range = resolveRangeForGender(
      "Male :0.9-1.5mg/dL\nFemale :0.8-1.3mg/dL\nChild :0-0mg/dL",
      "Male",
    );
    assert.equal(range.kind, "conditional");
    assert.equal(range.comparable, false);
    assert.match(range.text, /Child :0-0mg\/dL/);
  });

  it("never compares an age-conditioned range", () => {
    for (const text of [
      "<16 yrs upto 369 IU/L",
      "6.3 - 21.5 :<1 Months",
      "15.0 – 68.0 : 11 – 17 Yrs",
      "Follicular Phase:0.2-1.6",
      "3rd - 5th Day : Upto 13.0",
      "Adult 40 – 120 IU/L",
    ]) {
      const range = resolveRangeForGender(text, "Male");
      assert.equal(range.comparable, false, `must not compare: ${text}`);
      assert.equal(range.text, text);
    }
  });

  it("never compares categorical banding", () => {
    for (const text of [
      "<200 : Desirable\n200-239 : Boderline isk\n>240 : High risk",
      "80% - 100% : Normal",
      "Induration < 5 mm :Negative",
      "<10 Negative\n10-30 Weakly Positive\n>30 Positive",
    ]) {
      const range = resolveRangeForGender(text, "Male");
      assert.equal(range.comparable, false, `must not compare: ${text}`);
    }
  });

  it("never compares a bare number or a unit-only placeholder", () => {
    for (const text of ["13.5", "00", "ml", "Million/ml", "minutes", "0-0gms/dl"]) {
      const range = resolveRangeForGender(text, "Male");
      assert.equal(range.comparable, false, `must not compare: ${text}`);
    }
  });

  it("never compares titre / dilution notation", () => {
    for (const text of ["<1:80", "< 1:80", "Non - Reactive"]) {
      const range = resolveRangeForGender(text, "Male");
      assert.equal(range.comparable, false, `must not compare: ${text}`);
    }
  });

  it("reports an empty range without inventing one", () => {
    const range = resolveRangeForGender("   ", "Male");
    assert.equal(range.kind, "empty");
    assert.equal(range.text, "");
    assert.equal(range.comparable, false);
  });

  it("never splits a slash inside units such as cells/hpf", () => {
    const range = resolveRangeForGender("0-3 cells/hpf", "Male");
    assert.equal(range.kind, "numeric");
    assert.deepEqual(range.bounds, { from: 0, to: 3 });
  });

  it("orders descending source bounds before comparing", () => {
    const range = resolveRangeForGender("60-30 mg/dL", "Male");
    assert.deepEqual(range.bounds, { from: 30, to: 60 });
  });
});

describe("classifyResult", () => {
  it("keeps values inside a two-sided range unflagged", () => {
    assert.equal(classifyResultInRange(7, "4.0-11.0").status, "in-range");
    assert.equal(classifyResultInRange(4, "4.0-11.0").status, "in-range");
    assert.equal(classifyResultInRange(11, "4.0-11.0").status, "in-range");
  });

  it("flags values outside a two-sided range", () => {
    assert.equal(classifyResultInRange(11.4, "4.0-11.0").status, "out-of-range");
    assert.equal(classifyResultInRange(3.6, "4.0-11.0").status, "out-of-range");
    assert.deepEqual(classifyResultInRange(3.6, "4.0-11.0").bounds, {
      from: 4,
      to: 11,
    });
  });

  it("treats '<' as strict and '>' as strict", () => {
    assert.equal(classifyResultInRange(139, "<140 mg/dL").status, "in-range");
    assert.equal(classifyResultInRange(140, "<140 mg/dL").status, "out-of-range");
    assert.equal(classifyResultInRange(150, "<140 mg/dL").status, "out-of-range");
    assert.equal(classifyResultInRange(41, ">40").status, "in-range");
    assert.equal(classifyResultInRange(40, ">40").status, "out-of-range");
  });

  it("treats 'upto' as an inclusive upper bound", () => {
    assert.equal(classifyResultInRange(20, "Upto 20 IU/ml").status, "in-range");
    assert.equal(classifyResultInRange(20.4, "Upto 20 IU/ml").status, "out-of-range");
    assert.equal(classifyResultInRange(5, "UP TO 5.0").status, "in-range");
  });

  it("compares comma-decimal results", () => {
    assert.equal(classifyResultInRange("7,4", "4.0-11.0").status, "in-range");
    assert.equal(classifyResultInRange("12,4", "4.0-11.0").status, "out-of-range");
  });

  it("does not flag non-numeric or blank input", () => {
    const range = resolveRangeForGender("4.0-11.0", "Male");
    for (const value of ["", "  ", "Negative", "abc", null, undefined, true]) {
      assert.equal(classifyResult(value, range).status, "not-comparable");
    }
  });

  it("does not flag values against an unresolvable range", () => {
    assert.equal(classifyResultInRange(13, "13.5").status, "not-comparable");
    assert.equal(
      classifyResultInRange(13, "Male :13.0-17.0\nFemale :12.0-15.0").status,
      "not-comparable",
    );
  });

  it("flags an out-of-range result for the patient's own sex", () => {
    assert.equal(classifyResultInRange(18.4, "Male :13.0-17.0\nFemale :12.0-15.0", "M").status, "out-of-range");
    assert.equal(classifyResultInRange(11.6, "Male :13.0-17.0\nFemale :12.0-15.0", "F").status, "out-of-range");
    assert.equal(classifyResultInRange(14.5, "Male :13.0-17.0\nFemale :12.0-15.0", "F").status, "in-range");
  });
});