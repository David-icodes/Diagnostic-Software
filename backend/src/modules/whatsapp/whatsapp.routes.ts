import { Router } from "express";
import { receiveWebhook, verifyWebhook } from "./whatsapp.controller";

/**
 * WhatsApp Cloud API webhook.
 *
 * Mounted at `/api/whatsapp` (outside `/api/v1`) because this URL is called by
 * Meta, not by our frontend. It is intentionally unauthenticated in the cookie
 * sense — Meta cannot send our session cookie — so authenticity is enforced by
 * the `X-Hub-Signature-256` check in the controller.
 */
const router = Router();

router.get("/webhook", verifyWebhook);
router.post("/webhook", receiveWebhook);

export default router;
