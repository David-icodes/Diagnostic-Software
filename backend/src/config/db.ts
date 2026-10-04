import mongooseImport from "mongoose";
import { env } from "./env";

// Cloudflare Workers/esbuild can expose the CommonJS `mongoose` export nested
// under `.default`, while Node/tsx exposes it directly. Normalise both so
// `mongoose.connection` / `mongoose.connect` always resolve.
const mongoose =
  (mongooseImport as unknown as { default?: typeof mongooseImport }).default ??
  mongooseImport;

/** Extra connection settings, e.g. a single short-lived pool for serverless runtimes. */
export interface ConnectOptions {
  maxPoolSize?: number;
  minPoolSize?: number;
  serverSelectionTimeoutMS?: number;
}

let listenersAttached = false;

function attachListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on("connected", () => {
    console.log(`[db] MongoDB connected (${mongoose.connection.host})`);
  });

  mongoose.connection.on("error", (err) => {
    console.error("[db] MongoDB connection error:", err.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("[db] MongoDB disconnected");
  });
}

export async function connectDB(options: ConnectOptions = {}): Promise<void> {
  attachListeners();

  if (mongoose.connection.readyState === 1) {
    return;
  }

  await mongoose.connect(env.MONGODB_URI, options);
}