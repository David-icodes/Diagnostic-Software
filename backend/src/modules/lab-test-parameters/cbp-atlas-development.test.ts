import test from "node:test";
import assert from "node:assert/strict";
import {assertCBPAtlasDevelopment,CBP_DEVELOPMENT_TEST,CBP_DEVELOPMENT_IDS,cbpDevelopmentDrafts} from "./cbp-atlas-development.service";
const uri="mongodb+srv://cluster0.aqyakc9.mongodb.net/diagnostic_lis_development_20261012";
test("named Atlas CBP preparation accepts only exact development environment and test",()=>{assert.doesNotThrow(()=>assertCBPAtlasDevelopment("development",uri,"diagnostic_lis_development_20261012",CBP_DEVELOPMENT_TEST));assert.equal(new Set(CBP_DEVELOPMENT_IDS).size,6);});
test("production, wrong cluster, wrong runtime database and unrelated tests fail before access",()=>{
 for(const [environment,url,database,id] of [["production",uri,"diagnostic_lis_development_20261012",CBP_DEVELOPMENT_TEST],["development",uri,"diagnostic_lis",CBP_DEVELOPMENT_TEST],["development",uri.replace("cluster0.aqyakc9","other"),"diagnostic_lis_development_20261012",CBP_DEVELOPMENT_TEST],["development",uri,"diagnostic_lis_development_20261012","other"],["development","invalid","diagnostic_lis_development_20261012",CBP_DEVELOPMENT_TEST]])assert.throws(()=>assertCBPAtlasDevelopment(environment,url,database,id),/Unexpected/);
});

test("prepared bindings use exact numeric successors, stay disabled and contain no approval",()=>{
 const versions=CBP_DEVELOPMENT_IDS.map((id,i)=>({_id:String(i),lineage:{originalId:id}}));const drafts=cbpDevelopmentDrafts(versions);assert.equal(drafts.length,4);assert.deepEqual(drafts.map(d=>d.calculation.dependencyIds),[['0'],['0','1'],['2','1'],['0','2']]);assert.deepEqual(drafts.map(d=>d.calculation.formulaId),['pcv-hb-approx','mch','mcv','mchc']);for(const d of drafts){assert.equal(d.calculation.enabled,false);assert.equal(d.clinicalApproval,false);assert.equal(d.status,'PENDING');}assert.throws(()=>cbpDevelopmentDrafts(versions.slice(1)),/Incomplete/);
});
