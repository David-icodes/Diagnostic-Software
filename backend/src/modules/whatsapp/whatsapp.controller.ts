import type { Request, Response } from "express";
import {
  handleWebhookPayload,
  verifyWebhookSignature,
  verifyWebhookSubscription,
} from "./whatsapp.service";

const LOG_PREFIX = "[WhatsApp Webhook]";

/**
 * GET /api/whatsapp/webhook
 *
 * Meta's subscription handshake: echoes `hub.challenge` (200) only when
 * `hub.mode=subscribe` and `hub.verify_token` matches the configured token,
 * otherwise 403.
 */
export function verifyWebhook(req: Request, res: Response): Response {
  console.log(`${LOG_PREFIX} Verification request`);
  const result = verifyWebhookSubscription(req.query as Record<string, unknown>);
  return res.status(result.status).send(result.body);
}

/**
 * POST /api/whatsapp/webhook
 *
 * Verifies Meta's signature, acknowledges with 200 immediately, then processes
 * the event in the background. A processing failure is logged and swallowed so
 * Meta is never told to retry a legitimate event because of our own bug.
 */
export function receiveWebhook(req: Request, res: Response): Response {
  const signature = req.get("x-hub-signature-256") ?? undefined;
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn(`${LOG_PREFIX} Rejected: invalid X-Hub-Signature-256`);
    return res.status(401).json({ success: false, message: "Invalid signature" });
  }

  console.log(`${LOG_PREFIX} Received webhook event`);

  void handleWebhookPayload(req.body).catch((error) => {
    console.error(
      `${LOG_PREFIX} Processing error:`,
      error instanceof Error ? error.message : error,
    );
  });

  return res.status(200).json({ received: true });
}
