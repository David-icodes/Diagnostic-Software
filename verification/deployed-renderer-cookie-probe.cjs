// Public frontend probe. All backend requests are intercepted; no session, patient data or messages are used.
process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
const { chromium } = require('../backend/node_modules/playwright');
const assert = require('node:assert/strict');
async function main() {
  const frontend = new URL(process.argv[2]).origin;
  const backend = new URL(process.argv[3]).origin;
  const browser = await chromium.launch({ headless: true });
  try {
    for (const sameSite of ['Lax', 'None']) {
      const context = await browser.newContext();
      await context.addCookies([{ name: 'diagnostic_token', value: 'synthetic-probe-never-forwarded', url: backend + '/',
        httpOnly: true, secure: true, sameSite }]);
      let resolveRequest;
      const observed = new Promise(resolve => { resolveRequest = resolve; });
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin === backend) {
          if (url.pathname === '/api/whatsapp/lis/document-data' && route.request().method() === 'POST') {
            const headers = await route.request().allHeaders();
            resolveRequest({ sameSite, apiOrigin: url.origin, route: url.pathname,
              cookiePresent: (headers.cookie ?? '').includes('diagnostic_token=') });
          }
          await route.fulfill({ status: 401, contentType: 'application/json', headers: {
            'Access-Control-Allow-Origin': frontend, 'Access-Control-Allow-Credentials': 'true',
          }, body: JSON.stringify({ success: false, message: 'Synthetic unauthenticated probe' }) });
        } else if (url.origin === frontend) await route.continue();
        else await route.abort();
      });
      const page = await context.newPage();
      const response = await page.goto(frontend + '/whatsapp/document?reviewId=synthetic-probe', { waitUntil: 'domcontentloaded', timeout: 60000 });
      assert.equal(response.status(), 200);
      const result = await Promise.race([observed, new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error('Document API request not observed')), 30000); timer.unref();
      })]);
      console.log(JSON.stringify({ ...result, navigationStatus: response.status(), finalRoute: new URL(page.url()).pathname,
        evidence: 'public deployed frontend; intercepted backend request; not an authenticated production PDF' }));
      await context.close();
    }
  } finally { await browser.close(); }
}
main().catch(() => { console.error('Public frontend cookie probe failed'); process.exitCode = 1; });
