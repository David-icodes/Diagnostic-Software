import test from "node:test";
import assert from "node:assert/strict";
import {isReportNarrative, reportNarrative} from "./report-narrative.ts";
test("narratives preserve configured text, explicit overrides and intentional clears",()=>{
 const parameter={defaultValue:"Line 1  0.05\n<script>plain text</script>"};
 assert.equal(reportNarrative(parameter),parameter.defaultValue);
 assert.equal(reportNarrative(parameter,{result:"Entered\n12.0"}),"Entered\n12.0");
 assert.equal(reportNarrative(parameter,{result:""}),"");
 assert.equal(reportNarrative({}),"");
 assert.equal(isReportNarrative({itemType:"TEXT_AREA"}),true);
 assert.equal(isReportNarrative({resultType:"TEXTAREA"}),true);
 for(const resultType of ["NUMBER","TEXT","RANGE"])assert.equal(isReportNarrative({resultType}),false);
});
