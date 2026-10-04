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
 * Browser origins allowed to call the API. `CORS_ORIGINS` (comma-separated)
 * takes precedence when set, otherwise the single `FRONTEND_URL` is used.
 * A wildcard is never allowed so credentials can stay enabled.
 */
function corsOrigins(): string[] | false {
  const list = (env.CORS_ORIGINS || env.FRONTEND_URL)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return list.length > 0 ? list : false;
}

app.use(helmet());
app.use(
  cors({
    origin: corsOrigins(),
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
