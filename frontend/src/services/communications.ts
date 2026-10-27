import {api} from '@/lib/api';
const origin=(process.env.NEXT_PUBLIC_API_URL??'/api/v1').replace(/\/api\/v1\/?$/,'');
export const communicationRequest=<T,>(path:string,method:'GET'|'POST'|'PUT'='GET',body?:unknown)=>api.request<T>('/api/whatsapp/communications'+path,{method,body},origin).then(result=>result.data as T);
export interface CommunicationTemplate {id:string;name:string;language:string;status:string;category:string;components?:{type:string;text?:string}[];}
export interface CommunicationManagement {autoThankYou:boolean;configurationError:string;templates:CommunicationTemplate[];thanksLanguage:string;verifiedAt:string|null;}
export interface CommunicationConsent {patientId:string;verified?:boolean;serviceOptIn:boolean;marketingOptIn:boolean;optInAt?:string;source:string;optOutAt?:string;}
