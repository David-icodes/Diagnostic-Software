export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  /** Structured error payload attached by the backend (e.g. linkage counts). */
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  /**
   * The backend's `details` object, e.g. the matching patient for a duplicate
   * mobile or the linkage counts that block a patient archive. This is the
   * envelope's `details` field, not the whole envelope.
   */
  readonly details?: unknown;

  constructor(message: string, status = 0, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

/**
 * The API origin: `API_BASE_URL` without its `/api/v1` namespace. A few
 * server-owned routes are mounted at `/api/...` on purpose (the Meta webhook
 * cannot live under a versioned namespace it does not know about), and they
 * must still be called with the same authenticated request — cookies included.
 */
const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, "");

type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type RequestOptions = {
  method?: RequestMethod;
  body?: unknown;
};

async function requestEnvelope<T>(
  path: string,
  options: RequestOptions = {},
  baseUrl: string = API_BASE_URL,
): Promise<ApiEnvelope<T>> {
  let response: Response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(
      "Unable to reach the server. Please check your connection.",
      0,
    );
  }

  const envelope = (await response.json().catch(() => null)) as
    | ApiEnvelope<T>
    | null;

  if (!response.ok) {
    const message =
      envelope?.message ?? `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, envelope?.details);
  }

  return envelope ?? { success: response.ok };
}

export const api = {
  get: <T>(path: string): Promise<T> =>
    requestEnvelope<T>(path).then((envelope) => envelope.data as T),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    requestEnvelope<T>(path, { method: "POST", body }).then(
      (envelope) => envelope.data as T,
    ),
  /**
   * POST to a route mounted on the API origin instead of under `/api/v1`.
   * Same envelope handling, same `credentials: "include"` — so the session
   * cookie travels exactly as it does for every other authenticated call.
   */
  postFromOrigin: <T>(path: string, body?: unknown): Promise<T> =>
    requestEnvelope<T>(path, { method: "POST", body }, API_ORIGIN).then(
      (envelope) => envelope.data as T,
    ),
  put: <T>(path: string, body?: unknown): Promise<T> =>
    requestEnvelope<T>(path, { method: "PUT", body }).then(
      (envelope) => envelope.data as T,
    ),
  patch: <T>(path: string, body?: unknown): Promise<T> =>
    requestEnvelope<T>(path, { method: "PATCH", body }).then(
      (envelope) => envelope.data as T,
    ),
  delete: <T>(path: string): Promise<T> =>
    requestEnvelope<T>(path, { method: "DELETE" }).then(
      (envelope) => envelope.data as T,
    ),
  request: requestEnvelope,
};