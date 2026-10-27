import {requestSession} from "../../utils/session-scope";
import QRCode from "qrcode";
import {ReportShare} from "../../models/report-share.model";
import {User} from "../../models/user.model";
import {LabClient} from "../../models/lab-client.model";
import {createReportShareStore,reportShareDescriptor,shareHash,type SharedReport} from "./report-share-store";
import {readReportNotes} from "./report-notes";
import {applyReportStationery,clinicalReportPrintCss} from "./report-stationery";
import {LabBillPayment} from "../../models/lab-bill-payment.model";
import type {DueReceipt} from "../lab-bills/due-collection-plan";
import {invoicePdfWorkflow} from "./invoice-pdf-workflow";
import {reportTimings,type ReportTimings} from "./report-timings";
import {departmentOrderedItems,reportSectionCount} from "../../utils/report-departments";
import { reportHeaderVersion,sharedReportStationery } from "./report-header-asset";
import { recordAudit } from "../audit/audit.service";
import { createHash, randomUUID } from "node:crypto";
import type { Request } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import { getLabBill } from "../lab-bills/lab-bill.service";
import { getBillResultEntry } from "./test-result.service";
import { roleHasPermission } from "../../middleware/require-permission";
import { mergePrintedReports } from "./report-pdf-merge";
import { assertInvoicePrintAllowed, assertPrintableReportAllowed } from "./result-workflow.service";
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

async function snapshot(input:Input,printedBy:string,timing:ReportTimings,final=false) {
  const eligibility=final?"final_eligibility":"eligibility";
  const retrieval=final?"final_data_retrieval":"data_retrieval";
  // Independent reads run together, but eligibility must succeed before any
  // render/cache lookup. Full fresh eligibility and snapshot checks still run twice.
  const [workflow,[bill,entry,results,samples,technician,notes]]=await Promise.all([timing.measure(eligibility,()=>assertPrintableReportAllowed(input.billId,input.testIds)),timing.measure(retrieval,()=>Promise.all([getLabBill(input.billId),getBillResultEntry(input.billId),
    LabTestResult.find({billId:input.billId,testId:{$in:input.testIds}}).sort({parameterId:1}).exec(),
    LabSample.find({billId:input.billId,testId:{$in:input.testIds}}).exec(),
    input.technicianId?LabTechnician.findOne({_id:input.technicianId,active:{$ne:false}}).exec():null,readReportNotes(input.testIds)]))]);
  const assemblyStarted=timing.start();
  const externalReports = workflow.tests.filter(test=>input.testIds.includes(test.testId) && test.uploadedReportId)
    .map(test=>({testId:test.testId,uploadId:test.uploadedReportId!,collectionId:test.collectionId}));
  if(input.technicianId&&!technician)throw new ApiError(422,"Selected technician is unavailable");
  if(results.some(row=>String(row.patientId)!==entry.patientId))throw new ApiError(409,"Report patient association could not be verified");
  const reports=entry.tests.filter(test=>input.testIds.includes(test.testId) && !externalReports.some(row=>row.testId===test.testId)).map(test=>({
    ...notes.get(test.testId),item:bill.items.find(item=>String(item.testId)===test.testId),collectionId:test.collectionId,
    parameters:test.parameters.map(parameter=>({...parameter,id:parameter.parameterId,testId:test.testId,active:true,referenceRange:parameter.reference.displayValue})),
    results:results.filter(row=>String(row.testId)===test.testId),
    resolvedReferences:Object.fromEntries(test.parameters.map(parameter=>[parameter.parameterId,parameter.reference.displayValue??""])),
    referenceResolutions:Object.fromEntries(test.parameters.map(parameter=>[parameter.parameterId,parameter.reference])),
    collectedOn:samples.find(sample=>String(sample.testId)===test.testId)?.collectedAt,
  }));
  const assembled=JSON.parse(JSON.stringify({headerAssetVersion:await reportHeaderVersion(),bill,reports,externalReports,technician,printedBy,onlyEntered:input.onlyEntered==="true",includeHeader:input.includeHeader==="true",letterhead:input.letterhead==="true",printMode:input.printMode}));
  timing.mark(final?"final_snapshot_assembly":"snapshot_assembly",assemblyStarted);
  return assembled;
}
type RenderSnapshot = Awaited<ReturnType<typeof snapshot>> & { invoice?:boolean; paymentReceipt?:DueReceipt;shareQrDataUrl?:string; externalReport?: {testName:string;fileName:string} };
const jobs=new Map<string,{owner:string;expires:number;data:RenderSnapshot}>();
export function reportRenderData(jobId:string,owner:string) {
  const job=jobs.get(jobId);
  if(!job||job.owner!==owner||job.expires<Date.now())throw new ApiError(410,"Report preparation has expired");
  return job.data;
}
const cache=createReportPdfCache();

