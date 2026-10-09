import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { lisDocumentData, reviewLisMessage, sendLisReview } from "./lis-workflow.service";

export const reviewLis = asyncHandler(async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  return sendSuccess(res, await reviewLisMessage(req.body, req));
});
export const documentLis = asyncHandler(async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  return sendSuccess(res, lisDocumentData(req.body.reviewId, req.user!.id));
});
export const sendLis = asyncHandler(async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  return sendSuccess(res, await sendLisReview(req.body.reviewId, req));
});

export const deliveryLis = asyncHandler(async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const { listLisDelivery } = await import("./lis-delivery.service.js");
  return sendSuccess(res, await listLisDelivery(String(req.body.billId ?? "")));
});