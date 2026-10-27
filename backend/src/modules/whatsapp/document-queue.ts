import {createHash} from 'node:crypto';
import type {Request} from 'express';
import {CommunicationJob,CommunicationConsent,type ICommunicationJob} from '../../models/communication.model';
import {User} from '../../models/user.model';
import {env} from '../../config/env';
import {ApiError} from '../../utils/api-error';
import jwt from 'jsonwebtoken';
import {roleHasPermission} from '../../middleware/require-permission';
import {reviewLisMessageSchema,type ReviewLisMessageInput} from '../../validations/whatsapp-lis';
import {loadLisContext,lisConfigurationError,reviewLisMessage,sendLisReview,findLisReview} from './lis-workflow.service';
import {approvedTemplateInventory} from './communication-templates';
import {phoneHash,consentAllowed,communicationFailureReason} from './communication-guards';
import {languageFor} from './lis-template';
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const defaults={context:loadLisContext,templates:approvedTemplateInventory,review:reviewLisMessage,send:sendLisReview};
function authorized(req:Request){if(!req.user)throw new ApiError(401,'Authentication required');if(!roleHasPermission(req.user.role,'whatsapp.send'))throw new ApiError(403,'WhatsApp sending is not permitted');}
export async function checkDocumentMessage(raw:ReviewLisMessageInput,req:Request,providers=defaults){
 authorized(req);const input=reviewLisMessageSchema.parse(raw);
 if(!['lab_invoice_ready','lab_report_ready'].includes(input.templateName))throw new ApiError(422,'Select an invoice or report.');
 const context=await providers.context(input,req.user!.name),error=lisConfigurationError(input,context.mobile);if(error)throw new ApiError(422,error);
 const hash=phoneHash(context.mobile),consent=await CommunicationConsent.findOne({patientId:input.patientId}).exec();
 if(consent?.optOutAt)throw new ApiError(422,'This patient has opted out of WhatsApp messages.');
 const template=(await providers.templates()).find(row=>row.name===input.templateName&&row.language===languageFor(input.templateName,env)&&row.status==='APPROVED');
 if(!template)throw new ApiError(422,'The selected template and language are not approved.');
 if(template.category==='MARKETING'&&!consentAllowed(consent,hash,'camp'))throw new ApiError(422,'Verified marketing consent is required.');
 if(!template.components?.some(c=>c.type==='HEADER'&&c.format==='DOCUMENT'))throw new ApiError(422,'The approved template must accept a PDF document.');
 return {input,context,hash,documentDigest:digest(context)};
}
export async function enqueueDocumentMessage(raw:ReviewLisMessageInput,requestId:string,req:Request,providers=defaults){
 const checked=await checkDocumentMessage(raw,req,providers),key=`document:${req.user!.id}:${requestId}`,requestFingerprint=digest({input:checked.input,documentDigest:checked.documentDigest});
 await CommunicationJob.init();
 try{await CommunicationJob.updateOne({key},{$setOnInsert:{kind:'document',patientId:checked.input.patientId,billId:checked.input.billId,createdBy:req.user!.id,templateName:checked.input.templateName,language:languageFor(checked.input.templateName,env),mobileHash:checked.hash,documentInput:checked.input,documentDigest:checked.documentDigest,requestFingerprint,actorSessionVersion:req.user!.sessionVersion??0,state:'queued'}},{upsert:true}).exec();}catch(error){if((error as {code?:number}).code!==11000)throw error;}
 const job=await CommunicationJob.findOne({key}).select('_id requestFingerprint state').exec();
 if(!job||job.requestFingerprint!==requestFingerprint)throw new ApiError(409,'This request changed. Review the current document again.');
 return {jobId:String(job._id),state:job.state};
}
export async function processDocumentMessage(job:ICommunicationJob&{_id:unknown},providers=defaults){
 let sendStarted=false,reviewId:string|undefined;
 try{
  const user=await User.findOne({_id:job.createdBy,status:'active'}).exec();
  if(!user||!roleHasPermission(user.role,'whatsapp.send')||(user.sessionVersion??0)!==job.actorSessionVersion)throw new ApiError(403,'The sender session or permission changed.');
  // Short-lived internal renderer credential; never persisted in a job or returned to the browser.
  const token=jwt.sign({sub:String(user._id),username:user.username,role:user.role,sessionVersion:user.sessionVersion??0},env.JWT_SECRET,{expiresIn:'2m'});
  const req={user:{...user.toJSON(),id:String(user._id)},cookies:{[env.COOKIE_NAME]:token},headers:{'x-lis-session':'admin'},originalUrl:'/api/whatsapp/lis/send'} as unknown as Request;
  if(!job.documentInput)throw new ApiError(422,'Queued document options are missing.');
  const checked=await checkDocumentMessage(job.documentInput,req,providers);
  if(checked.documentDigest!==job.documentDigest||checked.hash!==job.mobileHash)throw new ApiError(409,'Patient, bill or report changed. Review it again.');
  const review=await providers.review(checked.input,req);reviewId=review.reviewId;
  const current=await User.findOne({_id:job.createdBy,status:'active',role:user.role}).exec();
  if(!current||(current.sessionVersion??0)!==(user.sessionVersion??0)||!await CommunicationJob.exists({_id:job._id,state:'processing'}))throw new ApiError(403,'The sender session or queued request changed.');
  const latest=await checkDocumentMessage(checked.input,req,providers);
  if(latest.documentDigest!==job.documentDigest||latest.hash!==job.mobileHash)throw new ApiError(409,'Patient, bill or report changed before sending.');
  const result=await providers.send(review.reviewId,req,async()=>{
   const final=await checkDocumentMessage(checked.input,req,providers);
   if(final.documentDigest!==job.documentDigest||final.hash!==job.mobileHash)throw new ApiError(409,'The document changed before dispatch.');
   const sender=await User.findOne({_id:job.createdBy,status:'active',role:user.role}).exec();
   if(!sender||(sender.sessionVersion??0)!==(user.sessionVersion??0)||!await CommunicationJob.exists({_id:job._id,state:'processing'}))throw new ApiError(403,'The sender session or queued request changed before dispatch.');
   sendStarted=true;
  });
  await CommunicationJob.updateOne({_id:job._id},{$set:{state:'accepted',metaMessageId:result.metaMessageId},$unset:{reason:1}}).exec();
 }catch(error){
  // If Meta accepted but auxiliary logging failed, acceptance still wins.
  let accepted:string|undefined;try{if(reviewId)accepted=findLisReview(reviewId,String(job.createdBy)).result?.metaMessageId;}catch{}
  const code=error instanceof ApiError?(error.details as {metaErrorCode?:string}|undefined)?.metaErrorCode:undefined;
  const state=accepted?'accepted':!sendStarted?'blocked':code?'failed':'uncertain';
  await CommunicationJob.updateOne({_id:job._id,...(accepted?{}:{state:'processing'})},{$set:{state,...(accepted?{metaMessageId:accepted}:{reason:communicationFailureReason(error,sendStarted)})}}).exec();
 }
}
