import test from "node:test";
import assert from "node:assert/strict";
import {computationalUnit,bindingCoverage,verifyRestore,type RestoreEvidence} from "./calculator-release-gates";
test("exact-record unit evidence preserves approved display units and magnitude; no global legacy aliases",()=>{
 const record={parameterId:"synthetic-hb",unit:"Grams %"};const descriptor={...record,displayUnit:record.unit,canonicalUnit:"g/dl",scale:1,evidenceReference:"Synthetic test evidence only"};
 assert.equal(computationalUnit(record,descriptor),"g/dl");assert.equal(record.unit,"Grams %");
 for(const patch of [{parameterId:"another"},{displayUnit:"gms/dl"},{scale:1000},{evidenceReference:""}])assert.throws(()=>computationalUnit(record,{...descriptor,...patch}));
});
test("execution decisions require exact ordered IDs/settings and reuse one existing reference",()=>{
 const proposal={targetId:"mch",sourceIds:["hb","rbc"],formulaId:"mch",formulaVersion:"1",precision:2,rounding:"HALF_UP",overwrite:"CONFIRM"};const decision={...proposal,documentReference:"Synthetic SOP"};
 assert.deepEqual(bindingCoverage(proposal,[decision]),[]);
 assert.ok(bindingCoverage(proposal,[]).length);assert.ok(bindingCoverage(proposal,[decision,decision]).length);
 for(const patch of [{sourceIds:["rbc","hb"]},{precision:3},{overwrite:"NEVER"},{documentReference:""}])assert.ok(bindingCoverage(proposal,[{...decision,...patch}]).length);
});
const manifest:RestoreEvidence={sourceIdentity:"synthetic-source",boundary:"synthetic-fence",consistency:"WRITE_FENCE",consistencyVerified:true,isolated:true,outboundDisabled:true,operatorReference:"Synthetic rehearsal",collections:Object.fromEntries(["labtestresults","auditlogs","labbills","pdfassets"].map(k=>[k,{count:7,contentHash:"a".repeat(64),indexHash:"b".repeat(64),optionsHash:"c".repeat(64)}])),historicalResultHashes:Object.fromEntries(Array.from({length:7},(_,i)=>[String(i),"d".repeat(64)])),assets:{pdf:"e".repeat(64)}};
test("restore verifier checks seven histories, collections/indexes/options, audit history and assets",()=>{
 assert.deepEqual(verifyRestore(manifest,structuredClone(manifest)),[]);
 for(const mutate of [(m:RestoreEvidence)=>{m.outboundDisabled=false;},(m:RestoreEvidence)=>{m.collections.auditlogs.count--;},(m:RestoreEvidence)=>{m.collections.labtestresults.indexHash="changed";},(m:RestoreEvidence)=>{m.assets.pdf="f".repeat(64);},(m:RestoreEvidence)=>{delete m.historicalResultHashes["0"];}]){const restored=structuredClone(manifest);mutate(restored);assert.ok(verifyRestore(manifest,restored).length);}
 assert.ok(verifyRestore({...manifest,consistencyVerified:false},manifest).length);
});
