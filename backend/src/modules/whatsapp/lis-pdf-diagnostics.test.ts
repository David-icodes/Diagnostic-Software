import { test } from "node:test";
import assert from "node:assert/strict";
import { pdfFailure, rendererOrigin } from "./lis-pdf-diagnostics";
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