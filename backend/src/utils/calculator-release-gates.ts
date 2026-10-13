/** Pure evidence checks. No database, filesystem, configuration or approval writes. */
export interface UnitEvidence {parameterId:string;displayUnit:string;canonicalUnit:string;scale:number;evidenceReference:string}
export function computationalUnit(record:{parameterId:string;unit:string},descriptor:UnitEvidence):string {
 if(record.parameterId!==descriptor.parameterId||record.unit!==descriptor.displayUnit||!descriptor.evidenceReference.trim()||descriptor.scale!==1||!descriptor.canonicalUnit.trim())throw new Error("Unverified unit identity or unsupported magnitude conversion");
 return descriptor.canonicalUnit;
}
export interface BindingEvidence {targetId:string;sourceIds:string[];formulaId:string;formulaVersion:string;precision:number;rounding:string;overwrite:string;documentReference:string}
export function bindingCoverage(proposed:Omit<BindingEvidence,"documentReference">,decisions:BindingEvidence[]):string[] {
 const matches=decisions.filter(d=>d.targetId===proposed.targetId);
 if(matches.length!==1)return ["Missing or ambiguous execution decision; do not create approval"];
 const decision=matches[0];if(!decision.documentReference.trim())return ["Missing decision document reference"];
 return (Object.keys(proposed) as Array<keyof typeof proposed>).filter(key=>JSON.stringify(proposed[key])!==JSON.stringify(decision[key])).map(key=>"Uncovered execution setting: "+key);
}
export interface RestoreEvidence {
 sourceIdentity:string;boundary:string;consistency:"WRITE_FENCE"|"SNAPSHOT_OPLOG";consistencyVerified:boolean;
 isolated:boolean;outboundDisabled:boolean;operatorReference:string;
 collections:Record<string,{count:number;contentHash:string;indexHash:string;optionsHash:string}>;
 historicalResultHashes:Record<string,string>;assets:Record<string,string>;
}
export function verifyRestore(source:RestoreEvidence,restored:RestoreEvidence):string[] {
 const issues:string[]=[];
 if(!source.sourceIdentity||!source.boundary||!source.consistencyVerified||!source.operatorReference)issues.push("Unverified backup consistency/operator evidence");
 if(!restored.isolated||!restored.outboundDisabled||!restored.operatorReference||!restored.consistencyVerified)issues.push("Restore isolation/outbound/operator gate failed");
 for(const key of ["sourceIdentity","boundary","consistency","collections","historicalResultHashes","assets"] as const)
  if(JSON.stringify(sortObject(source[key]))!==JSON.stringify(sortObject(restored[key])))issues.push("Restore mismatch: "+key);
 if(Object.keys(source.historicalResultHashes).length!==7)issues.push("Seven historical CBP identities/hashes must reconcile");
 if(!source.collections.labtestresults||!source.collections.auditlogs||!source.collections.labbills||!source.collections.pdfassets)issues.push("Required clinical/audit/order/asset collections missing");
 if(Object.values(source.assets).some(hash=>!/^[a-f0-9]{64}$/.test(hash)))issues.push("Invalid asset checksum");
 for(const c of Object.values(source.collections))if(!Number.isInteger(c.count)||c.count<0||[c.contentHash,c.indexHash,c.optionsHash].some(hash=>!/^[a-f0-9]{64}$/.test(hash)))issues.push("Invalid collection evidence");
 if(Object.values(source.historicalResultHashes).some(hash=>!/^[a-f0-9]{64}$/.test(hash)))issues.push("Invalid historical result checksum");
 return issues;
}
function sortObject(value:unknown):unknown {return Array.isArray(value)?value.map(sortObject):value&&typeof value==="object"?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,sortObject(v)])):value;}
