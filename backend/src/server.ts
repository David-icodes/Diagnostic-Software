import "dotenv/config";
import app from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";

async function main(): Promise<void> {
  await connectDB();

  // Safe startup diagnostics: makes the effective environment obvious in the
  // Render logs (NODE_ENV drives Secure cookies; COOKIE_SAMESITE drives
  // cross-site behaviour). No secrets are printed.
  console.log(
    `[server] NODE_ENV=${env.NODE_ENV} COOKIE_SAMESITE=${env.COOKIE_SAMESITE} PORT=${env.PORT}`,
  );

  app.listen(env.PORT, () => {
    console.log(
      `[server] Diagnostic LIS API listening on port ${env.PORT} (${env.NODE_ENV})`,
    );
  });
}

main().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});