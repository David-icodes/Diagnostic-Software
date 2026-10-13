import { performance } from "node:perf_hooks";
import { AsyncLocalStorage } from "node:async_hooks";

export type PipelineStage = "browser startup" | "context creation" | "document navigation" | "document readiness" | "fonts and images" | "PDF rendering" | "report lookup" | "PDF validation" | "restricted storage" | "restricted retrieval" | "Meta media upload" | "Meta template request" | "authentication and permission" | "application authorization" | "attachment metadata lookup" | "asset metadata lookup" | "provider request" | "response transfer" | "integrity verification" | "download audit" | "response delivery";
export interface PipelineTiming { stage: PipelineStage; durationMs: number; outcome: string }
const requestTimings = new AsyncLocalStorage<PipelineTiming[]>();
export function collectPipelineTimings<T>(events: PipelineTiming[], run: () => Promise<T>) {
  return requestTimings.run(events, run);
}

/** Labels are fixed code values; never pass URLs, identities, or provider errors. */
export async function timedPipeline<T>(stage: PipelineStage, run: () => Promise<T>, emit = (event: object) => console.info("[report-pipeline]", JSON.stringify(event))): Promise<T> {
  const started = performance.now();
  let outcome = "failed";
  try { const value = await run(); outcome = "completed"; return value; }
  finally {
    const event = { stage, durationMs: Math.round((performance.now() - started) * 100) / 100, outcome };
    requestTimings.getStore()?.push(event);
    try { emit(event); }
    catch { /* Timing must not change workflow success or the original error. */ }
  }
}
