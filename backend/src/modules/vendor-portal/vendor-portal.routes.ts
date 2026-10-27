import {performance} from "node:perf_hooks";
import type {ReportTimings} from "../test-results/report-timings";
import {z} from "zod";
import {browserInvoicePdf} from "../test-results/report-pdf.service";
import {modifyLabBillSchema} from "../../validations/lab-bill";
import {modifyLabBill} from "../lab-bills/lab-bill.service";
import {editVendorPatient,vendorPatientEditSchema} from "./patient-edit.service";
import {vendorReportStatus} from "./report-status";
import {browserReportPdf,reportPdfQuery} from "../test-results/report-pdf.service";
import { Router } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { ApiError } from "../../utils/api-error";
import { vendorClientId } from "../../utils/vendor-access";
import { LabClient } from "../../models/lab-client.model";
import { LabBill } from "../../models/lab-bill.model";
import { listLabBills } from "../lab-bills/lab-bill.service";
import { listReportUploads, readReportUpload } from "../test-results/report-upload.service";
import { recordAudit } from "../audit/audit.service";
import { validate } from "../../middleware/validate";
import { submitVendorPatient, vendorSubmissionSchema } from "./submission.service";
import { LabTest } from "../../models/lab-test.model";
import { LabSample } from "../../models/lab-sample.model";
import { Doctor } from "../../models/doctor.model";
import { getResultWorkflow, assertPrintableReportAllowed, assertInvoicePrintAllowed } from "../test-results/result-workflow.service";
import { vendorBillView } from "./vendor-bill-view";
import { LabPackage } from "../../models/lab-package.model";
import { Department } from "../../models/department.model";
import { Patient } from "../../models/patient.model";
import { VendorSubmission } from "../../models/vendor-submission.model";
import { editVendorContact, vendorContactSchema } from "./patient-edit.service";
import { LabClientTariff } from "../../models/lab-client-tariff.model";

