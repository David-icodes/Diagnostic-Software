const key=(value:string)=>value.toLowerCase().replace(/\bwith\s+in\b/g,"within").replace(/\s+/g," ").trim();
/** Presentation-only duplicate lines inside one smear observation. Distinct rows stay intact. */
export function smearReportText(value:string):string {
  const seen=new Set<string>();
  return value.split(/\r?\n/).filter(line=>{const k=key(line);if(!k)return true;if(seen.has(k))return false;seen.add(k);return true;}).join("\n");
}
export function repeatedSmearLabel(label:string,value:string):boolean {
  return Boolean(key(label)) && value.split(/\r?\n/).some(line=>key(line)===key(label));
}

/** The lab's compact smear presentation; raw saved observations are not rewritten. */
export function compactSmearParameters<T extends {parameterName:string;subtitle?:string;itemType?:string}>(parameters:T[]):T[]{
 let smear=false;const output:T[]=[];
 for(const parameter of parameters){
  const name=key(parameter.parameterName),subtitle=key(parameter.subtitle??"");
  if(name==='peripheral smear'||subtitle==='peripheral smear')smear=true;
  else if(parameter.itemType==='SUBTITLE'&&name!=='within normal limits')smear=false;
  if(smear&&(name==='within normal limits'||(name==='peripheral smear'&&parameter.itemType==='SUBTITLE')))continue;
  const row=['r b c','rbc','w b c','wbc','platelets'].includes(name);
  output.push(smear&&row?{...parameter,subtitle:'PERIPHERAL SMEAR'}:parameter);
 }
 return output;
}
export function compactSmearValue(name:string,value:string):string{
 const normalized=key(name);
 return ['rbc','r b c'].includes(normalized)?smearReportText(value).split(/\r?\n/).find(line=>line.trim())??'':smearReportText(value);
}
