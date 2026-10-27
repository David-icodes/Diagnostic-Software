import {Router} from "express";
import {z} from "zod";
import {asyncHandler} from "../../utils/async-handler";
import {ApiError} from "../../utils/api-error";
import {reportShareStore} from "./report-pdf.service";
const router=Router();
const buckets=new Map<string,{count:number;until:number}>();
// Socket identity only. The limiter is bounded and resets on process restart.
router.use((_req,res,next)=>{res.set({"Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow, noarchive"});next();});
router.post("/view",asyncHandler(async(req,res)=>{
 const now=Date.now();for(const [key,bucket] of buckets)if(bucket.until<=now)buckets.delete(key);
 const key=req.socket.remoteAddress??"unknown";let bucket=buckets.get(key);
 if(!bucket){if(buckets.size>=2048)throw new ApiError(429,"Please retry later");bucket={count:0,until:now+60000};buckets.set(key,bucket);}
 if(++bucket.count>60)throw new ApiError(429,"Please retry later");
 const parsed=z.object({token:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict().safeParse(req.body);
 if(!parsed.success)throw new ApiError(410,"Report link is unavailable");
 const row=await reportShareStore.view(parsed.data.token);
 res.set({"Content-Type":"application/pdf","X-Content-Type-Options":"nosniff","Content-Disposition":`inline; filename="${row.filename}"`});
 return res.send(row.pdf);
}));
router.all("/view",(_req,res)=>res.status(405).set("Allow","POST").end());
export default router;
