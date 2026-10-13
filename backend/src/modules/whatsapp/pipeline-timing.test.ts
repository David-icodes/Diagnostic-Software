import { test } from "node:test";
import assert from "node:assert/strict";
import { collectPipelineTimings, timedPipeline, type PipelineTiming } from "./pipeline-timing";

test("pipeline timing preserves values/errors and records only safe duration labels", async () => {
  const events: any[] = [];
  const secret = new Error("private-patient-token-url");
  assert.equal(await timedPipeline("PDF rendering", async () => "private-value", event => events.push(event)), "private-value");
  await assert.rejects(timedPipeline("restricted storage", async () => { throw secret; }, event => events.push(event)), error => error === secret);
  assert.deepEqual(events.map(event => event.outcome), ["completed", "failed"]);
  assert.ok(events.every(event => event.durationMs >= 0));
  assert.doesNotMatch(JSON.stringify(events), /private/);
  assert.equal(await timedPipeline("report lookup", async () => 42, () => { throw secret; }), 42);
});

test("concurrent request timing collectors cannot mix stages or private operation values", async () => {
  const a: PipelineTiming[] = [], b: PipelineTiming[] = [];
  await Promise.all([
    collectPipelineTimings(a, () => timedPipeline("provider request", async () => { await new Promise(resolve => setTimeout(resolve,5)); return "private-A"; }, () => {})),
    collectPipelineTimings(b, () => timedPipeline("application authorization", async () => "private-B", () => {})),
  ]);
  assert.deepEqual(a.map(event => event.stage), ["provider request"]);
  assert.deepEqual(b.map(event => event.stage), ["application authorization"]);
  assert.doesNotMatch(JSON.stringify([a,b]), /private/);
});
