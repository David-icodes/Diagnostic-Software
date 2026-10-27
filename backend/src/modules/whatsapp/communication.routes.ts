import {campFilterFields,campSelectionSchema,listOspCampRecipients} from "./camp-recipients";
import {campTemplates,campAudience,queueCampBroadcast} from "./camp-broadcast";
import {checkDocumentMessage,enqueueDocumentMessage} from "./document-queue";
import {reviewLisMessageSchema} from "../../validations/whatsapp-lis";
import {Router} from 'express';import {z} from 'zod';import {createHash} from 'node:crypto';
import {authenticate} from '../../middleware/authenticate';import {requirePermission} from '../../middleware/require-permission';import {asyncHandler} from '../../utils/async-handler';import {ApiError} from '../../utils/api-error';import {sendSuccess} from '../../utils/http';
import {CommunicationConsent,CommunicationJob,CommunicationSettings,CommunicationCampaign} from '../../models/communication.model';import {WhatsAppMessage} from '../../models/whatsapp-message.model';import {Patient} from '../../models/patient.model';import {AuditLog} from '../../models/audit-log.model';import {env} from '../../config/env';import {approvedTemplateInventory} from './communication-templates';import {phoneHash,consentAllowed,assertCampaignTemplate,assertThankYouTemplate} from './communication-guards';
const router=Router();router.use(authenticate,requirePermission('whatsapp.send'));
const id=z.string().regex(/^[a-f\d]{24}$/i);const ids=z.array(id).min(1).max(500);
router.post('/documents/check',asyncHandler(async(req,res)=>{
 const {context}=await checkDocumentMessage(req.body,req);
 return sendSuccess(res,{patientName:context.patientName,patientCode:context.patientCode,billNumber:context.billNumber,ready:true});
}));
router.post('/documents/queue',asyncHandler(async(req,res)=>{
 const input=z.object({requestId:z.string().uuid(),message:reviewLisMessageSchema}).strict().parse(req.body);
 return res.status(202).json({success:true,data:await enqueueDocumentMessage(input.message,input.requestId,req)});
}));
router.get('/jobs/:id',asyncHandler(async(req,res)=>{
 const job=await CommunicationJob.findById(id.parse(req.params.id)).select('state reason').exec();if(!job)throw new ApiError(404,'Message not found');
 return sendSuccess(res,{state:job.state,reason:job.reason});
}));
router.get('/camp/templates',asyncHandler(async(_req,res)=>sendSuccess(res,{templates:await campTemplates()})));
router.get('/camp/recipients',asyncHandler(async(req,res)=>{
 const {page,...filters}=z.object({...campFilterFields,page:z.coerce.number().int().min(1).max(10000).default(1)}).strict().parse(req.query);
 return sendSuccess(res,await listOspCampRecipients(filters,page));
}));
router.get('/camp/audience',asyncHandler(async(_req,res)=>sendSuccess(res,{count:(await campAudience()).length})));
router.post('/camp/queue',asyncHandler(async(req,res)=>{
 const input=z.object({requestId:z.string().uuid(),templateName:z.string().regex(/^[a-z0-9_]+$/).max(120),language:z.string().regex(/^en(?:_[A-Z]{2})?$/),selection:campSelectionSchema}).strict().parse(req.body);
 if(input.templateName!==env.WHATSAPP_CAMP_TEMPLATE_NAME)throw new ApiError(422,'Select the configured camp template.');
 return res.status(202).json({success:true,data:await queueCampBroadcast(input,req.user!)});
}));
router.get('/camp/jobs/:id',asyncHandler(async(req,res)=>{
 const requestId=z.string().uuid().parse(req.params.id),campaign=await CommunicationCampaign.findOne({requestId,mode:'broadcast'}).select('state reason queuedCount').exec();if(!campaign)throw new ApiError(404,'Campaign not found');
 return sendSuccess(res,{state:campaign.state==='expanded'?'accepted':campaign.state,reason:campaign.reason,count:campaign.queuedCount});
}));
router.get('/management',asyncHandler(async(_req,res)=>{
 let templates:Awaited<ReturnType<typeof approvedTemplateInventory>>=[],configurationError='';try{templates=await approvedTemplateInventory();}catch{configurationError='Meta template approval is not verified. Check server configuration.';}
 const settings=await CommunicationSettings.findOne({key:'global'}).lean().exec();
 return sendSuccess(res,{autoThankYou:Boolean(settings?.autoThankYou),configurationError,templates,thanksLanguage:env.WHATSAPP_PATIENT_THANK_YOU_LANGUAGE,verifiedAt:configurationError?null:new Date().toISOString()});
}));
router.put('/management',asyncHandler(async(req,res)=>{
 const {autoThankYou}=z.object({autoThankYou:z.boolean()}).strict().parse(req.body);
 if(autoThankYou){const rows=await approvedTemplateInventory(),template=rows.find(t=>t.name==='patient_thank_you'&&t.language===env.WHATSAPP_PATIENT_THANK_YOU_LANGUAGE&&t.status==='APPROVED');if(!template)throw new ApiError(422,'Verify patient_thank_you and its exact configured language with Meta before enabling automation.');assertThankYouTemplate(template);}
 await CommunicationSettings.updateOne({key:'global'},{$set:{autoThankYou,updatedBy:req.user!.id}},{upsert:true}).exec();return sendSuccess(res,{autoThankYou});
}));
router.get('/analytics',asyncHandler(async(req,res)=>{
 const days=z.union([z.literal('all'),z.coerce.number().refine(n=>[7,30,90].includes(n),'Invalid period')]).parse(req.query.days??30);
 const counts=await CommunicationJob.aggregate([

 {$lookup:{from:WhatsAppMessage.collection.name,localField:'metaMessageId',foreignField:'metaMessageId',as:'delivery'}},
 {$project:{id:{$toString:'$_id'},templateName:1,state:1,reason:1,createdAt:1,status:{$ifNull:[{$arrayElemAt:['$delivery.status',0]},'$state']}}},
 {$unionWith:{coll:WhatsAppMessage.collection.name,pipeline:[{$match:{direction:'OUTBOUND'}},{$lookup:{from:CommunicationJob.collection.name,localField:'metaMessageId',foreignField:'metaMessageId',as:'job'}},{$match:{job:{$size:0}}},{$project:{id:{$toString:'$_id'},templateName:1,status:1,createdAt:1,reason:'$errorCode'}}]}},
 {$match:days==='all'?{}:{createdAt:{$gte:new Date(Date.now()-days*86400000)}}},{$group:{_id:'$status',count:{$sum:1}}}
 ]).exec();
 return sendSuccess(res,{statuses:Object.fromEntries(counts.map(row=>[String(row._id),row.count])),total:counts.reduce((sum,row)=>sum+Number(row.count),0)});
}));
router.get('/messages',asyncHandler(async(req,res)=>{
 const status=z.enum(['all','queued','processing','accepted','failed','uncertain','blocked','sent','delivered','read']).parse(req.query.status??'all');
 const group=z.enum(['total','sent','delivered','pending','failed']).optional().parse(req.query.group),days=z.union([z.literal('all'),z.coerce.number().refine(n=>[7,30,90].includes(n))]).parse(req.query.days??30),page=z.coerce.number().int().min(1).max(10000).parse(req.query.page??1);
 const groups={total:[],sent:['sent','delivered','read'],delivered:['delivered','read'],pending:['queued','processing','accepted'],failed:['failed','blocked','uncertain']};const statuses=group?groups[group]:status==='all'?[]:[status];
 const rows=await CommunicationJob.aggregate([

 {$lookup:{from:WhatsAppMessage.collection.name,localField:'metaMessageId',foreignField:'metaMessageId',as:'delivery'}},
 {$project:{id:{$toString:'$_id'},patientId:1,phoneNumber:{$arrayElemAt:['$delivery.phoneNumber',0]},templateName:1,state:1,reason:1,createdAt:1,status:{$ifNull:[{$arrayElemAt:['$delivery.status',0]},'$state']}}},
 {$unionWith:{coll:WhatsAppMessage.collection.name,pipeline:[{$match:{direction:'OUTBOUND'}},{$lookup:{from:CommunicationJob.collection.name,localField:'metaMessageId',foreignField:'metaMessageId',as:'job'}},{$match:{job:{$size:0}}},{$project:{id:{$toString:'$_id'},patientId:1,phoneNumber:1,templateName:1,status:1,createdAt:1,reason:'$errorCode'}}]}},
 {$match:{...(days==='all'?{}:{createdAt:{$gte:new Date(Date.now()-days*86400000)}}),...(statuses.length?{status:{$in:statuses}}:{})}},
 {$facet:{data:[{$sort:{createdAt:-1,_id:-1}},{$skip:(page-1)*50},{$limit:50},{$lookup:{from:Patient.collection.name,localField:'patientId',foreignField:'_id',as:'patient'}},{$project:{_id:0,id:1,templateName:1,state:1,status:1,createdAt:1,reason:1,patientName:{$ifNull:[{$arrayElemAt:['$patient.fullName',0]},'']},mobile:{$ifNull:['$phoneNumber',{$ifNull:[{$arrayElemAt:['$patient.mobile',0]},'']}]}}}],count:[{$count:'total'}]}}
 ]).exec();const result=rows[0],total=result?.count?.[0]?.total??0;
 return sendSuccess(res,{data:result?.data??[],page,total,totalPages:Math.max(1,Math.ceil(total/50))});
}));
router.post('/consents/read',asyncHandler(async(req,res)=>{
 const {patientIds}=z.object({patientIds:ids}).strict().parse(req.body);
 const rows=await CommunicationConsent.find({patientId:{$in:patientIds}}).select('patientId mobileHash serviceOptIn marketingOptIn optInAt source optOutAt').lean().exec();
 const patients=await Patient.find({_id:{$in:patientIds},status:'active'}).select('_id mobile').lean().exec();
 return sendSuccess(res,{data:rows.map(row=>{let verified=false;try{const patient=patients.find(p=>String(p._id)===String(row.patientId));verified=Boolean(patient&&row.mobileHash===phoneHash(patient.mobile)&&row.optInAt&&!row.optOutAt);}catch{}const {mobileHash:_hash,...safe}=row;void _hash;return {...safe,verified};})});
}));
router.post('/jobs/:id/retry',asyncHandler(async(req,res)=>{
 const jobId=id.parse(req.params.id);z.object({confirmed:z.literal(true)}).strict().parse(req.body);
 const changed=await CommunicationJob.updateOne({_id:jobId,state:{$in:['blocked','failed']},metaMessageId:{$exists:false}},{$set:{state:'queued'},$unset:{reason:1,startedAt:1}}).exec();
 if(changed.modifiedCount!==1)throw new ApiError(409,'This delivery cannot safely be retried. Verify uncertain or accepted messages first.');
 await AuditLog.create({user:req.user!.id,action:'whatsapp.retry_requested',entityType:'CommunicationJob',entity:jobId});return sendSuccess(res,{queued:true});
}));
router.put('/consents/:id',asyncHandler(async(req,res)=>{
 const patientId=id.parse(req.params.id),input=z.object({serviceOptIn:z.boolean(),marketingOptIn:z.boolean(),source:z.string().trim().min(3).max(300),optInAt:z.coerce.date().optional(),optOut:z.boolean()}).strict().parse(req.body);
 if(!input.optOut&&(input.serviceOptIn||input.marketingOptIn)&&(!input.optInAt||input.optInAt.getTime()>Date.now()))throw new ApiError(422,'Record the actual opt-in date/time, not a future time.');
 const patient=await Patient.findOne({_id:patientId,status:'active'}).select('mobile').exec();if(!patient)throw new ApiError(404,'Active patient not found');
 const data={mobileHash:phoneHash(patient.mobile),serviceOptIn:input.optOut?false:input.serviceOptIn,marketingOptIn:input.optOut?false:input.marketingOptIn,source:input.source,optInAt:input.optInAt,recordedBy:req.user!.id};
 await CommunicationConsent.updateOne({patientId},{$set:{...data,...(input.optOut?{optOutAt:new Date()}:{})},...(!input.optOut?{$unset:{optOutAt:1}}:{})},{upsert:true}).exec();
 await AuditLog.create({user:req.user!.id,action:input.optOut?'whatsapp.consent_opt_out':'whatsapp.consent_recorded',entityType:'Patient',entity:patientId,details:{source:input.source,optInAt:input.optInAt,serviceOptIn:data.serviceOptIn,marketingOptIn:data.marketingOptIn}});return sendSuccess(res,{saved:true});
}));
router.post('/campaigns',asyncHandler(async(req,res)=>{
 const input=z.object({requestId:z.string().uuid(),patientIds:ids,templateName:z.string().regex(/^[a-z0-9_]+$/).max(120),language:z.string().regex(/^en(?:_[A-Z]{2})?$/),bodyValues:z.array(z.string().trim().min(1).max(500)).max(20).default([])}).strict().parse(req.body);
 const template=(await approvedTemplateInventory()).find(t=>t.name===input.templateName&&t.language===input.language);if(!template)throw new ApiError(422,'Template is not verified.');assertCampaignTemplate(template,input.bodyValues);
 const fingerprint=createHash('sha256').update(JSON.stringify({...input,patientIds:[...new Set(input.patientIds)].sort(),actor:req.user!.id})).digest('hex');
 await Promise.all([CommunicationJob.init(),CommunicationCampaign.init()]);
 try{await CommunicationCampaign.updateOne({requestId:input.requestId},{$setOnInsert:{fingerprint,createdBy:req.user!.id}},{upsert:true}).exec();}catch(error){if((error as {code?:number}).code!==11000)throw error;}
 const existing=await CommunicationCampaign.findOne({requestId:input.requestId}).select('fingerprint').exec();if(!existing||existing.fingerprint!==fingerprint)throw new ApiError(409,'Campaign request was already used with different content.');
 const patients=await Patient.find({_id:{$in:input.patientIds},status:'active'}).select('_id mobile').exec(),consents=await CommunicationConsent.find({patientId:{$in:input.patientIds}}).exec();const eligible:{patientId:unknown;hash:string}[]=[];let blocked=0;const seen=new Set<string>();
 for(const patient of patients){let hash='';try{hash=phoneHash(patient.mobile);}catch{blocked++;continue;}if(!consentAllowed(consents.find(c=>String(c.patientId)===String(patient._id))??null,hash,'camp')){blocked++;continue;}if(!seen.has(hash)){seen.add(hash);eligible.push({patientId:patient._id,hash});}}
 if(blocked||patients.length!==new Set(input.patientIds).size)throw new ApiError(422,'Every selected recipient needs verified marketing consent for their current mobile. Remove ineligible recipients before submitting.');
 for(const row of eligible)await CommunicationJob.updateOne({key:`camp:${input.requestId}:${row.hash}`},{$setOnInsert:{kind:'camp',patientId:row.patientId,createdBy:req.user!.id,mobileHash:row.hash,campaignId:input.requestId,campaignFingerprint:fingerprint,templateName:input.templateName,language:input.language,bodyValues:input.bodyValues,templateVersion:createHash('sha256').update(JSON.stringify(template.components??[])).digest('hex'),state:'queued'}},{upsert:true}).exec();return res.status(202).json({success:true,data:{queued:eligible.length,campaignId:input.requestId}});
}));
export default router;
