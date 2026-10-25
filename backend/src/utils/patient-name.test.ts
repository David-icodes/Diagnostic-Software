import test from "node:test";
import assert from "node:assert/strict";
import {
  formatPatientDisplayName,
  normalizePatientTitle,
  splitPatientTitle,
} from "./patient-name";

test("stored title and given/surname are formatted without rewriting the stored name", () => {
  const cases: Array<[string, Parameters<typeof formatPatientDisplayName>[0], string]> = [
    ["given name", { title: "Mr.", fullName: "PRAVEEN" }, "Mr. PRAVEEN"],
    ["given and surname", { title: "Mrs.", fullName: "T DEEPTHI PRASAD" }, "Mrs. T DEEPTHI PRASAD"],
    ["surname preserved from parts", { title: "Mr.", firstName: "T DEVENDRA", lastName: "PRASAD" }, "Mr. T DEVENDRA PRASAD"],
    ["legacy title is not duplicated", { title: "Mr.", fullName: "Mr. PRAVEEN" }, "Mr. PRAVEEN"],
    ["legacy title only", { fullName: "Baby Girl. ANANYA" }, "Baby Girl. ANANYA"],
    ["placeholder ignored", { title: "--Select--", fullName: "ANANYA" }, "ANANYA"],
    ["unknown title preserved", { title: "Prince.", fullName: "ARJUN" }, "Prince. ARJUN"],
  ];
  for (const [name, input, expected] of cases) {
    assert.equal(formatPatientDisplayName(input), expected, name);
  }
});

test("titles normalise but never infer a gender", () => {
  assert.equal(normalizePatientTitle("mr"), "Mr.");
  assert.equal(normalizePatientTitle("Baby_Boy."), "Baby Boy.");
  assert.equal(normalizePatientTitle("--Select--"), "");
  assert.deepEqual(splitPatientTitle("Dr. NEHA SHARMA"), { title: "Dr.", name: "NEHA SHARMA" });
});
