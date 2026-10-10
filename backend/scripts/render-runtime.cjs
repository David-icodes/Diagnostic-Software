const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// Keep installation and runtime independent of Render's HOME/build cache.
process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
const root = path.resolve(__dirname, '..');
process.chdir(root);
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, env: process.env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Deployment step failed (exit ${result.status ?? 'unknown'})`);
}
async function verify() {
  const { chromium } = require('playwright');
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body><h1>LIS renderer deployment check</h1></body></html>');
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    if (pdf.length < 100 || pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error('Invalid PDF output');
    const output = process.argv[3];
    if (output) {
      fs.writeFileSync(path.resolve(output), pdf);
      console.log(`PDF saved to ${path.resolve(output)}`);
    }
    console.log(`Renderer verified: Playwright ${require('playwright/package.json').version}, ${process.platform}, PDF ${pdf.length} bytes, package-local browser cache`);
    console.log(`PLAYWRIGHT_BROWSERS_PATH=${process.env.PLAYWRIGHT_BROWSERS_PATH}; HOME=${process.env.HOME ?? '(unset)'}; browser cache=${path.join(path.dirname(require.resolve('playwright-core/package.json')), '.local-browsers')}`);
  } finally { await browser?.close(); }
}
async function main() {
  switch (process.argv[2]) {
    case 'build':
      // Resolve the CLI from the installed lockfile version, never download a new CLI.
      run([path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js'), 'install', 'chromium']);
      await verify();
      run([require.resolve('typescript/bin/tsc')]);
      break;
    case 'verify': await verify(); break;
    case 'start': require(path.join(root, 'dist/server.js')); break;
    default: throw new Error('Expected build, start or verify');
  }
}
main().catch((error) => { console.error('[Render renderer setup]', error.message); process.exitCode = 1; });

