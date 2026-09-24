import "dotenv/config";
import app from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";

async function main(): Promise<void> {
  await connectDB();

  app.listen(env.PORT, () => {
    console.log(
      `[server] Diagnostic LIS API running on http://localhost:${env.PORT} (${env.NODE_ENV})`,
    );
  });
}

main().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});