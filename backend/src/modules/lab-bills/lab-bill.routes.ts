import {z} from "zod";
import {browserInvoicePdf} from "../test-results/report-pdf.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { assertBillDocumentAllowed, assertInvoicePrintAllowed } from "../test-results/result-workflow.service";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { requirePermission } from "../../middleware/require-permission";
import {
  cancelLabBillSchema,
  createLabBillSchema,
  collectLabDueSchema,
  modifyLabBillSchema,
} from "../../validations/lab-bill";
import {
  cancelLabBill,
  collectLabDue,
  createLabBill,
  getLabBill,
  getLabBillByBillNumber,
  listDueBills,
  listLabBills,
  modifyLabBill,
} from "./lab-bill.controller";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("billing.view"), listLabBills);
router.get("/due", requirePermission("billing.view"), listDueBills);
router.get(
  "/by-bill-number/:billNumber",
  requirePermission("billing.view"),
  getLabBillByBillNumber,
);
router.post("/", requirePermission("billing.create"), validate(createLabBillSchema), createLabBill);
router.get("/:id/document-eligibility", requirePermission("billing.view"), asyncHandler(async(req,res)=>sendSuccess(res,await assertBillDocumentAllowed(req.params.id))));
router.get("/:id/invoice.pdf",requirePermission("billing.view"),asyncHandler(async(req,res)=>{
 const options=z.object({includeHeader:z.enum(["true","false"]).default("true"),paymentId:z.string().regex(/^[a-f\d]{24}$/i).optional()}).strict().parse(req.query);
 const result=await browserInvoicePdf(req.params.id,options.includeHeader==="true",req,undefined,options.paymentId);
 res.set({"Content-Type":"application/pdf","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Disposition":`inline; filename*=UTF-8''${encodeURIComponent(result.filename)}`});res.send(result.bytes);
}));
router.get("/:id/invoice-print-eligibility", requirePermission("billing.view"), asyncHandler(async(req,res)=>sendSuccess(res,await assertInvoicePrintAllowed(req.params.id))));
router.get("/:id", requirePermission("billing.view"), getLabBill);
router.put(
  "/:id",
  requirePermission("billing.modify"),
  validate(modifyLabBillSchema.omit({clientId:true})),
  modifyLabBill,
);
router.post(
  "/:id/cancel",
  requirePermission("billing.cancel"),
  validate(cancelLabBillSchema),
  cancelLabBill,
);
router.post(
  "/:id/collect-due",
  requirePermission("billing.collect_due"),
  validate(collectLabDueSchema),
  collectLabDue,
);

export default router;
