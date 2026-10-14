import { createHash, randomUUID } from "node:crypto";
import type { Request } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import { getLabBill } from "../lab-bills/lab-bill.service";
import { getBillResultEntry } from "./test-result.service";
import { assertResultReportAllowed } from "./result-workflow.service";
import { LabTestResult } from "../../models/lab-test-result.model";
import { LabSample } from "../../models/lab-sample.model";
import { LabTechnician } from "../../models/lab-technician.model";
import { pdfBrowserPool } from "../whatsapp/pdf-browser-pool";
import { rendererOrigin } from "../whatsapp/lis-pdf-diagnostics";
import { validatePdf } from "../documents/pdf-integrity";
import { createReportPdfCache } from "./report-pdf-cache";

const id=z.string().regex(/^[a-f\d]{24}$/i,"Invalid report identifier");
export const reportPdfQuery=z.object({billId:id,testIds:z.string().min(1).transform(value=>value.split(",")).pipe(z.array(id).min(1).max(100)),
  technicianId:id.optional(),onlyEntered:z.enum(["true","false"]).default("false"),includeHeader:z.enum(["true","false"]).default("false"),
  letterhead:z.enum(["true","false"]).default("false"),printMode:z.enum(["continuous","department","test"]).default("continuous"),download:z.enum(["true","false"]).default("false")}).strict();
type Input=z.infer<typeof reportPdfQuery>;
const digest=(data:unknown)=>createHash("sha256").update(JSON.stringify(data)).digest("hex");

async function snapshot(input:Input,printedBy:string) {
  await assertResultReportAllowed(input.billId,input.testIds);
  const [bill,entry,results,samples,technician]=await Promise.all([getLabBill(input.billId),getBillResultEntry(input.billId),
    LabTestResult.find({billId:input.billId,testId:{$in:input.testIds}}).sort({parameterId:1}).exec(),
    LabSample.find({billId:input.billId,testId:{$in:input.testIds}}).exec(),
    input.technicianId?LabTechnician.findOne({_id:input.technicianId,active:{$ne:false}}).exec():null]);
  if(input.technicianId&&!technician)throw new ApiError(422,"Selected technician is unavailable");
  if(results.some(row=>String(row.patientId)!==entry.patientId))throw new ApiError(409,"Report patient association could not be verified");
  const reports=entry.tests.filter(test=>input.testIds.includes(test.testId)).map(test=>({
    item:bill.items.find(item=>String(item.testId)===test.testId),collectionId:test.collectionId,
    parameters:test.parameters.map(parameter=>({...parameter,id:parameter.parameterId,testId:test.testId,active:true,referenceRange:parameter.reference.displayValue})),
    results:results.filter(row=>String(row.testId)===test.testId),
    resolvedReferences:Object.fromEntries(test.parameters.map(parameter=>[parameter.parameterId,parameter.reference.displayValue??""])),
    referenceResolutions:Object.fromEntries(test.parameters.map(parameter=>[parameter.parameterId,parameter.reference])),
    collectedOn:samples.find(sample=>String(sample.testId)===test.testId)?.collectedAt,
  }));
  return JSON.parse(JSON.stringify({bill,reports,technician,printedBy,onlyEntered:input.onlyEntered==="true",includeHeader:input.includeHeader==="true",letterhead:input.letterhead==="true",printMode:input.printMode}));
}
const jobs=new Map<string,{owner:string;expires:number;data:Awaited<ReturnType<typeof snapshot>>}>();
export function reportRenderData(jobId:string,owner:string) {
  const job=jobs.get(jobId);
  if(!job||job.owner!==owner||job.expires<Date.now())throw new ApiError(410,"Report preparation has expired");
  return job.data;
}
const cache=createReportPdfCache();

async function render(data:Awaited<ReturnType<typeof snapshot>>,req:Request):Promise<Buffer> {
  const frontend=rendererOrigin(env.FRONTEND_URL),api=rendererOrigin(env.WHATSAPP_RENDER_API_ORIGIN);
  const cookie=req.cookies?.[env.COOKIE_NAME];if(typeof cookie!=="string"||!cookie)throw new ApiError(401,"Sign in before viewing reports");
  const lease=await pdfBrowserPool.acquire();let context:import("playwright").BrowserContext|undefined;
  const jobId=randomUUID();jobs.set(jobId,{owner:req.user!.id,expires:Date.now()+60000,data});
  try{
    context=await lease.browser.newContext({viewport:{width:1280,height:900}});
    await context.addCookies([{name:env.COOKIE_NAME,value:cookie,url:api,httpOnly:true,secure:api.startsWith("https:"),sameSite:env.COOKIE_SAMESITE==="none"?"None":env.COOKIE_SAMESITE==="strict"?"Strict":"Lax"}]);
    await context.route("**/*",route=>{const url=new URL(route.request().url());return [frontend,api].includes(url.origin)||["data:","blob:"].includes(url.protocol)?route.continue():route.abort();});
    const page=await context.newPage();
    await page.goto(new URL(`/reports/document?jobId=${jobId}`,frontend).href,{waitUntil:"domcontentloaded",timeout:30000});
    await page.waitForSelector('[data-report-document="ready"], [data-report-document="error"]',{timeout:30000});
    if(await page.locator('[data-report-document="error"]').count())throw new ApiError(502,"Authenticated report layout could not be loaded");
    await page.evaluate("async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.complete ? Promise.resolve() : new Promise(resolve => { image.onload=resolve; image.onerror=resolve; }))); }");
    const pdf=await page.pdf({format:"A4",preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});await validatePdf(pdf,"report");return pdf;
  }finally{jobs.delete(jobId);try{await context?.close();}catch{await lease.discard();}finally{lease.release();}}
}

export async function browserReportPdf(input:Input,req:Request) {
  const data=await snapshot(input,req.user!.name);const version=digest(data);const key=digest({owner:req.user!.id,version});
  const result=await cache.get(key,()=>render(data,req));
  if(digest(await snapshot(input,req.user!.name))!==version)throw new ApiError(409,"Report changed during preparation. Open the current report again");
  return {...result,filename:`${data.bill.billNumber}-report.pdf`.replace(/[^a-zA-Z0-9._-]/g,"_")};
}
