import test from "node:test";
import assert from "node:assert/strict";
import { businessDateInput, businessDayStart, businessDateLabel, businessTimeInput } from "../../../backend/src/utils/business-date.ts";

test("all months, date-only values and invalid dates preserve the intended business calendar",()=>{
 const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sept","Oct","Nov","Dec"];
 months.forEach((month,index)=>{const value=`2026-${String(index+1).padStart(2,"0")}-15`;assert.equal(businessDateInput(value),value);assert.match(businessDateLabel(value),new RegExp(month));});
 for(const value of ["2026-02-30","2026-13-01","invalid"]) {assert.equal(businessDateInput(value),"");assert.equal(businessDateLabel(value),"—");}
 assert.equal(businessDayStart("2026-02-30"),undefined);
});
test("UTC and India month/year boundaries map to the correct day without timestamp mutation",()=>{
 const instant=new Date("2026-12-31T20:00:00Z");const original=instant.getTime();
 assert.equal(businessDateInput(instant),"2027-01-01");assert.equal(businessTimeInput(instant),"01:30");assert.equal(instant.getTime(),original);
 assert.equal(businessDayStart("2026-10-11")?.toISOString(),"2026-10-10T18:30:00.000Z");
});
