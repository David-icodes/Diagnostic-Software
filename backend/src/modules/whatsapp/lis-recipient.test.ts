import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeLisRecipient } from "./lis-recipient";

test("Indian recipients default to +91 exactly once", () => {
  for (const value of ["9876543210", "+919876543210", "919876543210", "98765 43210", "+91 (98765)-43210", "0091 9876543210"]) {
    assert.equal(normalizeLisRecipient(value), "+919876543210");
  }
});
test("valid international recipients retain their own country code", () => {
  for (const [value, expected] of [["+1 202-555-0123", "+12025550123"], ["442079460018", "+442079460018"], ["+65 9123 4567", "+6591234567"]]) {
    assert.equal(normalizeLisRecipient(value), expected);
  }
});
test("invalid, incomplete, duplicated codes and unexpected characters are rejected", () => {
  for (const value of ["", "+91", "98765", "0000000000", "+91+919876543210", "91919876543210", "+91919876543210", "call 9876543210", "9876543210 ext 1", "+9999876543210"]) {
    assert.throws(() => normalizeLisRecipient(value), /valid destination mobile/);
  }
});