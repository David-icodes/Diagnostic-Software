# Authenticated WhatsApp PDF investigation — 2026-10-10

Status: diagnostic changes prepared; the production failure's root cause is not yet confirmed. No real deployed report or invoice has been generated during this investigation. No live WhatsApp messages were sent.

## Traced flow
The backend validates the selected patient, bill and report eligibility and creates an expiring in-memory review owned by the authenticated user. Playwright launches Chromium, creates an isolated context, and copies only the existing HttpOnly session cookie to WHATSAPP_RENDER_API_ORIGIN with path `/`. The copied cookie uses Secure on HTTPS, copies COOKIE_SAMESITE, and has browser-session lifetime; the JWT's original expiration is still verified by the existing authentication middleware.

Playwright navigates to FRONTEND_URL + `/whatsapp/document?reviewId=<private review identifier>`. The document page POSTs to NEXT_PUBLIC_API_URL's origin + `/api/whatsapp/lis/document-data`, including credentials and the review identifier in its body. The endpoint runs existing authentication and whatsapp.send permission checks, then checks review ownership and expiration. It returns the real report/invoice data to the existing print layouts. The renderer does not navigate to the backend root `/`. Global frontend AuthProvider also fetches `/api/v1/auth/me`; success of unrelated requests is not evidence that this document request is authenticated.

The previous renderer waited only for a ready marker. A client-side API error displayed an alert without that marker, so a 401/403/410 or network/CORS error became a 60-second authenticated-document timeout. New diagnostics observe the actual renderer requests and the document page's terminal error state.

## Evidence actually collected
Unauthenticated public HTTPS checks from this workstation:
- Frontend `/whatsapp/document`: HTTP 200, no login redirect.
- Frontend `/whatsapp/organisation`: HTTP 200.
- Backend `/health`: HTTP 200.
- The deployed document page's JavaScript embeds `https://diagnostic-software.onrender.com/api/v1`. It is not pointing at localhost.

Ran verification/deployed-renderer-cookie-probe.cjs against the public deployed frontend with local Playwright. All backend requests were intercepted and returned synthetic 401 responses. Cookies were synthetic and never forwarded to Render. No real session or patient data was used.

Observed POST `/api/whatsapp/lis/document-data` at the correct Render origin:
- SameSite=Lax: cookiePresent=false; navigationStatus=200; finalRoute=/whatsapp/document.
- SameSite=None with Secure: cookiePresent=true; navigationStatus=200; finalRoute=/whatsapp/document.

This confirms a cross-site cookie failure mechanism for these deployed origins. It does **not** establish Render's current COOKIE_SAMESITE value or confirm that this is the user's actual production failure. Reported NODE_ENV=development alone does not establish the cause: this project's login controller already uses Secure when COOKIE_SAMESITE=none, and the renderer uses Secure for HTTPS.

## Diagnostic changes
- Renderer collects bounded structured events for navigation/redirect responses, HTTP failures, document-request cookie presence, safe console/network error categories, installed cookie attributes, final page state and elapsed time/timeout. A random diagnostic identifier is unrelated to the private review identifier.
- Only configured origins and fixed application route names are retained. Query values, arbitrary patient paths, response bodies, console text, token values, cookie values and patient/bill identifiers are excluded.
- Missing renderer sessions, bad navigation statuses and redirects away from the document route fail explicitly.
- Document API HTTP errors fail immediately, including with the older deployed frontend. The updated frontend additionally exposes a terminal error marker and numeric HTTP status so client/network errors do not silently wait for ready.
- Existing authentication middleware reports expired JWT, invalid JWT and rejected account/session categories only for the document-data endpoint.
- No authentication bypass or speculative change to the cookie policy was made. Report/invoice attachments, greetings, template languages/wording/order, report_ready, required-PDF Send blocking and manual send behavior are preserved.

## Required deployment configuration
Use existing names. Verify the values in Render rather than assuming the public URL proves the environment:

```text
NODE_ENV=production
FRONTEND_URL=https://diagnostic-software.vercel.app
WHATSAPP_RENDER_API_ORIGIN=https://diagnostic-software.onrender.com
COOKIE_SAMESITE=none
PLAYWRIGHT_BROWSERS_PATH=0
```

If CORS_ORIGINS is set, include `https://diagnostic-software.vercel.app`; the backend combines it with FRONTEND_URL. Preserve COOKIE_NAME, JWT_SECRET, JWT_EXPIRES_IN, database and WhatsApp credentials. After changing login-cookie policy, sign in again normally; do not copy credentials into logs.

