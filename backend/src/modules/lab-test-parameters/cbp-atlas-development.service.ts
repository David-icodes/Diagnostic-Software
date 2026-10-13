import {Types} from "mongoose";
import {LabTestParameter} from "../../models/lab-test-parameter.model";
import {LabTest} from "../../models/lab-test.model";
import {ParameterVersion} from "../../models/parameter-version.model";
import {User} from "../../models/user.model";
import {AuditLog} from "../../models/audit-log.model";
import {ApiError} from "../../utils/api-error";
import {parameterClinicalHash} from "./parameter-version-development.service";
export const CBP_DEVELOPMENT_TEST="6acd328b871437b91c0ad9b2";
export const CBP_DEVELOPMENT_IDS=["58fc22c7479b88313a95cdd9","ffb3e9c48662cc43921fa48d","b92614e048dc68f380008eb4","0f8b1d039bc510b7278071a7","17b14eb0886176f3cc3fe4f0","9c3a92d7ea72c64e4e8d218c"] as const;
export const CBP_DEVELOPMENT_MANIFEST="cbp-exact-numeric-development-2026-10-13";
/** This path prepares inactive versions only. It grants no clinical approval or cutover. */
export function assertCBPAtlasDevelopment(environment:string|undefined,uri:string|undefined,database:string|undefined,testId:string) {
 let parsed:URL;try{parsed=new URL(uri??"");}catch{throw new ApiError(403,"Unexpected CBP development environment");}
 if(environment!=="development"||parsed.protocol!=="mongodb+srv:"||parsed.hostname!=="cluster0.aqyakc9.mongodb.net"||parsed.pathname!=="/diagnostic_lis_development_20261012"||database!=="diagnostic_lis_development_20261012"||testId!==CBP_DEVELOPMENT_TEST)throw new ApiError(403,"Unexpected CBP development environment");
}
export function cbpDevelopmentDrafts(versions:Array<{_id:unknown;lineage?:{originalId:string}}>) {
 const ids=new Map(versions.map(v=>[v.lineage?.originalId,String(v._id)]));
 if(ids.size!==6||CBP_DEVELOPMENT_IDS.some(id=>!ids.has(id)))throw new ApiError(409,"Incomplete exact numeric successor mapping");
 const [hb,rbc,pcv,mcv,mch,mchc]=CBP_DEVELOPMENT_IDS;
 return [{target:pcv,formulaId:"pcv-hb-approx",sources:[hb],expression:"S1 * 3",precision:1},{target:mch,formulaId:"mch",sources:[hb,rbc],expression:"S1 * 10 / S2",precision:2},{target:mcv,formulaId:"mcv",sources:[pcv,rbc],expression:"S1 * 10 / S2",precision:2},{target:mchc,formulaId:"mchc",sources:[hb,pcv],expression:"S1 * 100 / S2",precision:2}].map(p=>({_id:`cbp-development-${p.target}`,testId:CBP_DEVELOPMENT_TEST,logicalTargetId:p.target,targetVersionId:ids.get(p.target)!,status:"PENDING" as const,clinicalApproval:false,calculation:{enabled:false,formulaId:p.formulaId,dependencyIds:p.sources.map(id=>ids.get(id)!),expression:p.expression,precision:p.precision,overwrite:"CONFIRM",sourceVerification:"User-authorized development formula specification 2026-10-13; not clinical approval"}}));
}
export async function prepareAtlasCBPNumericVersions(actorId:string) {
 const connection=LabTestParameter.db;
 const guard=()=>assertCBPAtlasDevelopment(process.env.NODE_ENV,process.env.MONGODB_URI,connection.name,CBP_DEVELOPMENT_TEST);
 guard();
 if(!Types.ObjectId.isValid(actorId)||!await User.exists({_id:actorId,role:"admin",status:"active"}))throw new ApiError(403,"An authenticated active administrator is required");
 const parent=await LabTest.findById(CBP_DEVELOPMENT_TEST).lean();
 if(!parent||parent.testName!=="COMPLETE BLOOD PICTURE"||String(parent.departmentId)!=="6acd2f6896eb7c61dfaa4da0"||parent.catalogueImport?.sourceKey!=="wilco-catalogue-20261013-row-71")throw new ApiError(409,"Exact Hematology CBP parent identity changed");
 // A dedicated unique lineage index makes concurrent/repeated preparation safe.
 guard();await ParameterVersion.collection.createIndex({"lineage.originalId":1,"lineage.version":1},{unique:true});
 const session=await connection.startSession();let output:unknown[]=[];
 try {await session.withTransaction(async()=>{
  const originals=await LabTestParameter.find({_id:{$in:CBP_DEVELOPMENT_IDS},testId:CBP_DEVELOPMENT_TEST}).session(session).lean();
  if(originals.length!==6||originals.some(p=>p.resultType!=="TEXT"||p.itemType!=="PARAMETER"||!p.active||p.calculation||p.calculationApproval||p.lineage))throw new ApiError(409,"Original CBP definitions are not the reviewed unconfigured baseline");
  const versions=[];
  for(const id of CBP_DEVELOPMENT_IDS){const original=originals.find(p=>String(p._id)===id)!;const hash=parameterClinicalHash(original);
   const existing=await ParameterVersion.findOne({"lineage.originalId":id,"lineage.version":2}).session(session).lean();
   if(existing){if(existing.versionClinicalHash!==hash||existing.lineage?.manifestReference!==CBP_DEVELOPMENT_MANIFEST||existing.active||existing.calculation||existing.calculationApproval)throw new ApiError(409,"Existing successor conflicts with reviewed baseline");versions.push(existing);continue;}
   const {_id,createdAt,updatedAt,...copy}=original;void _id;void createdAt;void updatedAt;
   guard();
   const [version]=await ParameterVersion.create([{...copy,resultType:"NUMBER",active:false,createdBy:new Types.ObjectId(actorId),updatedBy:undefined,calculation:undefined,calculationApproval:undefined,pendingCalculation:undefined,lineage:{originalId:id,predecessorId:id,version:2,manifestReference:CBP_DEVELOPMENT_MANIFEST},versionClinicalHash:hash}],{session});
   guard();await AuditLog.create([{user:new Types.ObjectId(actorId),action:"lab.cbp_development_numeric_version_prepared",entityType:"ParameterVersion",entity:version._id,details:{originalId:id,manifest:CBP_DEVELOPMENT_MANIFEST,clinicalApproval:false,active:false}}],{session});versions.push(version.toObject());
  }
  const drafts=connection.db!.collection<ReturnType<typeof cbpDevelopmentDrafts>[number]>("developmentcalculationdrafts");
  for(const draft of cbpDevelopmentDrafts(versions)){const existing=await drafts.findOne({_id:draft._id},{session});if(existing){if(JSON.stringify(existing.calculation)!==JSON.stringify(draft.calculation)||existing.targetVersionId!==draft.targetVersionId||existing.clinicalApproval!==false||existing.status!=="PENDING")throw new ApiError(409,"Development draft conflicts with existing request");continue;}guard();await drafts.insertOne(draft,{session});guard();await AuditLog.create([{user:new Types.ObjectId(actorId),action:"lab.cbp_development_binding_draft_prepared",entityType:"ParameterVersion",entity:new Types.ObjectId(draft.targetVersionId),details:{manifest:CBP_DEVELOPMENT_MANIFEST,clinicalApproval:false,calculation:draft.calculation}}],{session});}
  output=versions.map(v=>({originalId:v.lineage!.originalId,versionId:String(v._id),resultType:v.resultType,unit:v.unit,active:v.active,clinicalApproval:false}));
 });return {database:connection.name,testId:CBP_DEVELOPMENT_TEST,versions:output,pendingBindings:4,activated:false,approvalStatus:"PENDING",nextStep:"Recorded laboratory approval and supported prospective cutover required before activation"};}
 finally{await session.endSession();}
}
