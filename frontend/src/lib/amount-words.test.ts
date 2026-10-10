import { it } from "node:test";
import assert from "node:assert/strict";
import { rupeesInWords } from "./amount-words.ts";

it("invoice amount words use actual rupees and paise including carry and zero", () => {
  assert.equal(rupeesInWords(1080), "One Thousand Eighty Rupees Only");
  assert.equal(rupeesInWords(250.50), "Two Hundred Fifty Rupees and Fifty Paise Only");
  assert.equal(rupeesInWords(0), "Zero Rupees Only");
  assert.equal(rupeesInWords(1.999), "Two Rupees Only");
  assert.equal(rupeesInWords(12345678), "One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Rupees Only");
  for (const amount of [NaN, Infinity, -1]) assert.equal(rupeesInWords(amount), "");
});