Vercel build environment:
```text
NEXT_PUBLIC_API_URL=https://diagnostic-software.onrender.com/api/v1
```
This is already observed in the current public document bundle. Rebuild frontend if it changes.

Keep Render Root Directory `backend`, Build Command `npm ci --include=dev && npm run render:build`, Start Command `npm start`. Do not change HOME or browser executable paths.

## Deployed reproduction still required
Deploy the diagnostic changes to the existing services. In an authorized session, select one bill and prepare its report or invoice review once; do not press Send or automatically retry. Capture the resulting `[WhatsApp PDF]` and, if emitted, `[WhatsApp PDF auth]` structured logs. These logs deliberately omit patient/session values. Interpret the renderer's own documentStatus and documentCookiePresent:
- 401 + cookie absent: cookie policy/scoping or browser cookie blocking; compare installed cookie metadata and request origin.
- 401 + cookie present: examine the auth reason for JWT expiration or invalid session.
- 403: account/permission rejection; retain authorization checks.
- 410: missing, expired, wrong-owner or already-finished review. Reviews are process-local; verify the review/document requests reach the same backend instance before changing architecture.
- No document response plus CORS/network/blocked-request events: check configured origins, preflight and frontend bundle.
- Navigation error/redirect or timeout before a document request: inspect navigation status/final route and safe browser error categories.

After correcting the confirmed failure, prepare and open actual report and invoice PDFs through the deployed backend. Verify both match the authorized patient/bill and actual document contents. Run `npm run render:verify -- /tmp/lis-render-check.pdf` in Render Shell to independently verify its Linux browser runtime. A synthetic PDF or ordinary /me success cannot replace these document checks.

The user subsequently supplied signed-in Render and LIS browser sessions. Production reproduction and configuration correction are recorded below; final PDF content inspection remains pending.

## Validation results
- Production reproduction on 2026-10-10 at 12:16:01 (Render log display) confirmed `apiOrigin: http://localhost:5000`, `sameSite: none`, `incomingCookiePresent: true`, and `installed: false`. It failed at authenticated session setup before navigation (`pageState: not-loaded`, no HTTP response, no timeout). Render lacked the existing `WHATSAPP_RENDER_API_ORIGIN` setting; its localhost default scoped the session to the wrong HTTP origin, and the None cookie was not installed there. This is renderer-specific; ordinary browser authentication was valid.
- Added `WHATSAPP_RENDER_API_ORIGIN=https://diagnostic-software.onrender.com` to the existing Render service and initiated deployment `dep-db4tvel9fdbs73ate60g`, preserving other settings and startup. Its Linux build verified Playwright 1.64.0 and generated a 9,186-byte synthetic PDF. Actual authenticated report/invoice verification remains required after it becomes live.
- That deployment became live at 12:20:11. Preparing Reports at 12:20:38 generated a 1,156,468-byte PDF; preparing Bills / Invoice for the same selected bill at 12:21:25 generated a 1,134,320-byte PDF. Diagnostics confirmed the HTTPS API origin, installed Secure/HttpOnly/SameSite=None cookie, cookie on the authenticated document request, HTTP 200 and `pageState: ready`. The UI returned the same selected patient/bill association for both reviews. No Send action was performed. PDF byte content inspection remains pending; a download control for the exact review attachment has been prepared for that check.
- Backend deployment build passed locally: Playwright 1.64.0 launched Chromium and generated a real 16,949-byte synthetic PDF, then compiled TypeScript.
- Backend typecheck passed, including after the final test additions.
- Relevant backend WhatsApp/table-export tests: 37 passed; deployment helper tests: 2 passed. Cases cover missing sessions, frontend 401/403/410 error states, document API rejection with an older frontend, login redirects, no PDF output after authentication failure, diagnostic redaction and existing send/attachment validation.
- Frontend tests: 103 passed; frontend standalone typecheck passed; frontend production build passed after retrying outside the restricted Windows shell. The initial restricted build failed with compiler Access Denied. An interrupted retry was rerun to obtain a complete successful result. The existing multiple-lockfile workspace warning remains.
- Public deployed frontend cookie probe completed: Lax omitted the synthetic session cookie, None+Secure included it. Backend traffic was intercepted; these results are not real authenticated Render PDF-generation logs.
- git diff --check and probe JavaScript syntax check passed. No new dependencies or real .env files were added.
- Initial browser inventory had no authenticated sessions; the user later signed in. The confirmed production cause and successful real report/invoice generation are recorded above. Final content inspection remains pending; no authentication bypass or speculative cookie-policy override was introduced.
