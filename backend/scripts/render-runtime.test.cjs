const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const wrapper = path.join(__dirname, 'render-runtime.cjs');
test('Render build and start share the hermetic cache and pinned local CLI', () => {
  const source = fs.readFileSync(wrapper, 'utf8');
  assert.match(source, /process.env.PLAYWRIGHT_BROWSERS_PATH = '0'/);
  assert.match(source, /require.resolve\('playwright\/package.json'\)/);
  assert.match(source, /'install', 'chromium'/);
  assert.doesNotMatch(source, /executablePath|chromium_headless_shell-\d/);
  assert.match(source, /result.status !== 0/);
  assert.match(source, /chromium.launch\(\{ headless: true \}\)/);
  assert.match(source, /await page.pdf/);
});
test('Invalid deployment invocation exits unsuccessfully', () => {
  const result = spawnSync(process.execPath, [wrapper, 'invalid'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Expected build, start or verify/);
});
