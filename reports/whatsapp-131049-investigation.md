# WhatsApp 131049 investigation — 9 October 2026

## Confirmed correlation
Read-only inspection of WhatsAppMessage and matching AuditLog records found the two recent failures below. Both belong to patient_thank_you, language en, recipient ending 1134, and selected bill ID 6ac889ad77bfff99eda526ed. Neither recent failure belongs to lab_report_ready or lab_invoice_ready. No full mobile/name or clinical content is included in this report.

| UTC creation time | Meta message ID | Template | Stored status |
|---|---|---|---|
| 2026-10-09 06:33:01.765 | wamid.HBgMOTE3OTk3MTcxMTM0FQIAERgSNEM4QjMwNTgxODRBODU0NDg1AA== | patient_thank_you | failed / 131049 |
| 2026-10-09 06:32:13.992 | wamid.HBgMOTE3OTk3MTcxMTM0FQIAERgSQ0VGRDZGMDUzMDdFMjg0QkNFAA== | patient_thank_you | failed / 131049 |
| 2026-10-09 06:31:27.761 | wamid.HBgMOTE3OTk3MTcxMTM0FQIAERgSNzMzMUI3OUJEODEzQjM1NkM0AA== | lab_invoice_ready | read |
| 2026-10-09 06:30:51.718 | wamid.HBgMOTE3OTk3MTcxMTM0FQIAERgSMzlGMzg1RUZGRjMzRDQxMzU4AA== | lab_report_ready | read |

All four are linked to the same selected bill and recipient. Their records/audits did not retain the originating Parameter Results versus Lab Reprint workflow. It cannot be reconstructed reliably; it is reported as unknown, not backfilled with a guess. Older 131049 failures also exist without template names; those cannot be attributed to a particular template from the stored data.

## Meta source of truth
Read-only GET of the configured WABA template metadata returned:

| Template | Current category | Language | Approval |
|---|---|---|---|
| report_ready | UTILITY | en | APPROVED |
| lab_report_ready | UTILITY | en | APPROVED |
| lab_invoice_ready | UTILITY | en | APPROVED |
| patient_thank_you | MARKETING | en | APPROVED |

No template, language, category, wording or variable order was changed. No Meta example document was used or downloaded.

## Root cause and uncertainty
The failed webhook records explicitly report error 131049 and Meta's healthy-ecosystem engagement nondelivery reason. This is an asynchronous Meta delivery refusal after accepting the greeting send, not an LIS PDF generation failure. The utility report/invoice to the same recipient reached read status. The greeting's current MARKETING classification is verified directly from Meta, not inferred from its text.

The precise recipient-level engagement decision/threshold is not provided in these events. Historical pricing category and originating workflow were not recorded. No claim is made that changing code will make Meta deliver a blocked greeting. No category migration, template substitution or resend workaround was attempted. Approval and API acceptance do not guarantee delivery.

## Changes
- Existing outgoing sender logs now put template, language, Meta ID, masked recipient and accepted status in one correlation entry. Its payload and legacy report_ready behavior are unchanged.
- New-workflow acceptance logs and existing audit/message records retain the explicit workflow, with parameter-results as the existing default. No patient name, clinical result or token is added to server logs.
- Webhook logs correlate event status and stored status with Meta ID/template/workflow and masked recipient. Unknown attribution remains unknown. Ignored duplicate/out-of-order events and persistence failures have safe diagnostic logs.
- Existing webhook failed/errorCode/errorMessage/failedAt storage is retained. Failed is terminal against later sent/delivered/read events. Confirmed delivered/read is also protected against stale contradictory failure events. Sent, delivered, read and failed timestamps/statuses remain distinct. Acceptance no longer creates a sentAt timestamp before a real sent event.
- Fixed the inspected outbound phoneNumber assignment: metadata.display_phone_number is the business sender, so the recipient_id is used for the outbound recipient. No historical records were rewritten; waId already provided the correct recipient for this investigation.
- Added an authenticated, whatsapp.send-permission-protected bill-scoped delivery history endpoint, returning only ten recent outgoing delivery metadata rows and safe messages. It never sends or updates records.
- Shared WhatsApp dialog now displays recent stored delivery statuses, including the existing two failures, with the explanation that Meta did not deliver and no automatic retry will be made. Refresh reads status only. After explicit send, bounded polling checks status every five seconds for up to five minutes, stopping at read/failed; it does not call the send endpoint. Duplicate Submit protection remains.

## Read-only runtime verification
Authenticated POST /api/whatsapp/lis/delivery for the actual failed bill returned HTTP 200 with exactly the two greeting failures and the read report/invoice above. Failure rows have errorCode 131049, workflow unknown, and the user-friendly nondelivery explanation. No full recipient/patient data is returned by this endpoint. No real send, media upload, simulated live webhook, billing change or clinical record write was performed.

## Checks
- 33 relevant backend tests passed, including failure persistence, late/duplicate events, no provider calls from webhook processing, bill-scoped safe history, privacy masking, exact legacy report_ready no-variable payload, template variable orders/languages and unchanged report/billing due-scope regressions.
- 98 frontend tests passed.
- Frontend/backend TypeScript and backend build passed.
- Targeted frontend lint passed.
- Frontend production build passed (existing multiple-lockfile warning remains).
- Interactive browser checks remain unavailable because the automation launcher fails while enumerating the unavailable E drive. Runtime delivery history was tested independently through the authenticated API; no live Meta sending was tested.

## Files changed
- backend/src/models/whatsapp-message.model.ts: optional workflow correlation metadata on existing records; no new message collection.
- backend/src/modules/whatsapp/lis-delivery.service.ts: masked logs, safe status text and read-only bill history.
- backend/src/modules/whatsapp/lis-delivery.test.ts: lifecycle/privacy/no-retry/legacy-payload regressions.
- backend/src/modules/whatsapp/whatsapp-send.service.ts: correlated acceptance logging only; original Meta payload unchanged.
- backend/src/modules/whatsapp/whatsapp.service.ts: correlated webhook logging, terminal status guards and correct recipient metadata.
- backend/src/modules/whatsapp/lis-workflow.service.ts: workflow metadata/logs and sent timestamp correction.
- backend/src/modules/whatsapp/lis-workflow.controller.ts and whatsapp.routes.ts: existing authenticated integration's read-only history action.
- frontend/src/services/whatsapp-lis.ts: typed delivery history request.
- frontend/src/components/whatsapp/lis-send-dialog.tsx: status history, safe failure message and bounded read-only refresh.
- This report.

## Remaining
Meta may continue rejecting marketing greetings for this recipient; the exact engagement rule is not disclosed in the recorded event. Historical workflow attribution cannot be proven. No approved wording, category, language, recipient validation, duplicate protection or unrelated bill/report restriction was changed to work around 131049.