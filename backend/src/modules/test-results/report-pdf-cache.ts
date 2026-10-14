import { createHash } from "node:crypto";
import { ApiError } from "../../utils/api-error";

/** Bounded, expiring, owner/snapshot-keyed reuse; no browser or authorization is cached. */
export function createReportPdfCache(ttlMs=120000,maxBytes=32*1024*1024,now=Date.now) {
  const cache=new Map<string,{bytes:Buffer;hash:string;expires:number}>();
  const pending=new Map<string,Promise<Buffer>>();
  const hash=(bytes:Buffer)=>createHash("sha256").update(bytes).digest("hex");
  return { async get(key:string,render:()=>Promise<Buffer>) {
    for(const [id,row] of cache)if(row.expires<=now())cache.delete(id);
    const row=cache.get(key);
    if(row){if(hash(row.bytes)!==row.hash){cache.delete(key);throw new ApiError(502,"Report integrity verification failed");}return {bytes:row.bytes,status:"HIT"};}
    const waiting=pending.get(key);if(waiting)return {bytes:await waiting,status:"SHARED"};
    const work=(async()=>{const bytes=await render();if(bytes.length>maxBytes)throw new ApiError(422,"Report exceeds the viewing limit");
      let retained=[...cache.values()].reduce((sum,value)=>sum+value.bytes.length,0);
      for(const [id,value]of cache){if(retained+bytes.length<=maxBytes)break;cache.delete(id);retained-=value.bytes.length;}
      cache.set(key,{bytes,hash:hash(bytes),expires:now()+ttlMs});return bytes;
    })();pending.set(key,work);
    try{return {bytes:await work,status:"MISS"};}finally{pending.delete(key);}
  }};
}
