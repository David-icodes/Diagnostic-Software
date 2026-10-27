import {createHash} from 'node:crypto';
import {ApiError} from '../../utils/api-error';
import type {MetaTemplate} from './communication-templates';
import {normalizeLisRecipient} from './lis-recipient';
export const phoneHash=(mobile:string)=>createHash('sha256').update(normalizeLisRecipient(mobile)).digest('hex');
export function consentAllowed(consent:{mobileHash?:string;optOutAt?:unknown;serviceOptIn?:boolean;marketingOptIn?:boolean;optInAt?:unknown}|null,hash:string,kind:'thank-you'|'camp') {return Boolean(consent&&consent.mobileHash===hash&&!consent.optOutAt&&consent.optInAt&&(kind==='camp'?consent.marketingOptIn:consent.serviceOptIn));}
export function assertCampaignTemplate(template:Pick<MetaTemplate,'status'|'category'|'language'|'components'>,values:string[]=[]) {
 if(template.status!=='APPROVED'||template.category!=='MARKETING'||!/^en(?:_[A-Z]{2})?$/.test(template.language))throw new ApiError(422,'Choose a verified, approved English marketing template.');
 if(template.components?.some(c=>!['BODY','FOOTER','HEADER','BUTTONS'].includes(c.type)))throw new ApiError(422,'Complete the camp template in Meta.');
 for(const component of template.components??[]){if(component.type==='HEADER'&&!(component.format==='IMAGE'||component.format==='TEXT'&&!/\{\{/.test(component.text??'')))throw new ApiError(422,'Use a fixed text or image header in Meta.');if(component.type==='BUTTONS'&&component.buttons?.some(button=>!['URL','PHONE_NUMBER','QUICK_REPLY'].includes(button.type??'')||/\{\{/.test(button.url??'')))throw new ApiError(422,'Complete the camp buttons in Meta.');}
 if(template.components?.some(c=>c.type==='HEADER'&&c.format==='IMAGE'))campImageUrl(template);
 if(template.components?.filter(c=>c.type==='BODY').length!==1||template.components.some(c=>c.type==='FOOTER'&&/\{\{/.test(c.text??'')))throw new ApiError(422,'The camp template must have one verified body.');
 const text=template.components.find(c=>c.type==='BODY')?.text??'';
 const slots=[...new Set([...text.matchAll(/\{\{(\d+)\}\}/g)].map(m=>Number(m[1])))].sort((a,b)=>a-b);
 if(/\{\{/.test(text.replace(/\{\{\d+\}\}/g,''))||slots.some((slot,index)=>slot!==index+1)||slots.length!==values.length||values.some(v=>!v.trim()||v.length>500))throw new ApiError(422,'Fill every numbered campaign-template variable exactly once.');
}
export const failureState=(attempted:boolean,explicitProviderFailure:boolean)=>!attempted?'blocked':explicitProviderFailure?'failed':'uncertain';

export function thankYouIntent(billType:string,status:string|undefined,optedIn:boolean|undefined,mobile:string,now=new Date()) {
 if(billType!=='osp'||status!=='generated'||optedIn!==true)return {};
 let hash:string;try{hash=phoneHash(mobile);}catch{return {};}
 return {whatsappThanksPending:true,whatsappThanksConsentAt:now,whatsappThanksMobileHash:hash};
}

export function assertThankYouTemplate(template:{components?:{type:string;text?:string}[]}) {
 const components=template.components??[], body=components.filter(c=>c.type==='BODY');
 if(body.length!==1||components.some(c=>!['BODY','FOOTER'].includes(c.type))||components.some(c=>c.type==='FOOTER'&&/\{\{/.test(c.text??'')))throw new ApiError(422,'Greeting template requires unsupported fields.');
 const text=body[0].text??'',slots=[...new Set([...text.matchAll(/\{\{(\d+)\}\}/g)].map(m=>Number(m[1])))].sort((a,b)=>a-b);
 if(slots.length!==2||slots[0]!==1||slots[1]!==2||/\{\{/.test(text.replace(/\{\{\d+\}\}/g,'')))throw new ApiError(422,'Greeting template must contain the verified patient and centre variables.');
}

export function campImageUrl(template:Pick<MetaTemplate,'components'>):string|undefined {
 const header=template.components?.find(c=>c.type==='HEADER'&&c.format==='IMAGE');if(!header)return;
 const value=header.example?.header_handle?.[0];let url:URL;try{url=new URL(value??'');}catch{throw new ApiError(422,'Set a usable camp image in Meta.');}
 if(url.protocol!=='https:'||url.username||url.password||url.port||!['facebook.com','fbcdn.net','whatsapp.net','fbsbx.com'].some(domain=>url.hostname===domain||url.hostname.endsWith('.'+domain)))throw new ApiError(422,'The camp image must come from Meta.');
 return url.href;
}
export function campaignTemplateComponents(template:Pick<MetaTemplate,'status'|'category'|'language'|'components'>,values:string[]=[]) {
 assertCampaignTemplate(template,values);const image=campImageUrl(template);const components:unknown[]=[];
 if(image)components.push({type:'header',parameters:[{type:'image',image:{link:image}}]});
 if(values.length)components.push({type:'body',parameters:values.map(text=>({type:'text',text}))});
 return components.length?components:undefined;
}

/** Fixed operational wording; never copy a provider response containing recipient data. */
export function communicationFailureReason(error:unknown,attempted:boolean){
 const code=error instanceof ApiError?(error.details as {metaErrorCode?:string}|undefined)?.metaErrorCode:undefined;
 if(attempted){if(code==='131049')return 'Meta restricted this marketing message (131049).';if(code==='132001')return 'The template or configured language is unavailable in Meta (132001).';return code?`Meta rejected the message (${code}).`:'Delivery could not be confirmed. Check its status before retrying.';}
 return error instanceof ApiError?error.message:'Message preparation could not be completed.';
}
