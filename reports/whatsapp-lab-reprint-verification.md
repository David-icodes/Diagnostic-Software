# Lab Reprint WhatsApp extension — 9 October 2026

## Implementation
Lab Reprint's single Send WhatsApp page action opens the existing LisSendDialog. Both pages therefore share the same three-template selector, patient/bill review, actual attachment preparation, explicit confirmation, safe Retry, configuration checks and duplicate submission protection. No separate integration or sender was added.

Lab Reprint supplies its selected patient/bill/test/signature and a validated lab-reprint workflow scope. Missing workflow retains Parameter Results behavior for existing API callers. The backend retains the scope in the user-bound review and applies it again when canonical data and report availability are rechecked at send time. Template names, ordered variables, recipient validation, bill/patient binding, submitted-result checks and actual-document validation remain enforced.

An Existing report_ready workflow action within the shared dialog opens the original confirmation. Its handler, no-variable payload, language en, legacy endpoint and existing sender are unchanged; legacy service/controller/validation hashes match the prior pass. The legacy action never sends automatically. Only Lab Reprint imports/action placement were extended; its exported clinical PrintPreview layout was not changed.

## Exact Meta configuration and wording
A read-only GET against the configured WABA returned all three templates as APPROVED with exact language en. Configured the existing private backend .env settings individually:

- WHATSAPP_LAB_REPORT_READY_LANGUAGE=en
- WHATSAPP_LAB_INVOICE_READY_LANGUAGE=en
- WHATSAPP_PATIENT_THANK_YOU_LANGUAGE=en

No legacy fallback or language default was added. Local API review responses verified en for each template. New deployment environments must receive those three settings independently; changing the local .env does not configure a hosted deployment. Each setting is still independently selected in frontend review/backend sending; tests use deliberately distinct language values to prevent aliasing.

The actual approved bodies differ from the pasted proposed wording. The report BODY starts with literal Header:, Laboratory Report and Body:, and ends with Thank you. followed by Foo. Its actual HEADER is a DOCUMENT, not a text header. The greeting body ends after the serving-you-again sentence and has no Regards/centre signature. Invoice ends with Thank you. The preview now matches those actual approved definitions, preserves all placeholder positions, and displays the approved Anjali Diagnostics footer. No Meta template was edited. Correcting the unexpected report text would require changing the template in Meta and receiving approval; this implementation does not silently invent corrected delivered wording.

Actual parameter orders remain report 6, invoice 9, greeting 2. Sample/example patient values and Meta example attachment URLs are not application data or live attachments.

## Due restriction
The existing report workflow previously summed every generated bill for a patient. It now validates the selected applicable bill's dueAmount only. Parameter Results continues blocking report generation/printing when that bill has a positive balance. Nonfinite/negative balances cannot pass validation.

Lab Reprint's new report workflow preserves successful submission and exact selected-test checks but does not apply the Parameter Results due restriction. Invoices/greetings have no report-specific due gate. Existing report-upload checks within Parameter Results continue rechecking submission and the selected bill's due.

Inspected patient profile/Modify, remote OSP/Vendor billing and backend patient/bill modification/creation paths. They had no broad due gate to remove; their implementations were left untouched. Existing restrictions on inactive patients/clients, cancelled bills, paid generated-bill modification, and sample/result relationships remain intact. Mocked tests verify patient save, OSP/Vendor creation, eligible unpaid-bill modification and preservation of the paid-bill integrity guard. No live patient/bill records were modified for testing.

## Actual verification
For existing due bill OSP202600092 / DAVID / GP202600054:

- Lab Reprint report review: successful actual PDF; 2 pages; PDF text verifies patient, patient ID and bill.
- Lab Reprint invoice review: successful actual PDF; 1 page; same identity checks pass.
- Lab Reprint greeting: no attachment, language en.
- Parameter Results report review for the same bill: blocked with the outstanding-due message.
- No send or Meta media-upload endpoint was called. Meta access during this pass was template metadata GET only.

Artifacts are private local tmp/pdfs/reprint-lab_report_ready.pdf and reprint-lab_invoice_ready.pdf. Actual generation required starting the production-built frontend at port 3000 and restarting the verified project backend with normal host access: the older sandbox-started backend reported its browser runtime inaccessible even though normal host launch succeeded. No alternate browser path/PDF engine was added.

## Checks
- Frontend tests: 98 passed.
- Relevant backend tests: 29 passed.
- Frontend/backend TypeScript: passed.
- Frontend/backend builds: passed.
- Targeted frontend lint: passed.
- Full frontend lint retains the prior baseline: dashboard-layout.tsx:30 and sidebar.tsx:396 errors; brand-mark.tsx:29/31 warnings. Unrelated components were not rewritten.
- Browser interactive/console checks unavailable because computer automation's MXC launcher cannot enumerate the unavailable E drive. Component wiring/shared selector and readiness were checked through code, tests and builds; actual PDFs were independently generated through authenticated API calls.

## Files changed in this pass
- backend/.env: exact three Meta-confirmed languages; private configuration, no credentials printed or changed.
- backend/src/validations/whatsapp-lis.ts: explicit validated workflow scope, old callers retain default behavior.
- backend/src/modules/whatsapp/lis-workflow.service.ts: apply the stored workflow's due scope at review and send rechecks.
- backend/src/modules/test-results/result-workflow.service.ts: selected-bill due verification and reprint-specific exclusion of the due gate while keeping submission checks.
- backend/src/modules/test-results/result-workflow.test.ts: selected-bill isolation, due-blocked Parameter Results, permitted reprint, invalid tests still blocked.
- backend/src/modules/test-results/report-upload.test.ts: selected-bill fixture and persisted upload/submission/due rechecks.
- backend/src/modules/whatsapp/due-scope.test.ts: mocked patient save, OSP/Vendor creation and eligible bill modification/integrity regressions.
- backend/src/modules/whatsapp/lis-template.test.ts: independent languages and workflow validation.
- frontend/src/services/whatsapp-lis.ts: typed optional workflow selection using the existing review API.
- frontend/src/components/test-result/lab-reprint.tsx: single shared-dialog action and original legacy confirmation access.
- frontend/src/components/whatsapp/lis-send-dialog.tsx: optional legacy access and approved footer/wording description.
- frontend/src/lib/whatsapp-preview.ts: actual Meta-approved body text and dynamic positional substitution.
- frontend/src/lib/whatsapp-preview.test.ts: actual approved wording regression.
- This report.

## Remaining configuration
WHATSAPP_LOCAL_COUNTRY_CODE is unset. The selected patient stores a ten-digit local mobile number, so all reviews correctly report this missing dialing-prefix configuration and disable Send. No prefix was guessed and no patient number was rewritten. Once the genuine prefix is configured, all other required validation must still pass. Production must have the three confirmed language settings, existing credentials and renderer setup from the previous PDF-fix report. No live sending or provider delivery is claimed verified.