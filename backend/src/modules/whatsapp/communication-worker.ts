import {expandCampBroadcasts} from "./camp-broadcast";
import {User} from "../../models/user.model";
import {roleHasPermission} from "../../middleware/require-permission";
import {processDocumentMessage} from "./document-queue";
import {CommunicationConsent,CommunicationJob,CommunicationSettings} from '../../models/communication.model';
import {LabBill} from '../../models/lab-bill.model';import {Patient} from '../../models/patient.model';import {WhatsAppMessage} from '../../models/whatsapp-message.model';
import {createHash} from 'node:crypto';
import {env} from '../../config/env';import {ApiError} from '../../utils/api-error';
import {approvedTemplateInventory} from './communication-templates';import {phoneHash,consentAllowed,assertCampaignTemplate,campaignTemplateComponents,assertThankYouTemplate,communicationFailureReason,failureState} from './communication-guards';
import {normalizeLisRecipient} from './lis-recipient';import {sendWhatsAppTemplateMessage} from './whatsapp-send.service';import {templateComponents} from './lis-template';

export async function processCommunicationQueue(providers={templates:approvedTemplateInventory,send:sendWhatsAppTemplateMessage}){
 // Recover only intents atomically recorded on newly submitted OSP bills, never historic bills.
 const pending=await LabBill.find({whatsappThanksPending:true,status:'generated',billType:'osp'}).select('_id patientId createdBy whatsappThanksMobileHash').limit(20).exec();
 for(const bill of pending){await CommunicationJob.updateOne({key:`thanks:${bill._id}`},{$setOnInsert:{kind:'thank-you',patientId:bill.patientId,billId:bill._id,createdBy:bill.createdBy,templateName:'patient_thank_you',mobileHash:bill.whatsappThanksMobileHash,state:'queued'}},{upsert:true}).exec();await LabBill.updateOne({_id:bill._id},{$set:{whatsappThanksPending:false}}).exec();}
 await CommunicationJob.updateMany({state:'processing',startedAt:{$lt:new Date(Date.now()-5*60000)}},{$set:{state:'uncertain',reason:'Delivery needs manual verification; automatic retry is disabled.'}}).exec();
 const settings=await CommunicationSettings.findOne({key:'global'}).exec();
 for(let count=0;count<5;count++){
  const job=await CommunicationJob.findOneAndUpdate({state:'queued',dispatchReady:{$ne:false},...(settings?.autoThankYou?{}:{kind:{$in:['camp','document']}})},{$set:{state:'processing',startedAt:new Date()}},{new:true,sort:{createdAt:1}}).exec();if(!job)return;
  if(job.kind==='document'){await processDocumentMessage(job);continue;}
  let attempted=false;
  try{
   const patient=await Patient.findOne({_id:job.patientId,status:'active'}).select('fullName mobile').exec();if(!patient)throw new ApiError(422,'Patient is inactive or unavailable.');
   if(job.kind==='camp'&&job.actorSessionVersion!==undefined){const actor=await User.findOne({_id:job.createdBy,status:'active'}).exec();if(!actor||!roleHasPermission(actor.role,'whatsapp.send')||(actor.sessionVersion??0)!==job.actorSessionVersion)throw new ApiError(403,'The sender session or permission changed.');}
   const hash=phoneHash(patient.mobile);if(hash!==job.mobileHash)throw new ApiError(422,'The recipient mobile changed. Reconfirm consent.');
   const consent=await CommunicationConsent.findOne({patientId:job.patientId}).exec();if(consent?.optOutAt)throw new ApiError(422,'Patient has opted out.');
   const inventory=await providers.templates();const language=job.kind==='thank-you'?env.WHATSAPP_PATIENT_THANK_YOU_LANGUAGE:job.language;
   const template=inventory.find(row=>row.name===job.templateName&&row.language===language&&row.status==='APPROVED');if(!template)throw new ApiError(422,'Exact template and language approval are not verified.');
   let components:unknown[]|undefined;
   if(job.kind==='camp'){assertCampaignTemplate(template,job.bodyValues??[]);if(job.templateVersion!==createHash('sha256').update(JSON.stringify(template.components??[])).digest('hex'))throw new ApiError(422,'Campaign template changed. Review a new campaign.');components=campaignTemplateComponents(template,job.bodyValues??[]);if(!consentAllowed(consent,hash,'camp'))throw new ApiError(422,'Verified marketing consent is required.');}
   else{
    assertThankYouTemplate(template);
    const bill=await LabBill.findOne({_id:job.billId,patientId:job.patientId,billType:'osp',status:'generated'}).select('whatsappThanksConsentAt whatsappThanksMobileHash').exec();
    if(consent&&!consentAllowed(consent,hash,'thank-you'))throw new ApiError(422,'Service-message consent is not active.');
    if(!bill||(!bill.whatsappThanksConsentAt&&!consentAllowed(consent,hash,'thank-you')))throw new ApiError(422,'Service-message consent is required.');
    if(template.category==='MARKETING'&&!consentAllowed(consent,hash,'camp'))throw new ApiError(422,'This greeting is classified as marketing; marketing consent is required.');
    const response=await fetch(new URL('/whatsapp/organisation',env.FRONTEND_URL),{signal:AbortSignal.timeout(10000)});const branding=await response.json() as {name?:string};if(!response.ok||!branding.name)throw new ApiError(503,'Centre branding is unavailable.');
    components=templateComponents('patient_thank_you',[patient.fullName,branding.name]);
   }
   const currentPatient=await Patient.findOne({_id:job.patientId,status:'active'}).select('mobile').exec();
   const currentConsent=await CommunicationConsent.findOne({patientId:job.patientId}).exec();
   if(!currentPatient||phoneHash(currentPatient.mobile)!==hash||currentConsent?.optOutAt||job.kind==='camp'&&!consentAllowed(currentConsent,hash,'camp')||template.category==='MARKETING'&&!consentAllowed(currentConsent,hash,'camp'))throw new ApiError(422,'Recipient or consent changed before dispatch.');
   if(job.kind==='thank-you'&&currentConsent&&!consentAllowed(currentConsent,hash,'thank-you'))throw new ApiError(422,'Service consent changed before dispatch.');
   if(job.kind==='thank-you'&&!await LabBill.exists({_id:job.billId,patientId:job.patientId,status:'generated',billType:'osp'}))throw new ApiError(422,'The bill is no longer active.');
   if(!await CommunicationJob.exists({_id:job._id,state:'processing'}))continue;
   if(job.kind==='camp'&&job.actorSessionVersion!==undefined){const actor=await User.findOne({_id:job.createdBy,status:'active'}).exec();if(!actor||!roleHasPermission(actor.role,'whatsapp.send')||(actor.sessionVersion??0)!==job.actorSessionVersion)throw new ApiError(403,'The sender permission changed before dispatch.');}
   attempted=true;const result=await providers.send({to:normalizeLisRecipient(patient.mobile),templateName:job.templateName,languageCode:language,components});
   // Persist acceptance before auxiliary delivery logging: an unknown outcome must never auto-resend.
   await CommunicationJob.updateOne({_id:job._id},{$set:{state:'accepted',metaMessageId:result.metaMessageId},$unset:{reason:1}}).exec();
   await WhatsAppMessage.updateOne({metaMessageId:result.metaMessageId},{$setOnInsert:{direction:'OUTBOUND',messageType:'template',status:'accepted',patientId:job.patientId,billId:job.billId,templateName:job.templateName,templateLanguage:language,phoneNumber:patient.mobile}},{upsert:true}).exec();
  }catch(error){
   const code=error instanceof ApiError?(error.details as {metaErrorCode?:string}|undefined)?.metaErrorCode:undefined;
   await CommunicationJob.updateOne({_id:job._id,state:'processing'},{$set:{state:failureState(attempted,Boolean(code)),reason:communicationFailureReason(error,attempted)}}).exec();
  }
 }
}
export function startCommunicationWorker(){const ready=Promise.all([CommunicationJob.init(),CommunicationConsent.init(),CommunicationSettings.init()]);let stopped=false,running:Promise<void>|undefined;const tick=()=>{if(stopped||running)return;running=ready.then(async()=>{await expandCampBroadcasts();await processCommunicationQueue();}).catch(()=>{console.error('[communications] Background queue is unavailable; jobs remain durable.');}).finally(()=>{running=undefined;});};const timer=setInterval(tick,30000);timer.unref();tick();return async()=>{stopped=true;clearInterval(timer);await running;};}
