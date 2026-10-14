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
import { getResultWorkflow, assertResultReportAllowed } from "../test-results/result-workflow.service";
import { vendorBillView } from "./vendor-bill-view";
import { LabPackage } from "../../models/lab-package.model";
import { Department } from "../../models/department.model";
import { Patient } from "../../models/patient.model";
import { VendorSubmission } from "../../models/vendor-submission.model";
import { editVendorContact, vendorContactSchema } from "./patient-edit.service";

const router = Router();
router.use(asyncHandler(async (req, _res, next) => {
  const clientId = vendorClientId(req.user!);
  if (!await LabClient.exists({ _id: clientId, active: { $ne: false } })) throw new ApiError(403,"Client account is unavailable");
  next();
}));
router.get("/bills", asyncHandler(async (req, res) => {
  const positive = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Math.max(1,Math.floor(Number(value))) : fallback;
  const result = await listLabBills({clientId: vendorClientId(req.user!), billType:"vendor", page:positive(req.query.page,1), limit:Math.min(100,positive(req.query.limit,20)), search: typeof req.query.search === "string" ? req.query.search : undefined});
  return sendSuccess(res, { ...result, data: result.data.map(vendorBillView) });
}));
router.get("/packages", asyncHandler(async (_req,res)=>sendSuccess(res,await LabPackage.find({active:{$ne:false}}).select("name items").sort({name:1}).exec())));
router.get("/departments",asyncHandler(async(_req,res)=>sendSuccess(res,await Department.find({active:{$ne:false}}).select("name code").sort({sortOrder:1,name:1}).exec())));
router.get("/catalogue", asyncHandler(async (_req,res)=>sendSuccess(res,await LabTest.find({active:{$ne:false}}).select("testName testCode departmentId").sort({testName:1}).exec())));
router.get("/doctors",asyncHandler(async(_req,res)=>sendSuccess(res,await Doctor.find({active:{$ne:false}}).select("name").sort({name:1}).exec())));
router.post("/submissions",validate(vendorSubmissionSchema),asyncHandler(async(req,res)=>sendSuccess(res,await submitVendorPatient(req.user!,req.body),201)));
router.use("/bills/:id", asyncHandler(async (req, res, next) => {
  if (!Types.ObjectId.isValid(req.params.id)) throw new ApiError(404,"Bill not found");
  const bill = await LabBill.findOne({_id:req.params.id,clientId:vendorClientId(req.user!),billType:"vendor"}).populate("patientId","patientId fullName gender age").exec();
  if (!bill) throw new ApiError(404,"Bill not found");
  res.locals.vendorBill = bill; next();
}));
router.get("/bills/:id", asyncHandler(async (_req,res) => sendSuccess(res,{bill:vendorBillView(res.locals.vendorBill)})));
router.get("/bills/:id/contact", asyncHandler(async (req,res)=>{
  const bill=res.locals.vendorBill;
  if(!await VendorSubmission.exists({billId:bill._id,clientId:vendorClientId(req.user!),state:"completed"}))throw new ApiError(404,"Editable vendor submission not found");
  return sendSuccess(res,await Patient.findById(bill.patientId?._id??bill.patientId).select("mobile email address updatedAt").exec());
}));
router.patch("/bills/:id/contact", validate(vendorContactSchema),asyncHandler(async(req,res)=>sendSuccess(res,await editVendorContact(req.user!,req.params.id,req.body))));
router.get("/bills/:id/workflow",asyncHandler(async(req,res)=>{const workflow=await getResultWorkflow(req.params.id);return sendSuccess(res,{billId:workflow.billId,hasOutstandingDue:workflow.hasOutstandingDue,tests:workflow.tests});}));
router.get("/bills/:id/samples",asyncHandler(async(req,res)=>sendSuccess(res,await LabSample.find({billId:req.params.id,patientId:res.locals.vendorBill.patientId?._id??res.locals.vendorBill.patientId}).select("testId sampleStatus collectedAt receivedAt processedAt").exec())));
// Report metadata must obey the same fresh release/dues gate as its bytes.
router.use("/bills/:id/attachments",asyncHandler(async(req,_res,next)=>{await assertResultReportAllowed(req.params.id,[String(req.query.testId??"")]);next();}));
router.get("/bills/:id/attachments", asyncHandler(async (req,res) => sendSuccess(res,await listReportUploads(req.params.id,String(req.query.testId ?? "")))));
router.get("/bills/:id/attachments/:attachmentId", asyncHandler(async (req,res) => {
  const row = await readReportUpload(req.params.id,String(req.query.testId ?? ""),req.params.attachmentId);
  await recordAudit({user:req.user!.id,action:"report_attachment.download",entityType:"LabReportUpload",entity:String(row._id)});
  res.set({"Content-Type":"application/pdf","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Disposition":`${req.query.view === "true" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(row.fileName)}`});
  return res.send(row.content);
}));
export default router;
