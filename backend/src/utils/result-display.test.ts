import test from "node:test";
import assert from "node:assert/strict";
import {resultDisplay,validNumericDisplay} from "./result-display";
import {LabTestResult} from "../models/lab-test-result.model";
import {submitResultsSchema} from "../validations/test-result";
import {cbcCountValueOnly,cbcSmearEmptyCells,reportCellText} from "./cbc-report-display";
test("entered decimal display survives request validation and model/revision round trips without changing numbers",()=>{
 for(const display of ["0","0.5","0.8","0.05","0.08","1.0","12.0","5.00","+0.50","-0.08",".5","001.00","1e-3", "0".repeat(250)+"12.0", "12."+"0".repeat(250)]){
  const result=Number(display); assert.ok(validNumericDisplay(result,display));
  const parsed=submitResultsSchema.parse({billId:"a".repeat(24),testId:"b".repeat(24),entries:[{parameterId:"c".repeat(24),result,resultDisplay:display}]});
  const row=new LabTestResult({...parsed.entries[0],revisions:[{result,resultDisplay:display,version:1,enteredAt:new Date(),enteredBy:"d".repeat(24)}]});
  const reopened=new LabTestResult(row.toObject());assert.equal(resultDisplay(reopened.result,reopened.resultDisplay),display);assert.equal(reopened.revisions[0].resultDisplay,display);
 }
 for(const display of ["", "not numeric", "1 pg", "Infinity", "12.01", " 12 "])assert.equal(validNumericDisplay(12,display),false);
 assert.equal(resultDisplay(12,"12.01"),"12"); assert.equal(resultDisplay("<0.5"),"<0.5");assert.equal(resultDisplay("<= 0.08\n> 1.0"),"<= 0.08\n> 1.0");
});
test("CBC value-only printing follows verified count IDs and lineage, never similar names or smear narratives",()=>{
 for(const id of ["ffb3e9c48662cc43921fa48d","2db8e6a9befd3a1950148465","8bb125bcc1b581978287edf4"]){assert.ok(cbcCountValueOnly({id}));assert.ok(cbcCountValueOnly({id:"successor",lineage:{originalId:id}}));}
 assert.ok(cbcCountValueOnly({catalogueImport:{sourceTestId:"2707",sourceParameterId:"1298"}}));
 for(const sourceParameterId of ["1307","1308","1309","1295"])assert.equal(cbcCountValueOnly({catalogueImport:{sourceTestId:"2707",sourceParameterId}}),false);
 assert.equal(cbcCountValueOnly({catalogueImport:{sourceTestId:"different",sourceParameterId:"1298"}}),false);
 assert.equal(cbcCountValueOnly({id:"unrelated"}),false);
});

test("only verified CBC smear rows suppress absent metadata, preserving configured ranges and numeric zero",()=>{
 for(const sourceParameterId of ["1307","1308","1309"]){assert.equal(cbcSmearEmptyCells({catalogueImport:{sourceTestId:"2707",sourceParameterId}}),true);assert.equal(cbcSmearEmptyCells({catalogueImport:{sourceTestId:"other",sourceParameterId}}),false);}
 assert.equal(cbcSmearEmptyCells({id:"unrelated"}),false);
 for(const value of [undefined,null,""]){assert.equal(reportCellText(value,true),"");assert.equal(reportCellText(value,false),"—");}
 assert.equal(reportCellText(0,true),"0");assert.equal(reportCellText("0–5",true),"0–5");assert.equal(reportCellText("cells/cumm",true),"cells/cumm");
});