async function render(data:RenderSnapshot,req:Request,timing:ReportTimings=reportTimings()):Promise<Buffer> {
  const frontend=rendererOrigin(env.FRONTEND_URL),api=rendererOrigin(env.WHATSAPP_RENDER_API_ORIGIN);
  const {token:cookie,name:cookieName}=requestSession(req);if(typeof cookie!=="string"||!cookie)throw new ApiError(401,"Sign in before viewing reports");
  const lease=await timing.measure("browser_acquire",()=>pdfBrowserPool.acquire());let context:import("playwright").BrowserContext|undefined;
  const jobId=randomUUID();jobs.set(jobId,{owner:req.user!.id,expires:Date.now()+60000,data});
  try{
    context=await timing.measure("context_setup",()=>lease.browser.newContext({viewport:{width:1280,height:900}}));
    await context.addCookies([{name:cookieName,value:cookie,url:api,httpOnly:true,secure:api.startsWith("https:"),sameSite:env.COOKIE_SAMESITE==="none"?"None":env.COOKIE_SAMESITE==="strict"?"Strict":"Lax"}]);
    await context.route("**/*",route=>{
      const request=route.request(),url=new URL(request.url());
      // Vendor sessions cannot call administrator APIs. Only this private renderer
      // receives its existing owner-scoped snapshot; no public permission changes.
      if((req.user!.role==="vendor" || data.invoice) && url.origin===api && url.pathname===`/api/v1/lab-test-results/render-data/${jobId}` && ["GET","OPTIONS"].includes(request.method()))return route.fulfill({status:request.method()==="OPTIONS"?204:200,contentType:"application/json",headers:{"Cache-Control":"private, no-store","Access-Control-Allow-Origin":frontend,"Access-Control-Allow-Credentials":"true","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type, X-LIS-Session"},body:request.method()==="OPTIONS"?undefined:JSON.stringify({success:true,data:reportRenderData(jobId,req.user!.id)})});
      return [frontend,api].includes(url.origin)||["data:","blob:"].includes(url.protocol)?route.continue():route.abort();
    });
    const page=await context.newPage();
    await timing.measure("navigation",()=>page.goto(new URL(`/reports/document?jobId=${jobId}`,frontend).href,{waitUntil:"domcontentloaded",timeout:30000}));
    await timing.measure("readiness",()=>page.waitForSelector('[data-report-document="ready"], [data-report-document="error"]',{timeout:30000}));
    if(await page.locator('[data-report-document="error"]').count())throw new ApiError(502,"Authenticated report layout could not be loaded");
    await timing.measure("asset_readiness",()=>page.evaluate("async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode())); }"));
    const expected=data.invoice?1:reportSectionCount(data);
    const contentReady=await page.locator(data.invoice?'.lis-invoice-paper':'.lis-report-paper').evaluateAll((sections,expected)=>sections.length>=expected&&sections.every(section=>(section.textContent??'').trim().length>0||section.querySelector('img')),expected);
    if(!expected||!contentReady)throw new ApiError(502,"The report document has no printable content");
    if(!data.invoice&&!data.externalReport)await page.addStyleTag({content:clinicalReportPrintCss});
    const patientCode=typeof data.bill.patientId === "object" ? data.bill.patientId.patientId : undefined;
    await page.evaluate(`document.title = ${JSON.stringify(`${patientCode || data.bill.billNumber}-report`)}`);
    const raw=await timing.measure("pdf_creation",()=>page.pdf({format:"A4",preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false}));
    const pdf=data.includeHeader&&!data.letterhead&&!data.invoice&&!data.externalReport?await timing.measure("stationery",async()=>applyReportStationery(raw,await sharedReportStationery())):raw;
    await timing.measure("integrity",()=>validatePdf(pdf,data.invoice?"invoice":"report"));return pdf;
  }finally{jobs.delete(jobId);try{await context?.close();}catch{await lease.discard();}finally{lease.release();}}
}

