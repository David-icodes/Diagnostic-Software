import {createHash,randomBytes} from "node:crypto";
import {ApiError} from "../../utils/api-error";

export const shareHash=(value:Buffer|string)=>createHash("sha256").update(value).digest("hex");
export interface SharedReport {
 tokenHash:string;owner:string;version:string;input:Record<string,unknown>;filename:string;
 pdf:Buffer;sha256:string;expiresAt:Date;revokedAt?:Date;
}
export function reportShareDescriptor(origin:string,now=new Date()) {
 const url=new URL(origin);
 if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash)throw new ApiError(503,"Configure an exact HTTPS report sharing origin");
 const token=randomBytes(32).toString("base64url");
 return {token,tokenHash:shareHash(token),url:`${url.origin}/shared-report#${token}`,expiresAt:new Date(now.getTime()+30*86400000)};
}
/** No database IDs or patient information are present in the bearer URL. */
export function createReportShareStore(deps:{find:(hash:string)=>Promise<SharedReport|null>;save:(row:SharedReport)=>Promise<void>;validateCurrent:(row:SharedReport)=>Promise<void>;now?:()=>Date}) {
 const now=()=>deps.now?.()??new Date();
 const safe=async<T>(work:()=>Promise<T>):Promise<T>=>{try{return await work();}catch(error){if(error instanceof ApiError)throw error;throw new ApiError(503,"Report is temporarily unavailable");}};
 return {
  async publish(row:SharedReport) {
   if(!/^[a-zA-Z0-9._-]+\.pdf$/.test(row.filename))throw new ApiError(422,"Report cannot be shared");
   if(row.pdf.length>10*1024*1024||row.pdf.subarray(0,5).toString()!=="%PDF-"||row.sha256!==shareHash(row.pdf))throw new ApiError(422,"Report cannot be shared");
   if(row.expiresAt.getTime()<=now().getTime())throw new ApiError(410,"Report link is unavailable");
   await safe(()=>deps.validateCurrent(row));await safe(()=>deps.save(row));
  },
  async view(token:string) {
   if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new ApiError(410,"Report link is unavailable");
   const row=await safe(()=>deps.find(shareHash(token)));
   if(!row||row.revokedAt||row.expiresAt.getTime()<=now().getTime())throw new ApiError(410,"Report link is unavailable");
   await safe(()=>deps.validateCurrent(row));
   if(shareHash(row.pdf)!==row.sha256)throw new ApiError(410,"Report link is unavailable");
   return row;
  },
 };
}
