import { test } from "node:test";
import assert from "node:assert/strict";
import type { Browser } from "playwright";
import { createPdfBrowserPool } from "./pdf-browser-pool";

test("browser process startup is single-flight, bounded, reusable and restartable after disconnect", async () => {
  let launches = 0, closes = 0, connected = true;
  const browser = { isConnected: () => connected, close: async () => { closes++; connected = false; } } as Browser;
  const pool = createPdfBrowserPool(async () => { launches++; connected = true; return browser; });
  const [a,b] = await Promise.all([pool.acquire(), pool.acquire()]);
  assert.equal(launches,1); assert.equal(a.browser,b.browser);
  await assert.rejects(pool.acquire(), /being prepared/);
  a.release(); a.release(); b.release();
  const c = await pool.acquire(); assert.equal(launches,1); c.release();
  connected=false;
  const d=await pool.acquire(); assert.equal(launches,2); d.release();
  await pool.shutdown(); assert.equal(closes,1);
  await assert.rejects(pool.acquire(), /shutting down/);
});

test("failed launch releases reservations and shutdown closes a pending launch", async () => {
  let failed=true, closed=0;
  const browser={isConnected:()=>true,close:async()=>{closed++;}} as Browser;
  const pool=createPdfBrowserPool(async()=>{if(failed)throw new Error("launch failed");return browser;});
  await assert.rejects(pool.acquire(), /launch failed/); failed=false;
  const lease=await pool.acquire();lease.release();await pool.shutdown();assert.equal(closed,1);
  let complete!: (value: Browser)=>void;
  const slow=createPdfBrowserPool(()=>new Promise(resolve=>{complete=resolve;}));
  const pending=slow.acquire();const closing=slow.shutdown();complete(browser);
  await assert.rejects(pending,/shutting down/);await closing;assert.equal(closed,2);
});

test("idle browser is closed without retaining patient contexts", async () => {
  let closed=0;
  const pool=createPdfBrowserPool(async()=>({isConnected:()=>true,close:async()=>{closed++;}} as Browser),5);
  const lease=await pool.acquire();lease.release();
  await new Promise(resolve=>setTimeout(resolve,20));assert.equal(closed,1);await pool.shutdown();
});

test("failed idle cleanup retains ownership so shutdown retries closing the browser", async (t) => {
  let attempts=0;
  t.mock.method(console,"error",()=>{});
  const pool=createPdfBrowserPool(async()=>({isConnected:()=>true,close:async()=>{if(++attempts===1)throw new Error("close failed");}} as Browser),5);
  const lease=await pool.acquire();lease.release();
  await new Promise(resolve=>setTimeout(resolve,20));assert.equal(attempts,1);
  await pool.shutdown();assert.equal(attempts,2);
});

test("a browser with failed context cleanup is never reused; close failure remains owned for shutdown", async () => {
  let launches=0, failedCloses=0;
  const failed={isConnected:()=>true,close:async()=>{if(++failedCloses===1)throw new Error("cleanup failed");}} as Browser;
  const fresh={isConnected:()=>true,close:async()=>{}} as Browser;
  const pool=createPdfBrowserPool(async()=>++launches===1?failed:fresh);
  const first=await pool.acquire();await assert.rejects(first.discard(),/cleanup failed/);first.release();
  const second=await pool.acquire();assert.notEqual(first.browser,second.browser);assert.equal(launches,2);second.release();
  await pool.shutdown();assert.equal(failedCloses,2);
});
