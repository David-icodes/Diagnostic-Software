import test from "node:test";
import assert from "node:assert/strict";
import {createReportPdfCache} from "./report-pdf-cache";
test("PDF reuse is owner/version scoped, expiring, bounded and single-flight",async()=>{
 let now=0,renders=0;const cache=createReportPdfCache(10,8,()=>now);
 const render=async()=>{renders++;await new Promise(resolve=>setTimeout(resolve,5));return Buffer.from("pdf");};
 const first=await Promise.all([cache.get("owner-A:version-1",render),cache.get("owner-A:version-1",render)]);
 assert.deepEqual(first.map(row=>row.status),["MISS","SHARED"]);assert.equal(renders,1);
 assert.equal((await cache.get("owner-A:version-1",render)).status,"HIT");
 await cache.get("owner-B:version-1",render);assert.equal(renders,2);
 await cache.get("owner-A:version-2",render);assert.equal(renders,3);
 assert.equal((await cache.get("owner-A:version-1",render)).status,"MISS");
 now=20;assert.equal((await cache.get("owner-A:version-1",render)).status,"MISS");
});
test("render failure is retryable and cached bytes are integrity checked",async()=>{
 const cache=createReportPdfCache();let count=0;
 await assert.rejects(cache.get("x",async()=>{count++;throw new Error("synthetic render failure");}),/render failure/);
 const saved=await cache.get("x",async()=>{count++;return Buffer.from("PDF");});assert.equal(count,2);
 saved.bytes[0]=0;await assert.rejects(cache.get("x",async()=>Buffer.from("PDF")),/integrity/);
 assert.equal((await cache.get("x",async()=>Buffer.from("PDF"))).status,"MISS");
});
