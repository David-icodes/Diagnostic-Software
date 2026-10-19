import {hasEnteredResult} from './lab-workflows.ts';
/** Only persisted result values count; configuration defaults are not entries. */
export function enteredReportParameters<T extends {id:string;itemType?:string}>(parameters:T[],results:{parameterId:string;result:unknown}[]):T[]{
 const entered=new Set(results.filter(row=>hasEnteredResult(row.result)).map(row=>row.parameterId));
 return parameters.filter((parameter,index)=>{
  if(parameter.itemType!=="SUBTITLE")return entered.has(parameter.id);
  for(let next=index+1;next<parameters.length&&parameters[next].itemType!=="SUBTITLE";next++)if(entered.has(parameters[next].id))return true;
  return false;
 });
}
