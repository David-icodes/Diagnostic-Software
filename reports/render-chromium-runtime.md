<<<<<<< HEAD
# Render Chromium runtime repair — 2026-10-10

Status: configuration prepared locally; deployed verification is still required.

## Inspected project
- Root package has no build or pdf:install script. All commands below target backend.
- backend/package.json: build = `tsc`; start = `node dist/server.js`; pdf:install = `playwright install chromium`; build:deployment = `npm run pdf:install && npm run build`.
- Existing render:build = `node scripts/render-runtime.cjs build`; render:verify = `node scripts/render-runtime.cjs verify`. The legacy render:start wrapper is unnecessary for the settings below.
- backend/package-lock.json locks playwright and playwright-core to 1.64.0 (package dependency range ^1.64.0). npm ci preserves that version.
- Both PDF renderers launch chromium with headless: true and no channel or hardcoded executablePath. The WhatsApp diagnostic executablePath() is a log lookup, not a launch override.
- The supplied Linux error requests headless-shell revision 1248 from /opt/render/.cache/ms-playwright. It proves that executable is missing there; it does not prove whether installation was skipped or the build/runtime caches differ.
- No render.yaml, Dockerfile, or checked-in Render deployment configuration exists in this checkout. Live Root Directory, build/start settings, HOME and PLAYWRIGHT_BROWSERS_PATH cannot be inspected through the public service URL.
- Local HOME and PLAYWRIGHT_BROWSERS_PATH were unset at inspection.

## Exact settings for the existing Render backend
Keep the existing native Node backend service and frontend architecture.

Root Directory: `backend`

Environment variable (available at build and runtime): `PLAYWRIGHT_BROWSERS_PATH=0`

Build Command:
```sh
npm ci --include=dev && npm run render:build
```

Start Command:
```sh
npm start
```
This retains the existing backend startup script: node dist/server.js.

If the existing Root Directory is repository root, retain it and use:
```sh
npm --prefix backend ci --include=dev && npm --prefix backend run render:build
```
```sh
npm --prefix backend start
```
Set the same service environment variable in either case. Do not set or change HOME. Do not install browser packages in root or frontend. Do not run npm ci or prune node_modules after browser installation.

The build helper sets PLAYWRIGHT_BROWSERS_PATH=0 before loading the installed Playwright CLI, runs its `install chromium`, launches headless shell, generates an actual synthetic PDF and compiles TypeScript. Failure of any step fails the build. At runtime the service environment variable makes the unchanged npm start command find the same browser cache under backend/node_modules/playwright-core/.local-browsers. This avoids HOME-dependent lookup in /opt/render/.cache/ms-playwright.

The compatible manual install command, from backend with dependencies installed, is:
```sh
PLAYWRIGHT_BROWSERS_PATH=0 npm run pdf:install
```
The existing script installs both Chromium and its matching headless shell. The installed local CLI also supports `install chromium --only-shell` for these channel-free headless renderers; the build retains the full installation. Never use --no-shell here. Do not hardcode revision directories. Linux OS libraries are separate; if launch reports missing libraries, preserve that failure and resolve the service image dependencies before declaring success.

## Required deployed verification
1. Apply the settings to the existing Render service and deploy the changed backend. Confirm the build prints the Playwright version, Linux platform, PDF byte count, package-local browser cache and successful compilation.
2. In Render Shell first run `printenv PLAYWRIGHT_BROWSERS_PATH` and require the output `0`; the helper sets its own cache and cannot prove the service environment was configured. Then, from backend, run `npm run render:verify -- /tmp/lis-render-check.pdf`. Download/open the resulting actual PDF. Confirm runtime HOME and browser cache diagnostics in the output. This synthetic document contains no patient data and sends no WhatsApp message.
3. Through the authenticated application, prepare an actual lab report and invoice review, open/download both PDFs and confirm their patient/bill contents and attachment readiness. Do not press Send for verification.
4. WhatsApp recipient/template/workflow checks, required-PDF blocking, actual media upload and attachment components are unchanged. No fallback message or placeholder patient PDF is introduced.

The public URL https://diagnostic-software.onrender.com does not provide Render settings or Shell access. Deployed launch and actual patient-document generation remain unverified.

References: https://playwright.dev/docs/browsers (version-matched browsers, headless shell, hermetic cache); https://render.com/docs/deploy-node-express-app (build/start settings).



## Local validation performed on 2026-10-10
- Backend npm ci --include=dev passed after a network-enabled retry; lockfile Playwright version unchanged.
- Installed browser manifest confirmed Chromium/headless-shell revision 1248, browser version 156.0.8078.4.
- npm run render:build passed: matching browsers installed into package-local cache, actual PDF generated (16,949 bytes), TypeScript compiled.
- npm run typecheck passed.
- 36 relevant WhatsApp/PDF export tests passed; 2 deployment-helper tests passed. Tests use mocked provider calls; no live messages were sent.
- npm run render:verify -- ../tmp/pdfs/render-runtime-check-2026-10-10.pdf passed and saved an actual 16,949-byte synthetic PDF.
- Verification runtime reported win32, PLAYWRIGHT_BROWSERS_PATH=0 and HOME=C:\Users\PRAVEEN. The earlier restricted shell reported HOME unset; neither tells us Render's HOME.
- Changes this turn: corrected backend/.env.example and this deployment guide to retain npm start and set the service cache variable; enhanced the existing verification helper to optionally save a real PDF and log cache/HOME diagnostics. Browser install/build helper and WhatsApp renderer/validation architecture were retained.
- Render settings were not applied remotely. Deployed Linux launch and actual lab report/invoice PDFs remain unverified.
=======
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
>>>>>>> origin/main
