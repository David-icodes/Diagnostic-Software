import {env} from '../../config/env';import {ApiError} from '../../utils/api-error';
export interface MetaTemplate {id:string;name:string;language:string;status:string;category:string;components?:{type:string;text?:string;format?:string;buttons?:{type?:string;url?:string;text?:string;phone_number?:string}[];example?:{header_handle?:string[]}}[];}
export async function approvedTemplateInventory():Promise<MetaTemplate[]> {
 if(!env.WHATSAPP_WABA_ID||!env.WHATSAPP_ACCESS_TOKEN)throw new ApiError(503,'Configure the WhatsApp business account and access token on the server.');
 const rows:MetaTemplate[]=[];let after:string|undefined;
 for(let page=0;page<20;page++){
  const query=new URLSearchParams({fields:'id,name,language,status,category,components',limit:'100',...(after?{after}:{})});
  const response=await fetch(`https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}/${encodeURIComponent(env.WHATSAPP_WABA_ID)}/message_templates?${query}`,{headers:{Authorization:`Bearer ${env.WHATSAPP_ACCESS_TOKEN}`},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new ApiError(503,'Template approval could not be verified with Meta.');
  const data=await response.json() as {data?:MetaTemplate[];paging?:{cursors?:{after?:string};next?:string}};rows.push(...(data.data??[]));
  if(!data.paging?.next)return rows;after=data.paging.cursors?.after;if(!after)break;
 }throw new ApiError(503,'Template inventory is too large or incomplete.');
}
