import test from "node:test";
import assert from "node:assert/strict";
import { roundCalculationValue, normalizeCalculationUnit } from "./configured-calculations";
test("CBC exponent spellings preserve their magnitude and never equate thousands with cells",()=>{
 assert.equal(normalizeCalculationUnit("×10⁶/µL"),"million/ul");
 assert.equal(normalizeCalculationUnit("×10³/µL"),"thousand/ul");
 assert.notEqual(normalizeCalculationUnit("×10³/µL"),normalizeCalculationUnit("cells/µL"));
});
test("half-up rounding handles decimal ties, negative differences and exponent notation",()=>{
 assert.equal(roundCalculationValue(1.005,2),1.01);
 assert.equal(roundCalculationValue(-1.005,2),-1.01);
 assert.equal(roundCalculationValue(33.333333333333336,2),33.33);
 assert.equal(roundCalculationValue(1e-7,6),0);
 assert.equal(roundCalculationValue(1e21,2),1e21);
 assert(Number.isNaN(roundCalculationValue(30,7)));
});
