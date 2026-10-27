export interface ResultEditMetadata {
 origin:'DEFAULT'|'ENTERED'|'LEGACY'|'CALCULATED';
 defaultValue?:string;
 manuallyChanged:boolean;
 changedAt?:Date;
 changedBy?:string;
}
type Saved={result:unknown;resultDisplay?:string;editMetadata?:ResultEditMetadata};
const text=(value:unknown)=>value===undefined||value===null?'':String(value).trim();
/** A real input event plus a server-verified change, never a reload/default comparison alone. */
export function resultEditMetadata(input:{result:unknown;resultDisplay?:string;manuallyEdited?:boolean},saved:Saved|undefined,defaultValue:string|undefined,calculated:boolean,actor:string,now:Date):ResultEditMetadata {
 if(calculated)return {origin:'CALCULATED',manuallyChanged:false};
 const previous=saved?.editMetadata;
 const origin=previous?.origin??(saved?'LEGACY':defaultValue!==undefined&&defaultValue!==''?'DEFAULT':'ENTERED');
 const baseline=saved?(saved.resultDisplay??saved.result):defaultValue;
 const changed=input.manuallyEdited===true&&text(input.resultDisplay??input.result)!==text(baseline);
 const manuallyChanged=Boolean(previous?.manuallyChanged||(changed&&(Boolean(saved)||origin==='DEFAULT')));
 return {origin,...(previous?.defaultValue!==undefined?{defaultValue:previous.defaultValue}:!saved&&defaultValue!==undefined?{defaultValue}:{}),manuallyChanged,
  ...(changed&&manuallyChanged?{changedAt:now,changedBy:actor}:previous?.changedAt?{changedAt:previous.changedAt,changedBy:previous.changedBy}:{})};
}
