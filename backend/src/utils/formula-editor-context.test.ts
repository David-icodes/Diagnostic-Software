import test from "node:test";
import assert from "node:assert/strict";
import {formulaEditorContextAllowed} from "./formula-editor-context";
import {DEVELOPMENT_DATABASE,DEVELOPMENT_URI} from "./development-database-guard";
test("expression edits require the exact development host/database and matching synthetic patient/bill identifiers",()=>{
 const context={environment:"development",uri:DEVELOPMENT_URI,database:DEVELOPMENT_DATABASE,host:"127.0.0.1",billNumber:"DEV-EDITOR-1234abcd",patientCode:"DEV-EDITOR-1234abcd"};
 assert.equal(formulaEditorContextAllowed(context),true);
 for(const changed of [{environment:"production"},{environment:"test"},{uri:"mongodb://127.0.0.1:27017/diagnostic_lis"},{host:"atlas"},{database:"diagnostic_lis"},{billNumber:"OSP202600114"},{patientCode:"GP20263571"},{patientCode:undefined},{database:undefined}])assert.equal(formulaEditorContextAllowed({...context,...changed}),false);
});
