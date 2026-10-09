import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("report layouts declare printable A4 areas and repeat table headers", () => {
  const css = readFileSync(new URL("../app/lis-modify-a4.css", import.meta.url), "utf8");
  assert.match(css, /@page lab-report\s*\{ size: A4 portrait; margin: 10mm 11mm 12mm;/);
  for (const name of ["lab-invoice", "lab-table"]) {
    assert.match(css, new RegExp(`@page ${name}\\s*\\{ size: A4 landscape; margin: 10mm;`));
  }
  assert.match(css, /width: 188mm/);
  assert.match(css, /width: 277mm/);
  assert.match(css, /thead \{ display: table-header-group; \}/);
  assert.match(css, /tr \{ break-inside: avoid; \}/);
  assert.doesNotMatch(css, /overflow-x:\s*hidden/);
});
