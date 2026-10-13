import {createHash} from "node:crypto";
import {Types,type HydratedDocument} from "mongoose";
import {LabTestParameter} from "../../models/lab-test-parameter.model";
import {ParameterVersion,ParameterCutover,type Cutover} from "../../models/parameter-version.model";
import {LabBill,type ILabBill} from "../../models/lab-bill.model";
import {routeParameterVersions} from "../../utils/parameter-version-routing";
import {ApiError} from "../../utils/api-error";

/** No public route. This rehearsal service cannot write outside an owned fixture. */
export interface OwnedVersionFixture {database:string;marker:string}
async function guard(context:OwnedVersionFixture) {
 const connection=LabTestParameter.db;
 if(process.env.NODE_ENV!=="test"||!/^diagnostic_lis_calculator_[a-f0-9]{32}$/.test(context.database)||connection.name!==context.database||connection.host!=="127.0.0.1"||connection.port!==27017)throw new ApiError(403,"Version workflow is restricted to an owned synthetic fixture");
 const markers=connection.db!.collection<{_id:string}>("_calculator_fixture_ownership");
 if(await markers.countDocuments()!==1||await markers.countDocuments({_id:context.marker})!==1)throw new ApiError(403,"Fixture ownership not established");
}
let fence:Promise<void>=Promise.resolve();
/** Process fence suffices only for a disposable fixture with no external writers. */
async function fenced<T>(context:OwnedVersionFixture,work:()=>Promise<T>):Promise<T> {
 const previous=fence;let release!:()=>void;fence=new Promise<void>(r=>{release=r;});await previous;
 try{await guard(context);return await work();}finally{release();}
}
export function parameterClinicalHash(parameter:object):string {
 const omitted=new Set(["_id","createdAt","updatedAt","createdBy","updatedBy","active","calculation","calculationApproval","pendingCalculation","lineage","versionClinicalHash"]);
 const stable=(value:unknown):unknown=>value instanceof Date?value.toISOString():Array.isArray(value)?value.map(stable):value&&typeof value==="object"?Object.fromEntries(Object.entries(value).filter(([k])=>!omitted.has(k)).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)])):value;
 return createHash("sha256").update(JSON.stringify(stable(parameter))).digest("hex");
}
export async function createNumericVersion(context:OwnedVersionFixture,input:{originalId:string;expectedHash:string;manifestReference:string;actorId:string}) {
 return fenced(context,async()=>{
  if(!input.manifestReference.trim()||!Types.ObjectId.isValid(input.originalId)||!Types.ObjectId.isValid(input.actorId))throw new ApiError(422,"Exact identity, actor and manifest are required");
  const original=await LabTestParameter.findById(input.originalId).lean().exec();
  if(!original||original.lineage||original.itemType!=="PARAMETER"||original.resultType!=="TEXT"||original.calculation)throw new ApiError(422,"Select an original manual TEXT parameter for a type-only version");
  if(parameterClinicalHash(original)!==input.expectedHash)throw new ApiError(409,"Original definition drifted");
  const existing=await ParameterVersion.findOne({"lineage.originalId":input.originalId,"lineage.version":2}).exec();
  if(existing){if(existing.versionClinicalHash!==input.expectedHash||existing.lineage?.manifestReference!==input.manifestReference)throw new ApiError(409,"Version request conflicts with existing manifest");return existing;}
  const {_id:discardedId,createdAt:discardedCreated,updatedAt:discardedUpdated,...copy}=original;
  void discardedId;void discardedCreated;void discardedUpdated;
  return ParameterVersion.create({...copy,resultType:"NUMBER",active:false,createdBy:input.actorId,updatedBy:undefined,calculation:undefined,calculationApproval:undefined,pendingCalculation:undefined,lineage:{originalId:input.originalId,predecessorId:input.originalId,version:2,manifestReference:input.manifestReference},versionClinicalHash:input.expectedHash});
 });
}
export async function prepareVersionCutover(context:OwnedVersionFixture,input:{testId:string;parameterIds:string[];effectiveFrom:Date;manifestReference:string;actorId:string}) {
 return fenced(context,async()=>{
  if(!input.parameterIds.length||!Number.isFinite(input.effectiveFrom.getTime())||!input.manifestReference.trim()||!Types.ObjectId.isValid(input.actorId))throw new ApiError(422,"Complete cutover manifest is required");
  const originals=await LabTestParameter.find({testId:input.testId}).exec();const versions=await ParameterVersion.find({testId:input.testId}).exec();
  const selected=routeParameterVersions([...originals,...versions],input.parameterIds);
  const baseline=Object.fromEntries(originals.filter(p=>p.active).map(p=>[String(p._id),parameterClinicalHash(p.toObject())]));
  const logical=selected.map(p=>p.lineage?.originalId??String(p._id));
  if(logical.length!==Object.keys(baseline).length||logical.some(id=>!baseline[id])||selected.some(p=>p.calculation))throw new ApiError(422,"Cutover must cover the complete manual profile without bindings");
  for(const p of selected)if(p.lineage&&((p as typeof versions[number]).versionClinicalHash!==baseline[p.lineage.originalId]||p.lineage.manifestReference!==input.manifestReference))throw new ApiError(409,"Version baseline or manifest mismatch");
  const existing=await ParameterCutover.findOne({testId:input.testId}).exec();
  if(existing){if(JSON.stringify(existing.parameterIds)!==JSON.stringify(input.parameterIds)||existing.effectiveFrom.getTime()!==input.effectiveFrom.getTime()||existing.manifestReference!==input.manifestReference)throw new ApiError(409,"Existing cutover is immutable; reconcile instead");return existing;}
  return ParameterCutover.create({...input,baseline,state:"PREPARED",revision:1,events:[{action:"PREPARED",at:new Date(),actorId:input.actorId}]});
 });
}
async function verifyBaseline(plan:HydratedDocument<Cutover>|null) {
 if(!plan)throw new ApiError(404,"Cutover not found");
 const current=await LabTestParameter.find({testId:plan.testId,active:true}).lean().exec();
 if(current.length!==Object.keys(plan.baseline).length||current.some(p=>plan.baseline[String(p._id)]!==parameterClinicalHash(p)))throw new ApiError(409,"Cutover baseline drifted");
 const versions=await ParameterVersion.find({_id:{$in:plan.parameterIds},testId:plan.testId}).lean().exec();
 for(const version of versions){if(version.resultType!=="NUMBER"||version.calculation||version.calculationApproval||version.pendingCalculation||!version.lineage||version.lineage.manifestReference!==plan.manifestReference||version.versionClinicalHash!==plan.baseline[version.lineage.originalId]||parameterClinicalHash({...version,resultType:"TEXT"})!==version.versionClinicalHash)throw new ApiError(409,"Prospective version drifted");}
 const known=new Set([...current.map(p=>String(p._id)),...versions.map(p=>String(p._id))]);
 if(plan.parameterIds.some(id=>!known.has(id)))throw new ApiError(409,"Pinned version is missing");
 return plan;
}
export async function changeVersionCutover(context:OwnedVersionFixture,testId:string,expectedRevision:number,actorId:string,suspend=false) {
 return fenced(context,async()=>{
  if(!Types.ObjectId.isValid(actorId))throw new ApiError(422,"A valid actor is required");
  const found=await ParameterCutover.findOne({testId}).exec();
  const plan=suspend?found:await verifyBaseline(found);if(!plan)throw new ApiError(404,"Cutover not found");
  if(plan.revision!==expectedRevision||(!suspend&&plan.state!=="PREPARED")||(suspend&&plan.state!=="ACTIVE"))throw new ApiError(409,"Stale cutover revision or state");
  plan.state=suspend?"SUSPENDED":"ACTIVE";plan.revision++;plan.events.push({action:plan.state,at:new Date(),actorId});await plan.save();return plan;
 });
}
/** New orders only. Existing/pending order documents and results are never updated. */
export async function createVersionedFixtureOrder(context:OwnedVersionFixture,input:Omit<ILabBill,"createdAt"> & {createdAt:Date}) {
 return fenced(context,async()=>{
  if(!Number.isFinite(input.createdAt.getTime()))throw new ApiError(422,"Order boundary is required");
  const items=[];
  for(const item of input.items){if(item.parameterVersionIds!==undefined)throw new ApiError(422,"Pins are assigned by the cutover, not caller input");
   const plan=await ParameterCutover.findOne({testId:item.testId}).exec();
   if(plan&&input.createdAt>=plan.effectiveFrom){if(plan.state!=="ACTIVE")throw new ApiError(409,"Prospective cutover is not active; new order blocked");await verifyBaseline(plan);items.push({...item,parameterVersionIds:[...plan.parameterIds]});}
   else items.push({...item});
  }
  return LabBill.create({...input,items});
 });
}
