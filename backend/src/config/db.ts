import mongoose from "mongoose";
import { env } from "./env";
import { connectWithRetry, databaseFailureStage } from "./database-startup";
import { setServers } from "node:dns";
import { isIP } from "node:net";

let listenersAttached = false;

function attachListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on("connected", () => {
    const dbName = mongoose.connection.name;
    console.log(
      `[db] MongoDB connected (${mongoose.connection.host}, db: ${dbName})`,
    );

    if (dbName === "test") {
      console.warn(
        "[db] WARNING: connected to the 'test' database. The production MONGODB_URI must include the '/diagnostic_lis' database name.",
      );
    }
  });

  mongoose.connection.on("error", (err) => {
    console.error("[db] MongoDB connection error:", databaseFailureStage(err));
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("[db] MongoDB disconnected");
  });
}

export async function connectDB(): Promise<void> {
  attachListeners();
  // Explicit process-local DNS configuration; never switch databases or weaken TLS.
  if (env.MONGODB_DNS_SERVERS) {
    const servers = env.MONGODB_DNS_SERVERS.split(",").map(value => value.trim());
    if (servers.some(value => !isIP(value))) throw new Error("MONGODB_DNS_SERVERS must contain resolver IP addresses");
    setServers(servers);
  }

  if (mongoose.connection.readyState === 1) {
    return;
  }

  await connectWithRetry(() => mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 }),
    ms => new Promise(resolve => setTimeout(resolve, ms)),
    (stage, attempt) => console.error("[db] Startup connection failed", { stage, attempt }));
}

/**
 * Non-sensitive connection state for the health endpoint.
 * Never returns the URI, credentials or any environment value.
 */
export function getDatabaseStatus():
  | "connected"
  | "connecting"
  | "disconnected" {
  switch (mongoose.connection.readyState) {
    case 1:
      return "connected";
    case 2:
      return "connecting";
    default:
      return "disconnected";
  }
}
