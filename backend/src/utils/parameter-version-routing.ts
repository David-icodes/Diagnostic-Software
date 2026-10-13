import { ApiError } from "./api-error";
export interface ParameterLineage { originalId:string; predecessorId:string; version:number; manifestReference:string }
export interface VersionedParameter { _id:unknown; active?:boolean; lineage?:ParameterLineage }
/** Explicit complete order pins only; never select a successor by date or name. */
export function routeParameterVersions<T extends VersionedParameter>(catalogue:T[],pins:string[]|undefined,saved:Array<{parameterId:unknown}>=[]):T[] {
 const byId=new Map(catalogue.map(p=>[String(p._id),p]));const savedIds=new Set(saved.map(r=>String(r.parameterId)));
 if(pins&&(new Set(pins).size!==pins.length||pins.some(id=>!byId.has(id))))throw new ApiError(409,"Missing or duplicated order version pin; reconcile before entry");
 const selected=pins?pins.map(id=>byId.get(id)!):catalogue.filter(p=>!p.lineage&&(p.active!==false||savedIds.has(String(p._id))));
 if([...savedIds].some(id=>!selected.some(p=>String(p._id)===id)))throw new ApiError(409,"Saved result versions conflict with routing; preserve history and reconcile");
 const logical=new Set<string>();
 for(const p of selected){const id=String(p._id),key=p.lineage?.originalId??id;
  if(logical.has(key))throw new ApiError(409,"Two versions of the same parameter cannot share an order");logical.add(key);
  if(p.lineage&&(!Number.isInteger(p.lineage.version)||p.lineage.version<2||!p.lineage.manifestReference.trim()||!byId.has(p.lineage.originalId)||!byId.has(p.lineage.predecessorId)))throw new ApiError(409,"Incomplete parameter lineage");
 }
 return selected;
}
/** Historical display metadata belongs to the saved snapshot, not today's master. */
export function recordedParameterProjection<T extends object>(master:T,saved?:{parameterName:string;resultType:string;unit?:string;method?:string;referenceRange?:string}):T {
 return saved?{...master,parameterName:saved.parameterName,resultType:saved.resultType,unit:saved.unit,method:saved.method,referenceRange:saved.referenceRange}:master;
}
