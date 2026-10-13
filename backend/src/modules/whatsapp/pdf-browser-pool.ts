import type { Browser } from "playwright";
import { ApiError } from "../../utils/api-error";

/** Reuse only the process. Every caller owns a fresh context and closes it in finally. */
export function createPdfBrowserPool(launch: () => Promise<Browser>, idleMs = 60000) {
  let browser: Browser | undefined;
  const owned = new Set<Browser>();
  let launching: Promise<Browser> | undefined;
  let active = 0;
  let stopped = false;
  let idle: ReturnType<typeof setTimeout> | undefined;
  async function acquire() {
    if (stopped) throw new ApiError(503, "PDF renderer is shutting down.");
    if (active >= 2) throw new ApiError(429, "Documents are being prepared. Please retry shortly.");
    active++;
    clearTimeout(idle);
    try {
      if (!browser?.isConnected()) {
        if (!launching && owned.size >= 2) throw new ApiError(503, "PDF renderer cleanup is pending. Please retry later.");
        launching ??= launch().then(value => {
          browser = value; owned.add(value);
          value.on?.("disconnected", () => owned.delete(value));
          return value;
        }).finally(() => { launching = undefined; });
        await launching;
      }
      if (stopped) throw new ApiError(503, "PDF renderer is shutting down.");
      const leased = browser!;
      let released = false;
      return { browser: leased, async discard() {
        if (browser === leased) browser = undefined;
        await leased.close(); owned.delete(leased);
      }, release() {
        if (released) return;
        released = true; active--;
        if (!active && !stopped) {
          idle = setTimeout(() => {
            const old = browser; browser = undefined;
            if (old) void old.close().then(() => owned.delete(old)).catch(() => console.error("[PDF renderer] Idle cleanup failed; retained for shutdown retry"));
          }, idleMs);
          idle.unref();
        }
      } };
    } catch (error) { active--; throw error; }
  }
  async function shutdown() {
    stopped = true; clearTimeout(idle);
    await launching?.catch(() => undefined);
    browser = undefined;
    await Promise.all([...owned].map(async value => { await value.close(); owned.delete(value); }));
  }
  return { acquire, shutdown };
}

export const pdfBrowserPool = createPdfBrowserPool(async () => {
  const { chromium } = await import("playwright");
  return chromium.launch({ headless: true, timeout: 15000 });
});
