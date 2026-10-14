import test from "node:test";
import assert from "node:assert/strict";
import { connectWithRetry, databaseFailureStage } from "./database-startup";
test("startup retries transient DNS failures, reports readiness only on success", async () => {
  let calls = 0; const waits: number[] = []; const stages: string[] = [];
  await connectWithRetry(async () => { if (++calls < 3) throw new Error("querySrv ECONNREFUSED private-host"); }, async ms => { waits.push(ms); }, stage => stages.push(stage));
  assert.equal(calls, 3); assert.deepEqual(waits, [500,1000]); assert.deepEqual(stages, ["dns-resolution","dns-resolution"]);
});
test("startup failure is bounded and sanitized; invalid credentials are not retried", async () => {
  let calls = 0;
  await assert.rejects(connectWithRetry(async () => { calls++; throw {code:18,message:"private-secret"}; }, async () => {}, () => {}), /authentication/);
  assert.equal(calls,1);
  await assert.rejects(connectWithRetry(async () => { throw new Error("private-secret"); }, async () => {}, () => {}), error => error instanceof Error && !error.message.includes("private-secret"));
  assert.equal(databaseFailureStage(new Error("queryTxt ENOTFOUND secret")), "dns-resolution");
});
