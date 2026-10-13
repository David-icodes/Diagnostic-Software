import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {routeParameterVersions,recordedParameterProjection} from "./parameter-version-routing";

const old={_id:"old",active:true,resultType:"TEXT",unit:"gm/dL"};
const numeric={_id:"new",active:true,resultType:"NUMBER",unit:"gm/dL",lineage:{originalId:"old",predecessorId:"old",version:2,manifestReference:"synthetic-manifest"}};
test("unpinned pending orders remain legacy; prospective pins choose exactly one numeric version",()=>{
 assert.deepEqual(routeParameterVersions([old,numeric],undefined),[old]);
 assert.deepEqual(routeParameterVersions([old,numeric],["new"]),[numeric]);
 assert.deepEqual(routeParameterVersions([{...old,active:false},numeric],["old"]),[{...old,active:false}]);
});
test("routing refuses duplicate logical versions, missing pins, orphan lineage and historical conflicts",()=>{
 for(const pins of [["old","new"],["new","new"],["missing"]])assert.throws(()=>routeParameterVersions([old,numeric],pins));
 assert.throws(()=>routeParameterVersions([old,numeric],["new"],[{parameterId:"old"}]));
 assert.throws(()=>routeParameterVersions([numeric],["new"]));
 assert.throws(()=>routeParameterVersions([old,numeric],undefined,[{parameterId:"new"}]));
});
test("seven synthetic historical CBP records retain exact content, IDs, units, revisions and report metadata",()=>{
 const rows=Array.from({length:7},(_,i)=>({parameterId:"old",parameterName:"Legacy MCHC",resultType:"TEXT",unit:"gm/dL",method:"Original method",referenceRange:"original range",result:i===0?"30.00":"text "+i,revisions:[{result:"earlier",version:1}],version:2}));
 const hash=()=>createHash("sha256").update(JSON.stringify(rows)).digest("hex");const before=hash();
 for(const row of rows){assert.equal(routeParameterVersions([old,numeric],["old"],[row])[0]._id,"old");
  const projection=recordedParameterProjection({...old,parameterName:"Changed master",method:"New",referenceRange:"new"},row);
  assert.equal(projection.parameterName,row.parameterName);assert.equal(projection.unit,"gm/dL");assert.equal(projection.resultType,"TEXT");assert.equal(projection.method,"Original method");assert.equal(projection.referenceRange,"original range");}
 assert.equal(hash(),before);
});
test("rollback never deletes recorded successor results; dropping pins fails closed once successor is saved",()=>{
 assert.deepEqual(routeParameterVersions([old,numeric],undefined),[old]);
 assert.throws(()=>routeParameterVersions([old,numeric],undefined,[{parameterId:"new"}]));
 assert.deepEqual(routeParameterVersions([old,numeric],["new"],[{parameterId:"new"}]),[numeric]);
});
