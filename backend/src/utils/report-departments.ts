/** Stable department order used for mixed uploaded/in-house PDF composition. */
export function departmentOrderedItems<T extends {departmentId?:unknown;departmentName:string}>(items:readonly T[]):T[]{
 const groups=new Map<string,T[]>();
 for(const item of items){const key=item.departmentId?String(item.departmentId):item.departmentName.trim();const group=groups.get(key);if(group)group.push(item);else groups.set(key,[item]);}
 return [...groups.values()].flat();
}
export function reportSectionCount(data:{externalReport?:unknown;printMode:string;reports:Array<{item:{departmentId?:unknown;departmentName:string}}>}){
 if(data.externalReport)return 1;
 return data.printMode==="department"?new Set(data.reports.map(report=>report.item.departmentId?String(report.item.departmentId):report.item.departmentName.trim())).size:data.reports.length;
}
