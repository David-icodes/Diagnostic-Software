import "dotenv/config";
import app from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import mongoose from "mongoose";
import { pdfBrowserPool } from "./modules/whatsapp/pdf-browser-pool";

async function main(): Promise<void> {
  await connectDB();

  // Safe startup diagnostics: makes the effective environment obvious in the
  // Render logs (NODE_ENV drives Secure cookies; COOKIE_SAMESITE drives
  // cross-site behaviour). No secrets are printed.
  console.log(
    `[server] NODE_ENV=${env.NODE_ENV} COOKIE_SAMESITE=${env.COOKIE_SAMESITE} PORT=${env.PORT}`,
  );

  const server = app.listen(env.PORT, () => {
    console.log(
      `[server] Diagnostic LIS API listening on port ${env.PORT} (${env.NODE_ENV})`,
    );
  });
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const deadline = setTimeout(() => process.exit(1), 20000);
    deadline.unref();
    const drained = new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    void (async () => {
      // Close renderer processes immediately, rather than waiting for a stalled report request.
      try { await pdfBrowserPool.shutdown(); await drained; await mongoose.disconnect(); clearTimeout(deadline); }
      catch { console.error("[server] Shutdown cleanup failed"); process.exitCode = 1; }
    })();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
