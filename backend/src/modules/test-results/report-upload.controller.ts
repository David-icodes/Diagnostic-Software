import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { requireUserId } from "../../utils/require-user-id";
import { listReportUploads, readReportUpload, saveReportUpload } from "./report-upload.service";

export const uploadReport = asyncHandler(async (req, res) => {
  const fileName = String(req.query.fileName ?? "");
  return sendSuccess(res, await saveReportUpload(requireUserId(req), String(req.query.billId ?? ""),
    String(req.query.testId ?? ""), fileName, req.body), 201);
});
export const listUploads = asyncHandler(async (req, res) =>
  sendSuccess(res, await listReportUploads(String(req.query.billId ?? ""), String(req.query.testId ?? ""))));
export const downloadUpload = asyncHandler(async (req, res) => {
  const row = await readReportUpload(String(req.query.billId ?? ""), String(req.query.testId ?? ""), String(req.params.id));
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  return res.send(row.content);
});
