import {env} from '../../config/env';
import {campAudience} from './camp-audience';export {campAudience} from './camp-audience';
import {selectedOspAudience,type CampSelection} from './camp-recipients';
import {createHash} from 'node:crypto';
import {CommunicationCampaign,CommunicationJob} from '../../models/communication.model';
import {User} from '../../models/user.model';
import {roleHasPermission} from '../../middleware/require-permission';import type {AuthUser} from '../../types/auth';import {ApiError} from '../../utils/api-error';
import {approvedTemplateInventory,type MetaTemplate} from './communication-templates';import {assertCampaignTemplate} from './communication-guards';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function metaCamp(template:MetaTemplate){if(template.components?.some(c=>c.type==='BODY'&&/\{\{/.test(c.text??'')))throw new ApiError(422,'Enter the complete camp details in Meta; this template still has placeholders.');assertCampaignTemplate(template,[]);return {id:template.id,name:template.name,language:template.language,body:template.components?.find(c=>c.type==='BODY')?.text??'',hasImage:template.components?.some(c=>c.type==='HEADER'&&c.format==='IMAGE')??false,version:hash(template.components??[])};}
export async function campTemplates(inventory=approvedTemplateInventory){const matches=(await inventory()).filter(t=>t.name===env.WHATSAPP_CAMP_TEMPLATE_NAME&&t.status==='APPROVED'&&t.category==='MARKETING'&&/^en(?:_[A-Z]{2})?$/.test(t.language));if(matches.length!==1)return [{id:'pending-camp',name:env.WHATSAPP_CAMP_TEMPLATE_NAME,language:'',supported:false,reason:matches.length?'Configure one English language for the camp template.':'Camp template is not configured or approved yet.'}];return matches.map(t=>{try{return {...metaCamp(t),supported:true};}catch(error){return {id:t.id,name:t.name,language:t.language,body:t.components?.find(c=>c.type==='BODY')?.text??'',hasImage:t.components?.some(c=>c.type==='HEADER'&&c.format==='IMAGE')??false,supported:false,reason:error instanceof ApiError?error.message:'Complete the template in Meta.'};}});}
export async function queueCampBroadcast(input:{requestId:string;templateName:string;language:string;selection?:CampSelection},user:AuthUser,providers={inventory:approvedTemplateInventory,audience:(cutoff?:Date,selection?:CampSelection)=>selection?selectedOspAudience(selection,cutoff):campAudience(cutoff)}){
 if(!roleHasPermission(user.role,'whatsapp.send')||user.status!=='active')throw new ApiError(403,'Camp sending is not permitted');
 const template=(await providers.inventory()).find(t=>t.name===input.templateName&&t.language===input.language);if(!template)throw new ApiError(422,'Refresh the approved templates.');const camp=metaCamp(template),fingerprint=hash({actor:user.id,template:camp.name,language:camp.language,version:camp.version,selection:input.selection});
 const audience=await providers.audience(undefined,input.selection);if(!audience.length)throw new ApiError(422,'No patients have verified marketing consent and a valid mobile number.');
 await CommunicationCampaign.init();try{await CommunicationCampaign.updateOne({requestId:input.requestId},{$setOnInsert:{fingerprint,createdBy:user.id,mode:'broadcast',state:'queued',templateName:camp.name,language:camp.language,templateVersion:camp.version,actorSessionVersion:user.sessionVersion??0,queuedCount:0,selection:input.selection}},{upsert:true}).exec();}catch(error){if((error as {code?:number}).code!==11000)throw error;}
 const campaign=await CommunicationCampaign.findOne({requestId:input.requestId}).exec();if(!campaign||campaign.fingerprint!==fingerprint||campaign.mode!=='broadcast')throw new ApiError(409,'The campaign request changed. Refresh and review it again.');
 return {campaignId:input.requestId,recipients:audience.length,state:campaign.state};
}
async function activateCampaign(campaign:{_id:unknown;requestId:string}){
 await CommunicationJob.updateMany({campaignId:campaign.requestId,dispatchReady:false,state:'queued'},{$set:{dispatchReady:true}}).exec();
 await CommunicationCampaign.updateOne({_id:campaign._id,state:'expanded'},{$set:{activationComplete:true},$unset:{reason:1}}).exec();
}
export async function expandCampBroadcasts(providers={inventory:approvedTemplateInventory,audience:(cutoff?:Date,selection?:CampSelection)=>selection?selectedOspAudience(selection,cutoff):campAudience(cutoff)}){
 await CommunicationCampaign.init();await CommunicationJob.init();
 const ready=await CommunicationCampaign.find({mode:'broadcast',state:'expanded',activationComplete:{$ne:true}}).limit(5).exec();for(const row of ready)await activateCampaign(row);
 await CommunicationCampaign.updateMany({mode:'broadcast',state:'processing',startedAt:{$lt:new Date(Date.now()-5*60000)}},{$set:{state:'queued'}}).exec();
 const campaign=await CommunicationCampaign.findOneAndUpdate({mode:'broadcast',state:'queued'},{$set:{state:'processing',startedAt:new Date()}},{new:true,sort:{createdAt:1}}).exec();if(!campaign)return;
 let prepared=false;
 try{
  const user=await User.findOne({_id:campaign.createdBy,status:'active'}).exec();if(!user||!roleHasPermission(user.role,'whatsapp.send')||(user.sessionVersion??0)!==campaign.actorSessionVersion)throw new ApiError(403,'The sender session or permission changed.');
  const template=(await providers.inventory()).find(t=>t.name===campaign.templateName&&t.language===campaign.language);if(!template)throw new ApiError(422,'The camp template is unavailable.');const camp=metaCamp(template);if(camp.version!==campaign.templateVersion)throw new ApiError(409,'The template changed in Meta. Review a new campaign.');
  const audience=await providers.audience(campaign.createdAt,campaign.selection as CampSelection|undefined);if(!audience.length)throw new ApiError(422,'No verified recipients remain for this campaign.');
  for(let index=0;index<audience.length;index+=200){await CommunicationJob.bulkWrite(audience.slice(index,index+200).map(row=>({updateOne:{filter:{key:`camp:${campaign.requestId}:${row.hash}`},update:{$setOnInsert:{kind:'camp',patientId:row.patientId,createdBy:campaign.createdBy,mobileHash:row.hash,campaignId:campaign.requestId,campaignFingerprint:campaign.fingerprint,templateName:camp.name,language:camp.language,bodyValues:[],templateVersion:camp.version,actorSessionVersion:campaign.actorSessionVersion??0,dispatchReady:false,state:'queued'}},upsert:true}})),{ordered:false});}
  await CommunicationCampaign.updateOne({_id:campaign._id},{$set:{state:'expanded',queuedCount:audience.length},$unset:{reason:1}}).exec();prepared=true;await activateCampaign(campaign);
 }catch(error){if(prepared)return;const reason=error instanceof ApiError?error.message:'Campaign preparation could not be completed.';await CommunicationCampaign.updateOne({_id:campaign._id},{$set:{state:'blocked',reason}}).exec();await CommunicationJob.updateMany({campaignId:campaign.requestId,dispatchReady:false},{$set:{state:'blocked',reason}}).exec();}
}
