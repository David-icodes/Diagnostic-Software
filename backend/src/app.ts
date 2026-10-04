import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Request } from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { getDatabaseStatus } from "./config/db";
import { errorHandler } from "./middleware/error-handler";
import { notFound } from "./middleware/not-found";
import whatsappRoutes from "./modules/whatsapp/whatsapp.routes";
import v1Router from "./routes/v1";

const app = express();

/**
 * Browser origins allowed to call the API.
 *
 * `CORS_ORIGINS` and `FRONTEND_URL` are both comma-separated lists and are
 * combined, so setting either one is enough. Every entry is normalised to a
 * bare origin — scheme + host (+ port) — so a trailing slash or a path
 * (`https://app.example.com/login`) still matches the browser's `Origin`
 * header, which never includes a path.
 *
 * Credentials are required for the session cookie, so a wildcard is never used.
 */
function normaliseOrigin(entry: string): string {
  try {
    return new URL(entry).origin;
  } catch {
    return entry.replace(/\/+$/, "");
  }
}

function resolveCorsOrigins(): string[] {
  const entries = [env.CORS_ORIGINS, env.FRONTEND_URL]
    .join(",")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(normaliseOrigin);

  return [...new Set(entries)];
}

const allowedOrigins = resolveCorsOrigins();

if (allowedOrigins.length === 0) {
  console.warn(
    "[cors] No allowed origins configured — browser requests will be rejected.",
  );
} else {
  console.log(`[cors] Allowed origins: ${allowedOrigins.join(", ")}`);

  const onlyLocalhost = allowedOrigins.every(
    (origin) =>
      origin.startsWith("http://localhost") ||
      origin.startsWith("http://127.0.0.1"),
  );
  if (env.NODE_ENV === "production" && onlyLocalhost) {
    console.warn(
      "[cors] NODE_ENV=production but only localhost origins are allowed. Set FRONTEND_URL (or CORS_ORIGINS) to the deployed frontend origin.",
    );
  }
}

app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
  }),
);
app.use(
  express.json({
    limit: "1mb",
    // Keep the exact raw bytes alongside the parsed body so the WhatsApp webhook
    // can verify Meta's X-Hub-Signature-256. Parsing is unchanged for every other
    // route; only the webhook reads `rawBody`.
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
app.use(cookieParser());

/**
 * Unauthenticated health probe for the hosting platform (Render) and uptime
 * checks. Returns no secrets — only a coarse database connection state.
 * `GET /api/v1/health` remains available for the app's own clients.
 */
app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "Diagnostic LIS API is running",
    database: getDatabaseStatus(),
  });
});

// Meta calls this URL directly (it cannot send our session cookie), so it sits
// outside /api/v1 and is authenticated by its HMAC signature instead.
app.use("/api/whatsapp", whatsappRoutes);

app.use("/api/v1", v1Router);

app.use(notFound);
app.use(errorHandler);

export default app;
