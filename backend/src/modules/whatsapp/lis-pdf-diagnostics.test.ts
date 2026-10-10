import { test } from "node:test";
import assert from "node:assert/strict";
import { pdfFailure, rendererOrigin, rendererTarget, rendererErrorKind } from "./lis-pdf-diagnostics";
test("missing headless executable produces actionable safe diagnostics", () => {
  const failure = pdfFailure("browser startup", new Error("browserType.launch: Executable doesn't exist at C:/private/browser.exe\ninternal stack"));
  assert.equal(failure.code, "BROWSER_RUNTIME_MISSING");
  assert.match(failure.message, /npm run pdf:install/);
  assert.doesNotMatch(failure.message, /private|stack/);
});
test("renderer origin rejects credentials and malformed application URLs", () => {
  assert.equal(rendererOrigin("https://lis.example.test"), "https://lis.example.test");
  for (const url of ["file:///tmp", "https://user:secret@example.test", "https://example.test/api/v1", "https://example.test/?token=secret"]) assert.throws(() => rendererOrigin(url));
});
test("non-browser failures retain stage and redact diagnostic URL tokens", () => {
  const failure = pdfFailure("authenticated document loading", new Error("Failed https://api.example.test/?token=secret cookie=secret"));
  assert.match(failure.message, /authenticated document loading/);
  assert.doesNotMatch(failure.detail, /secret/);
});

test("renderer diagnostics omit credentials, query values, patient paths and arbitrary browser text", () => {
  const origins = ["https://api.example.test", "https://app.example.test"];
  assert.deepEqual(rendererTarget("https://user:password@api.example.test/api/whatsapp/lis/document-data?reviewId=secret", origins),
    { origin: origins[0], route: "/api/whatsapp/lis/document-data" });
  assert.equal(rendererTarget("https://api.example.test/patients/private-patient?token=secret", origins).route, "/[other]");
  assert.equal(rendererTarget("https://secret.example.test/login", origins).origin, "[unconfigured-origin]");
  assert.equal(rendererTarget("/login?token=secret", origins, origins[1]).route, "/login");
  assert.equal(rendererErrorKind("Patient Name cookie=secret CORS rejected"), "CORS");
  assert.equal(rendererErrorKind("net::ERR_CONNECTION_REFUSED https://user:password@example.test"), "ERR_CONNECTION_REFUSED");
  assert.equal(rendererErrorKind("Patient Name token=secret"), "BROWSER_ERROR");
});
