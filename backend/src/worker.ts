import { createServer } from "node:http";
import { httpServerHandler } from "cloudflare:node";
import app from "./app";
import { connectDB } from "./config/db";

/**
 * Cloudflare Workers entry point.
 *
 * Reuses the existing Express `app` from `./app` unchanged and bridges it into
 * the Workers HTTP model with `httpServerHandler`. There is no `app.listen()`
 * and no real network port — `httpServerHandler(server)` performs the internal
 * `listen()` it needs purely as a routing key.
 *
 * The local Node server (`src/server.ts`) is untouched and keeps using
 * `app.listen()` with the full Node runtime.
 *
 * KNOWN LIMITATION — NOT DEPLOYABLE AS-IS
 * ---------------------------------------
 * Routes that do not touch MongoDB work on the Workers runtime (verified:
 * GET /api/v1/health, GET /api/whatsapp/webhook). Routes that read/write through
 * a Mongoose *model* (login, patients, doctors, lab-tests, …) deadlock.
 *
 * Cause: Workers isolate I/O per request, so a connection (and the models
 * compiled onto it at import time) cannot span requests. Measured on this
 * Worker: the raw `mongodb` driver works, `mongoose.connection.collection()`
 * works, but `mongoose.model(...).findOne()` hangs and the runtime cancels the
 * request as "hung".
 *
 * Fixing it requires scoping the data layer to a per-request connection
 * (`mongoose.createConnection()` with the models bound to that connection),
 * i.e. changing how every model is obtained — not just Worker configuration.
 * See the deployment notes before enabling this entry point in production.
 */

// Workers isolate I/O per request, so use a single short-lived connection
// rather than a long-lived pool.
const WORKER_DB_OPTIONS = {
  maxPoolSize: 1,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 10_000,
} as const;

const expressServer = createServer(app);

// `httpServerHandler` accepts a Node-style server; the casts below only
// reconcile the Workers `Request` and Node `Server` typings, not behaviour.
const nodeHandler = httpServerHandler(
  expressServer as unknown as Parameters<typeof httpServerHandler>[0],
);

const handleNodeRequest = nodeHandler.fetch as unknown as (
  request: Request,
  env: unknown,
  ctx: ExecutionContext,
) => Promise<Response>;

export default {
  async fetch(
    request: Request,
    env: unknown,
    ctx: ExecutionContext,
  ): Promise<Response> {
    if (typeof handleNodeRequest !== "function") {
      return new Response("Worker HTTP handler unavailable", { status: 500 });
    }

    // Connect before the request reaches Express so every route —
    // /api/v1/* and /api/whatsapp/webhook — sees a live database.
    await connectDB(WORKER_DB_OPTIONS);

    return handleNodeRequest(request, env, ctx);
  },
} satisfies ExportedHandler;
