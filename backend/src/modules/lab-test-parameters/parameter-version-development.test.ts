import test from "node:test";
import assert from "node:assert/strict";
import {LabTestParameter} from "../../models/lab-test-parameter.model";
import {ParameterVersion,ParameterCutover} from "../../models/parameter-version.model";
import {LabBill} from "../../models/lab-bill.model";
import {createNumericVersion,prepareVersionCutover,changeVersionCutover,createVersionedFixtureOrder,parameterClinicalHash} from "./parameter-version-development.service";

test("separate version store preserves the original unique-name index and disables automatic collection writes",()=>{
 assert(LabTestParameter.schema.indexes().some(([keys,options])=>keys.testId===1&&keys.parameterName===1&&options.unique));
 assert(!ParameterVersion.schema.indexes().some(([keys])=>keys.parameterName));
 assert(ParameterVersion.schema.indexes().some(([keys,options])=>keys["lineage.originalId"]===1&&keys["lineage.version"]===1&&options.unique));
 for(const schema of [ParameterVersion.schema,ParameterCutover.schema]){assert.equal(schema.options.autoCreate,false);assert.equal(schema.options.autoIndex,false);}
 const original=LabTestParameter.hydrate({unit:"Synthetic original unit"});original.unit="Synthetic edited unit";assert.equal(original.unit,"Synthetic edited unit","Cloned version immutability must not affect the original model");
});
test("prospective version clinical fields and lineage are immutable",()=>{
 const fields={parameterName:"Synthetic",resultType:"NUMBER",unit:"gm/dL",method:"Historical",referenceRange:"1-2",lineage:{originalId:"old",predecessorId:"old",version:2,manifestReference:"Synthetic"},versionClinicalHash:"abc"};
 const document=ParameterVersion.hydrate(fields);
 for(const path of Object.keys(fields)){const before=JSON.stringify(document.get(path));document.set(path,path==="lineage"?{...fields.lineage,manifestReference:"Changed"}:"Changed");assert.equal(JSON.stringify(document.get(path)),before,path+" changed after hydration");}
});
test("clinical hashes detect type/unit/range/method/name drift while ignoring actor and timestamp metadata",()=>{
 const source={parameterName:"Synthetic",resultType:"TEXT",unit:"gm/dL",method:"Original",referenceRange:"1-2",createdAt:new Date(),createdBy:"a"};
 const original=parameterClinicalHash(source);
 assert.equal(parameterClinicalHash({...source,createdAt:new Date(0),createdBy:"b"}),original);
 for(const change of [{resultType:"NUMBER"},{unit:"g/dL"},{method:"Different"},{referenceRange:"2-3"},{parameterName:"Other"}])assert.notEqual(parameterClinicalHash({...source,...change}),original);
});
test("all development mutation entry points reject production/unowned context before model writes",async t=>{
 let writes=0;t.mock.method(ParameterVersion,"create",()=>{writes++;throw new Error("Unexpected write");});t.mock.method(ParameterCutover,"create",()=>{writes++;throw new Error("Unexpected write");});t.mock.method(LabBill,"create",()=>{writes++;throw new Error("Unexpected write");});
 const previous=process.env.NODE_ENV;try{process.env.NODE_ENV="production";const context={database:"diagnostic_lis",marker:"not-owned"};
  await assert.rejects(createNumericVersion(context,{originalId:"a",expectedHash:"b",manifestReference:"c",actorId:"d"}),/restricted/);
  await assert.rejects(prepareVersionCutover(context,{testId:"a",parameterIds:[],effectiveFrom:new Date(),manifestReference:"c",actorId:"d"}),/restricted/);
  await assert.rejects(changeVersionCutover(context,"a",1,"d"),/restricted/);
  await assert.rejects(createVersionedFixtureOrder(context,{} as never),/restricted/);
 }finally{process.env.NODE_ENV=previous;}
 assert.equal(writes,0);
});
