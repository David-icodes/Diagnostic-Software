import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GENDER_OPTIONS,
  PATIENT_TITLES,
  genderFromTitle,
  genderLabel,
  genderToStoredValue,
  resolveGenderForTitleChange,
} from "./patient-title.ts";

describe("genderFromTitle", () => {
  it("maps the male titles defined by the project", () => {
    assert.equal(genderFromTitle("Mr."), "Male");
    assert.equal(genderFromTitle("Master."), "Male");
    assert.equal(genderFromTitle("Baby_Boy."), "Male");
  });

  it("maps the female titles defined by the project", () => {
    assert.equal(genderFromTitle("Miss."), "Female");
    assert.equal(genderFromTitle("Mrs."), "Female");
    assert.equal(genderFromTitle("Ms."), "Female");
    assert.equal(genderFromTitle("Baby_Girl."), "Female");
  });

  it("returns null for titles that do not determine a gender", () => {
    assert.equal(genderFromTitle("Dr."), null);
    assert.equal(genderFromTitle("Baby."), null);
    assert.equal(genderFromTitle("Baby_Of."), null);
    assert.equal(genderFromTitle("--Select--"), null);
    assert.equal(genderFromTitle(""), null);
    assert.equal(genderFromTitle("Prince."), null);
  });

  it("accepts titles stored without the trailing dot", () => {
    assert.equal(genderFromTitle("Mr"), "Male");
    assert.equal(genderFromTitle("mrs"), "Female");
    assert.equal(genderFromTitle("baby_boy"), "Male");
  });

  it("never infers a gender from anything other than the title", () => {
    // A name is not evidence: an empty title must stay undecided.
    assert.equal(genderFromTitle(""), null);
  });
});

describe("resolveGenderForTitleChange", () => {
  it("sets the gender when the title implies one", () => {
    const result = resolveGenderForTitleChange({
      title: "Mrs.",
      currentGender: "Male",
      impliedGender: null,
    });
    assert.equal(result.gender, "Female");
    assert.equal(result.impliedGender, "Female");
  });

  it("clears a stale implied gender when the title implies none", () => {
    const result = resolveGenderForTitleChange({
      title: "Dr.",
      currentGender: "Male",
      impliedGender: "Male",
    });
    assert.equal(result.gender, "");
    assert.equal(result.impliedGender, null);
  });

  it("keeps a manually chosen gender when the title implies none", () => {
    const result = resolveGenderForTitleChange({
      title: "Dr.",
      currentGender: "Female",
      impliedGender: null,
    });
    assert.equal(result.gender, "Female");
  });

  it("walks the full title sequence without a stale value surviving", () => {
    let gender = "";
    let implied: "Male" | "Female" | null = null;

    const choose = (title: string) => {
      const result = resolveGenderForTitleChange({
        title,
        currentGender: gender,
        impliedGender: implied,
      });
      gender = result.gender;
      implied = result.impliedGender;
    };

    choose("Mr.");
    assert.equal(gender, "Male");

    // The reported bug: switching to a female title must not keep "Male".
    choose("Mrs.");
    assert.equal(gender, "Female");

    // Switching back must not keep "Female".
    choose("Mr.");
    assert.equal(gender, "Male");

    // A neutral title drops only the implied value.
    choose("Baby_Of.");
    assert.equal(gender, "");

    choose("Baby_Boy.");
    assert.equal(gender, "Male");

    choose("--Select--");
    assert.equal(gender, "");
  });
});

describe("gender label conversion", () => {
  it("converts stored gender values to display labels", () => {
    assert.equal(genderLabel("male"), "Male");
    assert.equal(genderLabel("female"), "Female");
    assert.equal(genderLabel("other"), "");
  });

  it("converts display labels back to stored values", () => {
    assert.equal(genderToStoredValue("Male"), "male");
    assert.equal(genderToStoredValue("Female"), "female");
    assert.equal(genderToStoredValue(""), "");
  });

  it("round-trips the two project genders", () => {
    for (const gender of ["Male", "Female"] as const) {
      assert.equal(genderLabel(genderToStoredValue(gender)), gender);
    }
  });
});

describe("title option list", () => {
  it("keeps the unselected option and both mapped genders", () => {
    assert.equal(PATIENT_TITLES[0], "--Select--");
    assert.deepEqual(GENDER_OPTIONS, ["", "Female", "Male"]);
  });
});