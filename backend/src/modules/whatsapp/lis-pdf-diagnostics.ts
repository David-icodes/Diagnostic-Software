import { ApiError } from "../../utils/api-error";

/** Only fixed application routes are logged; queries and arbitrary paths may contain patient data. */
export function rendererTarget(value: string, origins: string[], base?: string) {
  try {
    const url = new URL(value, base);
    const route = ["/", "/login", "/whatsapp/document", "/api/v1/auth/me", "/api/whatsapp/lis/document-data"].includes(url.pathname)
      ? url.pathname : url.pathname.startsWith("/_next/") ? "/_next/[asset]" : "/[other]";
    return { origin: origins.includes(url.origin) ? url.origin : "[unconfigured-origin]", route };
  } catch { return { origin: "[invalid-url]", route: "/[other]" }; }
}

/** Never retain arbitrary console/error text: it can include cookies or clinical data. */
export function rendererErrorKind(message: string) {
  if (/cors|cross-origin/i.test(message)) return "CORS";
  const network = message.match(/\bnet::(ERR_[A-Z_]+)\b/);
  if (network) return network[1];
  if (/timeout|timed out/i.test(message)) return "TIMEOUT";
  if (/hydration/i.test(message)) return "HYDRATION";
  return "BROWSER_ERROR";
}

export function rendererOrigin(value: string): string {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) {
    throw new ApiError(503, "PDF renderer URLs must be HTTP(S) origins without credentials, paths or query strings.");
  }
  return url.origin;
}

export function pdfFailure(stage: string, error: unknown) {
  const raw = error instanceof Error ? error.message : "Unknown renderer error";
  // Never log cookies, authenticated URLs, provider tokens or a stack trace.
  const detail = raw.split("\n")[0].replace(/https?:\/\/\S+/g, "[URL]")
    .replace(/(authorization|cookie|token|password)[=:][^\s]+/gi, "$1=[redacted]").slice(0, 500);
  const missing = /Executable doesn't exist|browser executable.*not found/i.test(raw);
  return {
    code: missing ? "BROWSER_RUNTIME_MISSING" : "PDF_RENDER_FAILED", detail,
    message: missing
      ? "The backend PDF browser runtime is missing. Ask the administrator to run npm run pdf:install on the backend host, then Retry. No message was sent."
      : `The actual PDF could not be generated (${stage}). Retry; if it persists, ask the administrator to check the PDF renderer logs and configured application origins. No message was sent.`,
  };
}
