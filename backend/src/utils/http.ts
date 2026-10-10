import type { Response } from "express";

export function sendSuccess<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function sendMessage(res: Response, message: string, status = 200) {
  return res.status(status).json({ success: true, message });
}