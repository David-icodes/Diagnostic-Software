# WhatsApp integration verification — 9 October 2026

## Implemented

Parameter Based Test Results now has one Send WhatsApp action. It opens a review dialog and does not send automatically. The dialog defaults to Reports and offers exactly the three new templates:

| Option | Meta template | Body variable order | Attachment |
|---|---|---|---|
| Reports | `lab_report_ready` | patient name, centre, patient name, patient code, selected bill number, report date | Actual generated report PDF |
| Bills / Invoice | `lab_invoice_ready` | patient name, centre, patient name, patient code, selected bill number, bill date, net, paid, balance | Actual generated invoice PDF |
| Thanks / Greetings | `patient_thank_you` | patient name, centre | None |

The review includes the actual patient/mobile/code, selected bill/date, centre, language configuration status, requested message wording, ordered variables, and a downloadable generated PDF where applicable. The action is disabled without a selected bill/patient mobile or while result submission is pending. Final Send remains disabled when deployment configuration is missing.

The backend accepts IDs/options only, verifies the exact bill/patient relationship, reads the recipient and amounts from storage, and restricts templates to the three explicit names. The new workflow calls the existing Meta sender. It never substitutes the legacy template.

## Legacy compatibility

Searched application references to `report_ready` before and after implementation. SHA-256 comparisons confirm these six existing files are byte-for-byte unchanged from the start of this pass:

- `frontend/src/components/test-result/lab-reprint.tsx`
- `frontend/src/services/whatsapp.ts`
- `backend/src/modules/whatsapp/whatsapp-send.service.ts`
- `backend/src/modules/whatsapp/whatsapp.controller.ts`
- `backend/src/modules/whatsapp/whatsapp.service.ts`
- `backend/src/validations/whatsapp.ts`

The existing Lab Reprint caller still sends `report_ready`, language `en`, with its original payload and no components/PDF attachment. Its endpoint, webhook and send implementation remain unchanged. New routes were added alongside the existing routes.

## Centre source

Uses the existing `organisationBranding` export in `frontend/src/config/organisation.ts`, including its existing `NEXT_PUBLIC_ORG_*` overrides and existing fallback behavior. A public configuration-only route exposes its name to the backend so the backend does not trust a browser-supplied centre name. This is not a database centre master.

The selector contains the single existing deployment centre. No outside-lab/client records are used as centres, and no master collection or duplicate centre records were created.

## Documents and due scope

The backend renders the existing application layouts with an isolated Playwright Chromium context authenticated as the reviewing user. It uses the existing `PrintPreview`, reference resolutions/snapshots and an extracted unchanged invoice paper component. No separate document design or Meta-review sample PDF is used.

The exact reviewed PDF bytes are retained for sending, uploaded privately to Meta as media, and attached by the returned media ID. No public clinical document URLs are created. Jobs are user-bound, expire after ten minutes, and are removed periodically. Renderer concurrency and retained PDF memory are bounded.

For report review and send, the existing server-side submission/due guard runs before generation, and again before sending. It also runs after media upload. Changes to canonical patient/bill/result/centre information invalidate the reviewed attachment and require a fresh review.

Invoice/greeting sending does not apply the report due guard. No bill-creation, OSP/Vendor, authentication, calculator, result resolver or sample relationship rules were changed.

## Logging and duplicate protection

Successful accepted messages use the existing WhatsAppMessage collection and webhook lifecycle. The new write does not overwrite a status already set by the webhook. An optional billId field links the message to its selected bill.

Accepted, blocked, failed or unconfirmed attempts also use the existing AuditLog collection. Optional details metadata records patient/bill identifiers, recipient, centre name, template, status and safe failure information. No clinical result text or credentials are added to these logs.

The review changes to sending synchronously before awaiting work. Concurrent/repeated submits of the same review cannot call Meta twice; a successful repeated request returns its existing receipt. A failed/unconfirmed attempt cannot be silently resubmitted. The UI distinguishes Meta acceptance from webhook-confirmed delivery.

## Validation

- Frontend tests: 95 passed, zero failed.
- Relevant backend tests: 20 passed, zero failed. Includes strict input validation, variable ordering, explicit languages, document headers, exact uploaded bytes, missing patient/mobile, patient/bill mismatch, report due/submission guards, local recipient prefix configuration, no automatic sends, duplicate prevention, acceptance logging and under-review rejection without fallback. Database/Meta operations in send tests were mocked.
- Frontend TypeScript: passed using `npx tsc --noEmit` (the existing frontend has no npm typecheck script).
- Backend TypeScript/build: passed.
- Frontend production build: passed. The first sandboxed attempt failed because Windows denied Next.js access to the project base path; the normal-access build succeeded. Existing multiple-lockfile warning remains.
- Full frontend lint: two existing errors, two existing warnings, no new findings. Errors: `dashboard-layout.tsx:30` and `sidebar.tsx:396`, both set-state-in-effect. Warnings: `brand-mark.tsx:29` unused suppression and `:31` raw image. Unrelated components were not rewritten.
- Targeted lint on all changed/new frontend implementation files: passed.
- Final local browser console after reloading: no errors or warnings. An initially discovered controlled-field warning in the new Centre selector was fixed.

