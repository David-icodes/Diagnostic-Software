import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/require-permission";
import { validate } from "../../middleware/validate";
import { sendTestTemplateSchema } from "../../validations/whatsapp";
import { lisReviewIdSchema, reviewLisMessageSchema } from "../../validations/whatsapp-lis";
import { documentLis, reviewLis, sendLis, deliveryLis } from "./lis-workflow.controller";
import {
  receiveWebhook,
  sendTestTemplate,
  verifyWebhook,
} from "./whatsapp.controller";

/**
 * WhatsApp Cloud API routes.
 *
 * Mounted at `/api/whatsapp`.
 *
 * The webhook pair is called by Meta, which cannot send our session cookie, so
 * it is authenticated by the `X-Hub-Signature-256` check instead. The outbound
 * test endpoint is ours, so it uses the normal `authenticate` +
 * `requirePermission` middleware and is never public.
 */
const router = Router();

router.get("/webhook", verifyWebhook);
router.post("/webhook", receiveWebhook);

// Internal, admin-only outbound test. Not part of any business workflow yet.
router.post(
  "/test-message",
  authenticate,
  requirePermission("whatsapp.send"),
  validate(sendTestTemplateSchema),
  sendTestTemplate,
);

router.post("/lis/review", authenticate, requirePermission("whatsapp.send"), validate(reviewLisMessageSchema), reviewLis);
router.post("/lis/document-data", authenticate, requirePermission("whatsapp.send"), validate(lisReviewIdSchema), documentLis);
router.post("/lis/send", authenticate, requirePermission("whatsapp.send"), validate(lisReviewIdSchema), sendLis);

router.post("/lis/delivery", authenticate, requirePermission("whatsapp.send"), deliveryLis);

export default router;