const router = Router();
router.use(asyncHandler(async (req, _res, next) => {
  const clientId = vendorClientId(req.user!);
  if (!await LabClient.exists({ _id: clientId, active: { $ne: false } })) throw new ApiError(403,"Client account is unavailable");
  next();
}));
router.get("/client",asyncHandler(async(req,res)=>{
 const client=await LabClient.findById(vendorClientId(req.user!)).select("clientCode name").exec();
 if(!client)throw new ApiError(403,"Client account is unavailable");
 return sendSuccess(res,{clientCode:client.clientCode,name:client.name});
}));
router.get("/bills", asyncHandler(async (req, res) => {
  const positive = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Math.max(1,Math.floor(Number(value))) : fallback;
  const result = await listLabBills({clientId: vendorClientId(req.user!), billType:"vendor", page:positive(req.query.page,1), limit:Math.min(100,positive(req.query.limit,20)), search: typeof req.query.search === "string" ? req.query.search : undefined});
  return sendSuccess(res, { ...result, data: await Promise.all(result.data.map(async bill=>({...vendorBillView(bill),...vendorReportStatus(bill,bill.status==="generated" && bill.items.length ? await getResultWorkflow(vendorBillView(bill).id) : {hasOutstandingDue:true,tests:[]})}))) });
}));
router.get("/packages", asyncHandler(async (_req,res)=>sendSuccess(res,await LabPackage.find({active:{$ne:false}}).select("name items").sort({name:1}).exec())));
router.get("/departments",asyncHandler(async(_req,res)=>sendSuccess(res,await Department.find({active:{$ne:false}}).select("name code").sort({sortOrder:1,name:1}).exec())));
router.get("/catalogue", asyncHandler(async (req,res)=>{
  // Never expose the default laboratory tariff. A vendor catalogue contains
  // only tests for which this client has an active, explicitly assigned price.
  const clientId=vendorClientId(req.user!);
  const tariffs=await LabClientTariff.find({clientId,active:true}).select("testId price").lean().exec();
  const priceByTest=new Map(tariffs.map(row=>[String(row.testId),row.price]));
  const tests=await LabTest.find({_id:{$in:[...priceByTest.keys()]},active:{$ne:false}})
    .select("testName testCode departmentId containerType").sort({testName:1}).lean().exec();
  return sendSuccess(res,tests.map(test=>({
    id:String(test._id),testName:test.testName,testCode:test.testCode,
    departmentId:String(test.departmentId),containerType:test.containerType,price:priceByTest.get(String(test._id)),
  })));
}));
router.get("/doctors",asyncHandler(async(_req,res)=>sendSuccess(res,await Doctor.find({active:{$ne:false}}).select("name").sort({name:1}).exec())));
router.post("/submissions",validate(vendorSubmissionSchema),asyncHandler(async(req,res)=>sendSuccess(res,await submitVendorPatient(req.user!,req.body),201)));
router.use("/bills/:id", asyncHandler(async (req, res, next) => {
  if (!Types.ObjectId.isValid(req.params.id)) throw new ApiError(404,"Bill not found");
  const bill = await LabBill.findOne({_id:req.params.id,clientId:vendorClientId(req.user!),billType:"vendor"})
    .populate("patientId","patientId title firstName lastName fullName gender dateOfBirth age mobile")
    .populate("referringDoctorId","name qualification specialization")
    .populate("clientId","clientCode name")
    .exec();
  if (!bill) throw new ApiError(404,"Bill not found");
  res.locals.vendorBill = bill; next();
}));
router.get("/bills/:id", asyncHandler(async (_req,res) => sendSuccess(res,{bill:vendorBillView(res.locals.vendorBill)})));
const vendorBillEditSchema=modifyLabBillSchema.pick({items:true,referringDoctorId:true}).superRefine((value,context)=>{if(value.items.some(item=>item.unitPrice!==undefined||item.packageId||item.out!==undefined||item.outsideLabId!==undefined))context.addIssue({code:"custom",path:["items"],message:"Use individually assigned tests; prices and outside assignments are controlled by the laboratory"});});
router.get("/bills/:id/invoice.pdf",asyncHandler(async(req,res)=>{
 const header=z.enum(["true","false"]).default("true").parse(req.query.includeHeader);
 const result=await browserInvoicePdf(req.params.id,header==="true",req,{clientId:vendorClientId(req.user!)});
 res.set({"Content-Type":"application/pdf","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Disposition":`inline; filename*=UTF-8''${encodeURIComponent(result.filename)}`});res.send(result.bytes);
}));
router.get("/bills/:id/invoice-print-eligibility",asyncHandler(async(req,res)=>sendSuccess(res,await assertInvoicePrintAllowed(req.params.id))));
router.patch("/bills/:id",validate(vendorBillEditSchema),asyncHandler(async(req,res)=>{
 const bill=res.locals.vendorBill;
 if(bill.items.some((item:{packageId?:unknown})=>item.packageId))throw new ApiError(422,"Vendor package amendments require administrator review until a client-package tariff is configured");
 const updated=await modifyLabBill(req.user!.id,req.params.id,{...req.body,discountPercent:bill.discountPercent,paymentMode:bill.paymentMode},{vendorClientId:vendorClientId(req.user!)});
 return sendSuccess(res,{bill:vendorBillView(updated)});
}));
router.get("/bills/:id/patient",asyncHandler(async(_req,res)=>sendSuccess(res,await Patient.findById(res.locals.vendorBill.patientId?._id??res.locals.vendorBill.patientId).select("title firstName lastName gender dateOfBirth age mobile email address updatedAt").exec())));
router.patch("/bills/:id/patient",validate(vendorPatientEditSchema),asyncHandler(async(req,res)=>sendSuccess(res,await editVendorPatient(req.user!,req.params.id,req.body))));
router.get("/bills/:id/report.pdf",asyncHandler(async(req,res)=>{
  const parsed=reportPdfQuery.safeParse({...req.query,billId:req.params.id,testIds:req.query.testIds??res.locals.vendorBill.items.map((item:{testId:unknown})=>String(item.testId)).join(",")});
  if(!parsed.success)throw new ApiError(400,"Invalid report options");
  const timing=res.locals.reportTiming as ReportTimings;
  timing.mark("authorization_validation",res.locals.reportAuthorizationStarted??performance.now());
  const report=await browserReportPdf(parsed.data,req,timing,{clientId:vendorClientId(req.user!)});
  res.set({"Content-Type":"application/pdf","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Disposition":`${parsed.data.download==="true"?"attachment":"inline"}; filename="${report.filename}"; filename*=UTF-8''${encodeURIComponent(report.filename)}`});
  res.set({"X-Report-Cache":report.status,"Server-Timing":timing.header()});
  res.locals.reportDeliveryStarted=performance.now();return res.send(report.bytes);
}));
router.get("/bills/:id/contact", asyncHandler(async (req,res)=>{
  const bill=res.locals.vendorBill;
  if(!await VendorSubmission.exists({billId:bill._id,clientId:vendorClientId(req.user!),state:"completed"}))throw new ApiError(404,"Editable vendor submission not found");
  return sendSuccess(res,await Patient.findById(bill.patientId?._id??bill.patientId).select("mobile email address updatedAt").exec());
}));
router.patch("/bills/:id/contact", validate(vendorContactSchema),asyncHandler(async(req,res)=>sendSuccess(res,await editVendorContact(req.user!,req.params.id,req.body))));
router.get("/bills/:id/workflow",asyncHandler(async(req,res)=>{const workflow=await getResultWorkflow(req.params.id);return sendSuccess(res,{billId:workflow.billId,hasOutstandingDue:workflow.hasOutstandingDue,tests:workflow.tests});}));
router.get("/bills/:id/samples",asyncHandler(async(req,res)=>sendSuccess(res,await LabSample.find({billId:req.params.id,patientId:res.locals.vendorBill.patientId?._id??res.locals.vendorBill.patientId}).select("testId sampleStatus collectedAt receivedAt processedAt").exec())));
// Report metadata must obey the same fresh release/dues gate as its bytes.
router.use("/bills/:id/attachments",asyncHandler(async(req,_res,next)=>{await assertPrintableReportAllowed(req.params.id,[String(req.query.testId??"")]);next();}));
router.get("/bills/:id/attachments", asyncHandler(async (req,res) => sendSuccess(res,await listReportUploads(req.params.id,String(req.query.testId ?? "")))));
router.get("/bills/:id/attachments/:attachmentId", asyncHandler(async (req,res) => {
  const row = await readReportUpload(req.params.id,String(req.query.testId ?? ""),req.params.attachmentId);
  await recordAudit({user:req.user!.id,action:"report_attachment.download",entityType:"LabReportUpload",entity:String(row._id)});
  res.set({"Content-Type":"application/pdf","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Disposition":`${req.query.view === "true" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(row.fileName)}`});
  return res.send(row.content);
}));
export default router;