Read-only live checks:

- Selected patient with due: report review blocked with the existing due message.
- Same selected bill: invoice review and greeting review available despite due.
- Greeting: deployment centre displayed; no PDF; exact-language configuration requirement displayed; Send disabled.
- Generated invoice PDF: one A4 landscape page, existing logo/watermark/layout, correct selected bill and totals, no development controls. Rendered and visually inspected.
- Generated submitted report PDF: three A4 portrait pages for three existing submitted tests of a patient with zero due. All pages rendered and visually inspected; existing header, reference ranges, method text, watermark/footer and page numbers retained.
- Existing continuous-print pagination remains: the longer CBP report's ending/footer continues onto the following page. This pass reused that layout and did not redesign its pagination.
- No real Meta send/upload was performed. No database records were created or changed during this implementation/verification.

## Files changed in this pass and reasons

### Backend

- `backend/.env.example`, `backend/src/config/env.ts`: explicit new-template language settings, local-mobile country prefix and PDF API origin; no guessed defaults for languages or country prefix; actual .env untouched.
- `backend/package.json`, `backend/package-lock.json`: Playwright dependency for server-accessible PDFs from existing layouts.
- `backend/src/validations/whatsapp-lis.ts`: strict review/send input validation, independent of legacy validation.
- `backend/src/modules/whatsapp/lis-template.ts`: exact new-template mapping, ordered variables, language checks and document/body components.
- `backend/src/modules/whatsapp/lis-media.service.ts`: private actual-PDF media upload through the existing Meta configuration.
- `backend/src/modules/whatsapp/lis-workflow.service.ts`: authoritative record loading, review/PDF jobs, server checks, confirmation sending, logging and duplicate protection.
- `backend/src/modules/whatsapp/lis-workflow.controller.ts`, `backend/src/modules/whatsapp/whatsapp.routes.ts`: authenticated new workflow routes alongside legacy routes.
- `backend/src/models/whatsapp-message.model.ts`: optional selected bill link for new send logs.
- `backend/src/models/audit-log.model.ts`, `backend/src/modules/audit/audit.service.ts`: optional attempt details for existing audit logging; existing callers remain compatible.
- `backend/src/modules/whatsapp/lis-template.test.ts`, `lis-workflow.test.ts`, `lis-media.test.ts`: mocked feature and compatibility checks.

### Frontend

- `frontend/src/components/test-result/parameter-based-test-results.tsx`: one action and dialog connection, preserving the existing grids/controls.
- `frontend/src/components/test-result/invoice-print-dialog.tsx`: exports the same invoice paper for both the existing print dialog and authenticated renderer.
- `frontend/src/components/whatsapp/lis-send-dialog.tsx`: review/confirmation UI and explicit configuration errors.
- `frontend/src/components/whatsapp/lis-document.tsx`, `frontend/src/app/whatsapp/document/page.tsx`: authenticated document job view using existing clinical/invoice components.
- `frontend/src/app/whatsapp/organisation/route.ts`: public existing organisation configuration name only.
- `frontend/src/services/whatsapp-lis.ts`: typed new workflow calls; existing WhatsApp service untouched.
- `frontend/src/lib/whatsapp-preview.ts`, `whatsapp-preview.test.ts`: requested message preview wording and tests.
- `reports/whatsapp-review.png`: local review dialog verification screenshot.

## Deployment requirements / remaining limits

Configure the existing backend credentials privately. For metadata inspection, the existing WABA ID is also needed. Supply each exact configured Meta language with no guessed locale:

| Template | Backend setting |
|---|---|
| `lab_report_ready` | `WHATSAPP_LAB_REPORT_READY_LANGUAGE` |
| `lab_invoice_ready` | `WHATSAPP_LAB_INVOICE_READY_LANGUAGE` |
| `patient_thank_you` | `WHATSAPP_PATIENT_THANK_YOU_LANGUAGE` |

Configure `WHATSAPP_LOCAL_COUNTRY_CODE` for stored ten-digit local numbers, or use existing international numbers. The new workflow does not guess a prefix or update patient records. Legacy normalization remains untouched.

Set `FRONTEND_URL` to the actual frontend and `WHATSAPP_RENDER_API_ORIGIN` to the origin of frontend `NEXT_PUBLIC_API_URL` without `/api/v1`. Retain the existing cookie/CORS deployment settings. Install Chromium on the backend host with `npx playwright install --with-deps chromium`. Remote images outside the frontend/API origins are blocked in the renderer; the current local logo was verified.

The three Meta templates still require approval and their exact document/body definitions. Live provider delivery was not tested because credentials/languages are missing and sending during implementation was prohibited. Provider failures return actual errors with no fallback.

Review jobs are deliberately ephemeral and scoped to one backend process. After a restart, review again. A deployment with multiple backend replicas requires session affinity for the review/document/send sequence; no shared durable review storage was introduced in this scoped pass.

Meta document-header shape was checked against the [official Meta SDK documentation](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/types/DocumentMediaObject/) and the [official Meta API workspace](https://www.postman.com/meta/whatsapp-business-platform/request/2qbotrb/send-message-template-media).
