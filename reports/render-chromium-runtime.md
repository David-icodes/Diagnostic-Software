# Render Chromium runtime repair

## Findings
Playwright and playwright-core are both locked to 1.64.0; the bundled manifest requires Chromium and headless shell revision 1248. Both PDF renderers use `chromium.launch({ headless: true })` without channel or executablePath. The supplied Render error proves the required headless shell is absent from the runtime lookup location. Render build settings/logs are not available, so whether installation was skipped or the HOME cache was lost/mismatched is not confirmed.

## Render settings
For the existing backend service, set Root Directory to `backend`.

Build Command:
```
npm ci --include=dev && npm run render:build
```
Start Command:
```
npm run render:start
```
If retaining repository root as the service Root Directory, use:
```
cd backend && npm ci --include=dev && npm run render:build
```
```
cd backend && npm run render:start
```

Both commands set PLAYWRIGHT_BROWSERS_PATH=0 before loading Playwright, placing browsers in the installed package instead of HOME. No HOME change, version directory, executablePath, template, renderer URL or application PDF logic change is needed. The installed CLI runs the equivalent of `npx playwright install chromium`, but cannot fetch a different CLI version. Installation, headless launch, synthetic A4 PDF generation and compilation must all succeed; otherwise the build exits unsuccessfully. The browser stays within node_modules in the deployed artifact. Do not prune/reinstall dependencies after this build because that can remove the installed browser.

## Deployed verification required
After deploying, run `npm run render:verify` in Render Shell (from backend root). It must report the Linux platform and generated PDF byte count. This synthetic check writes no patient data and sends no message. Then use the existing authenticated application to prepare an actual report and invoice review, inspect the patient/bill details, and confirm attachment readiness without pressing Send. Do not use the local-only admin credentials on the deployed service.

If the Linux check reports missing shared libraries, retain the diagnostic and use a deployment image with Playwright's documented system dependencies; do not hide it with a different executable or launch flags. The build check deliberately detects these failures before deployment.

The public service URL does not grant access to Render settings, deploy logs or Shell. Deployed launch and actual report/invoice PDF generation have not been verified by this patch.

References: https://playwright.dev/docs/browsers (version-matched browsers, headless shell and hermetic cache); https://render.com/docs/deploy-node-express-app (build/start configuration and failed builds).

## Local validation (2026-10-09)
- `npm run render:build`: passed. Installed both matching Chromium variants into the hermetic cache, launched headless shell and generated a valid 16,949-byte synthetic PDF, then compiled backend.
- Backend automated tests: 77 passed; deployment configuration tests: 2 passed.
- Backend TypeScript check and build: passed.
- Frontend automated tests: 103 passed; frontend TypeScript check: passed.
- No live messages or patient/financial changes were made.
- These are Windows results, not proof of deployed Linux startup or actual patient-document generation.

Files changed: backend/package.json adds Render commands; backend/scripts/render-runtime.cjs aligns cache/install/start and fails on install/launch/PDF/compilation errors; backend/scripts/render-runtime.test.cjs verifies configuration and unsuccessful invocation; this report documents deployment and remaining verification.
- Frontend production build: passed (existing multiple-lockfile workspace-root warning).
