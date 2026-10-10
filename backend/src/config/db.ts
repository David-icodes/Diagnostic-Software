import mongoose from "mongoose";
import { env } from "./env";

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
    console.error("[db] MongoDB connection error:", err.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("[db] MongoDB disconnected");
  });
}

export async function connectDB(): Promise<void> {
  attachListeners();

  if (mongoose.connection.readyState === 1) {
    return;
  }

  await mongoose.connect(env.MONGODB_URI);
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
