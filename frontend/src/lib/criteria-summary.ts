/** Summarize actual selections without losing the full filter state. */
export function selectionSummary(ids: string[], options: {value:string;label:string}[]):string {
 const unique=[...new Set(ids)];if(!unique.length)return 'All';if(unique.length===1)return options.find(row=>row.value===unique[0])?.label??'Unavailable selection';
 const available=new Set(options.map(row=>row.value));return available.size>0&&unique.length===available.size&&unique.every(id=>available.has(id))?'All selected':'Multiple selected ('+unique.length+')';
}
