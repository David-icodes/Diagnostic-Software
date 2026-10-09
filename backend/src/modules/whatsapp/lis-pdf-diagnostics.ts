import { ApiError } from "../../utils/api-error";

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