export async function browserReportPdf(input:Input,req:Request,timing:ReportTimings=reportTimings(),vendorScope?:{clientId:string}) {
  if(!req.user)throw new ApiError(401,"Authentication required");
  if(req.user.role==="vendor"?!vendorScope:!roleHasPermission(req.user.role,"test_results.view"))throw new ApiError(403,"Report viewing permission required");
  const data:RenderSnapshot=await timing.measure("lookup",()=>snapshot(input,req.user!.name,timing));
  if(vendorScope && (req.user!.role!=="vendor" || String(data.bill.clientId?.id??data.bill.clientId?._id??data.bill.clientId)!==vendorScope.clientId))throw new ApiError(404,"Bill not found");
  const version=digest(data);
  const share=reportShareDescriptor(env.REPORT_SHARE_PUBLIC_ORIGIN);
  if(share)data.shareQrDataUrl=await timing.measure("qr_creation",()=>QRCode.toDataURL(share.url,{errorCorrectionLevel:"M",margin:4,width:240}));
  const key=digest({owner:req.user!.id,version,share:share?.tokenHash});
  let result:{bytes:Buffer;status:string};
  if(data.externalReports.length) {
    if(!vendorScope && !roleHasPermission(req.user!.role,"reports.print"))throw new ApiError(403,"Permission denied: external report printing requires reports.print");
    // Fetch each source afresh: do not cache away ownership, collection or provider-integrity checks.
    const {printExternalReport}=await import("./external-report-print.js");
    const parts:Buffer[]=[];let group:typeof data.reports=[];
    const flush=async()=>{if(group.length){parts.push(await render({...data,reports:group},req,timing));group=[];}};
    const selectedItems=data.bill.items.filter((item:{testId:string})=>input.testIds.includes(String(item.testId)));
    for(const item of input.printMode==="department"?departmentOrderedItems(selectedItems):selectedItems) {
      const external=data.externalReports.find((row:{testId:string})=>row.testId===String(item.testId));
      if(external){await flush();parts.push(await printExternalReport(input.billId,String(item.testId),external.uploadId,
        input.letterhead==="true"?"letterhead":input.includeHeader==="true"?"header":"none",req,data.shareQrDataUrl));}
      else {const report=data.reports.find((row:{item:{testId:string}})=>String(row.item.testId)===String(item.testId));if(report)group.push(report);}
    }
    await flush();result={bytes:await mergePrintedReports(parts),status:"MISS"};
  } else result=await cache.get(key,()=>render(data,req,timing));
  if(digest(await timing.measure("revalidation",()=>snapshot(input,req.user!.name,timing,true)))!==version)throw new ApiError(409,"Report changed during preparation. Open the current report again");
  for(const external of data.externalReports) await recordAudit({user:req.user!.id,action:"report_attachment.printed",entityType:"LabReportUpload",entity:external.uploadId});
  const filename=`${typeof data.bill.patientId === "object" ? (data.bill.patientId.patientId || data.bill.billNumber) : data.bill.billNumber}-report.pdf`.replace(/[^a-zA-Z0-9._-]/g,"_");
  if(share){
    const pdf=data.includeHeader&&!data.letterhead?result.bytes:await applyReportStationery(result.bytes,await sharedReportStationery());
    await validatePdf(pdf,"report");
    await timing.measure("share_publish",()=>reportShareStore.publish({tokenHash:share.tokenHash,owner:req.user!.id,version,input:{...input},filename,pdf,sha256:shareHash(pdf),expiresAt:share.expiresAt}));
  }
  return {...result,filename};
}

