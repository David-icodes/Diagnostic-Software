import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { requireUserId } from "../../utils/require-user-id";
import { listReportUploads, readReportUpload, saveReportUpload } from "./report-upload.service";
import { recordAudit } from "../audit/audit.service";
import { performance } from "node:perf_hooks";
import { env } from "../../config/env";
import { collectPipelineTimings, timedPipeline, type PipelineTiming } from "../whatsapp/pipeline-timing";

export const uploadReport = asyncHandler(async (req, res) => {
  const fileName = String(req.query.fileName ?? "");
  const saved = await saveReportUpload(requireUserId(req), String(req.query.billId ?? ""),
    String(req.query.testId ?? ""), fileName, req.body);
  await recordAudit({ user: requireUserId(req), action: "report_attachment.upload", entityType: "LabReportUpload", entity: saved.id });
  return sendSuccess(res, saved, 201);
});
export const listUploads = asyncHandler(async (req, res) =>
  sendSuccess(res, await listReportUploads(String(req.query.billId ?? ""), String(req.query.testId ?? ""))));
export const downloadUpload = asyncHandler(async (req, res) => {
  const events: PipelineTiming[] = [];
  if (typeof res.locals.reportAuthStarted === "number") {
    const event: PipelineTiming = { stage: "authentication and permission", durationMs: Math.round((performance.now() - res.locals.reportAuthStarted) * 100) / 100, outcome: "completed" };
    events.push(event);
    console.info("[report-pipeline]", JSON.stringify(event));
  }
  const row = await collectPipelineTimings(events, async () => {
    const row = await readReportUpload(String(req.query.billId ?? ""), String(req.query.testId ?? ""), String(req.params.id));
    await timedPipeline("download audit", () => recordAudit({ user: requireUserId(req), action: "report_attachment.download", entityType: "LabReportUpload", entity: String(row._id) }));
    return row;
  });
  if (env.NODE_ENV === "development") res.set("Server-Timing", events.map(event => `${event.stage.replaceAll(" ", "_")};dur=${event.durationMs}`).join(", "));
  const started = performance.now();
  res.once("finish", () => console.info("[report-pipeline]", JSON.stringify({ stage: "response delivery", durationMs: Math.round((performance.now() - started) * 100) / 100, outcome: "completed" })));
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": `${req.query.view === "true" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  return res.send(row.content);
});
