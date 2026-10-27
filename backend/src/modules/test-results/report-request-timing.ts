import type {RequestHandler} from 'express';
import {performance} from 'node:perf_hooks';
import {reportTimings,type ReportTimings} from './report-timings';

/** Fixed metadata only. Neither request paths nor error strings enter diagnostics. */
export const reportRequestTiming:RequestHandler=(req,res,next)=>{
 if(req.method!=='GET'||!/(?:^|\/)report\.pdf\/?$/i.test(req.path))return next();
 if(res.locals.reportTiming)return next();
 const timing=reportTimings();res.locals.reportTiming=timing;
 res.setHeader('X-Report-Request-Id',timing.id);
 let emitted=false;
 const complete=(completed:boolean)=>{
  if(emitted)return;emitted=true;
  if(timing.stages.authorization_validation===undefined&&typeof res.locals.reportAuthorizationStarted==='number')timing.mark('authorization_validation',res.locals.reportAuthorizationStarted);
  if(typeof res.locals.reportDeliveryStarted==='number')timing.mark('response_delivery',res.locals.reportDeliveryStarted);
  const cache=res.getHeader('X-Report-Cache');
  console.info('[report-timing]',JSON.stringify({requestId:timing.id,status:res.statusCode,completed,
   bytes:Number(res.getHeader('Content-Length')??0),cache:['HIT','MISS','SHARED'].includes(String(cache))?cache:'NONE',
   stages:timing.stages,totalMs:timing.elapsed()}));
 };
 res.once('finish',()=>complete(true));res.once('close',()=>complete(res.writableFinished));next();
};

/** Includes failed authentication and preserves the original middleware behavior. */
export function timedReportAuthentication(authenticate:RequestHandler):RequestHandler{
 return (req,res,next)=>{
  const timing=res.locals.reportTiming as ReportTimings|undefined;
  if(!timing)return authenticate(req,res,next);
  const start=performance.now();
  return authenticate(req,res,error=>{
   timing.mark('authentication',start);
   if(!error)res.locals.reportAuthorizationStarted=performance.now();
   next(error);
  });
 };
}