/** Render shared stationery only; composition checks available source space separately. */
export async function renderExternalReportHeader(billId:string,testId:string,fileName:string,includeHeader:boolean,letterhead:boolean,req:Request) {
  const bill=await getLabBill(billId);
  const item=bill.items.find(item=>String(item.testId)===testId);
  if(!item?.outsideLabId)throw new ApiError(422,"This test is not assigned to an outside laboratory");
  return render(JSON.parse(JSON.stringify({bill,reports:[],technician:null,printedBy:req.user!.name,
    includeHeader,letterhead,onlyEntered:false,printMode:"continuous",externalReport:{testName:item.testName,fileName}})),req);
}

/** Same authenticated renderer, with PDF browser headers disabled for invoices too. */
export async function browserInvoicePdf(billId:string,includeHeader:boolean,req:Request,vendorScope?:{clientId:string},paymentId?:string){
 let receipt:DueReceipt|undefined;
 const loadBill=async()=>{const bill=await getLabBill(billId);if(paymentId){
  const row=bill.dueCollections?.find(row=>row.paymentId===paymentId);
  const payment=await LabBillPayment.findOne({_id:paymentId,billId}).exec();
  if(!row||!payment)throw new ApiError(404,"Payment receipt not found for this bill");
  if(payment.amount!==row.amount||payment.discountAmount!==row.discountAmount||payment.remainingBalance!==row.remainingBalance||(row.paymentMode!==undefined&&row.paymentMode!==payment.paymentMode)||new Date(payment.collectedAt).getTime()!==new Date(row.collectedAt).getTime())throw new ApiError(409,"Payment receipt integrity could not be verified");
  const next=JSON.parse(JSON.stringify({...row,paymentMode:payment.paymentMode})) as DueReceipt;if(receipt&&digest(receipt)!==digest(next))throw new ApiError(409,"Payment receipt changed during printing");receipt=next;
 }return bill;};
 return invoicePdfWorkflow({user:req.user,canViewBilling:Boolean(req.user&&roleHasPermission(req.user.role,"billing.view")),vendorClientId:vendorScope?.clientId},{
  getBill:loadBill,assertAllowed:()=>assertInvoicePrintAllowed(billId),
  render:bill=>render({invoice:true,paymentReceipt:receipt,bill,reports:[],externalReports:[],technician:null,printedBy:req.user!.name,onlyEntered:false,includeHeader,letterhead:false,printMode:"continuous"},req),
 });
}

async function validateSharedReport(row:SharedReport) {
 const issuer=await User.findById(row.owner).select("role status name clientId").exec();
 if(!issuer||issuer.status!=="active"||(!roleHasPermission(issuer.role,"test_results.view")&&issuer.role!=="vendor"))throw new ApiError(410,"Report link is unavailable");
 const input=reportPdfQuery.parse({...row.input,testIds:Array.isArray(row.input.testIds)?row.input.testIds.join(","):row.input.testIds});
 let current:Awaited<ReturnType<typeof snapshot>>;
 try{current=await snapshot(input,issuer.name,reportTimings(),true);}catch(error){if(error instanceof ApiError&&error.statusCode<500)throw new ApiError(410,"Report link is unavailable");throw error;}
 if(issuer.role==="vendor"){
  if(!issuer.clientId||!await LabClient.exists({_id:issuer.clientId,active:{$ne:false}})||String(current.bill.clientId?.id??current.bill.clientId?._id??current.bill.clientId)!==String(issuer.clientId))throw new ApiError(410,"Report link is unavailable");
 }
 if(digest(current)!==row.version)throw new ApiError(410,"Report link is unavailable");
}
export const reportShareStore=createReportShareStore({
 find:async tokenHash=>{const row=await ReportShare.findOne({tokenHash,expiresAt:{$gt:new Date()},revokedAt:{$exists:false}}).select("+pdf").exec();return row?{...row.toObject(),pdf:Buffer.from(row.pdf)}:null;},
 save:async row=>{await ReportShare.create(row);},validateCurrent:validateSharedReport,
});
