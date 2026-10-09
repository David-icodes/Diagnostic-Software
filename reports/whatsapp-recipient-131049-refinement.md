# WhatsApp recipient and 131049 refinement — 9 October 2026

## Implemented
The shared Send WhatsApp dialog used by Parameter Test Results and Lab Reprint now displays a read-only WhatsApp recipient input immediately, starting at +91 while review preparation runs. The backend returns the canonical international number to that same field. It remains read-only because the recipient must come from the selected patient's authoritative database record. No second formatting implementation was introduced in either page.

A new shared backend normalizeLisRecipient helper uses libphonenumber-js 1.13.15 with full validation metadata. Ten-digit local numbers default to India (+91); already international numbers retain their own country code. Whitelisted spaces, hyphens, parentheses and dots are normalized. A single leading 00 international prefix is also supported. Embedded/duplicate plus signs, duplicated country codes, unexpected text/extensions, incomplete numbers and invalid country/number combinations are rejected with a clear 422 error before any Meta request.

Normalization happens in loadLisContext for both review and the final send-time canonical-data recheck. The displayed value has a leading +. The existing Meta sender continues preparing its transport digits as before. The patient's mobile is never assigned or saved by this operation, and printed documents continue using the original patient data.

WHATSAPP_LOCAL_COUNTRY_CODE is retained as a compatibility setting, but the shared new LIS flow no longer requires it for Indian ten-digit numbers. The explicitly requested +91 default supersedes the earlier missing-prefix configuration warning. Existing country-prefixed international numbers do not receive another +91.

## Requested normalization cases
- 9876543210 -> +919876543210
- +919876543210 -> +919876543210
- 919876543210 -> +919876543210
- 98765 43210 / +91 (98765)-43210 -> +919876543210
- +1 202-555-0123 -> +12025550123
- 442079460018 -> +442079460018
- +65 9123 4567 -> +6591234567 (no extra prefix despite its ten-digit international form)
- +91+919876543210, duplicated bare 91 prefixes, blank/incomplete numbers, unknown country codes, all zeros and text/extensions -> blocked

## Error 131049
The exact displayed text is now:

Meta did not deliver this message because of its messaging engagement restrictions. Wait before trying again.

Existing failed webhook records retain their original Meta message ID, error code, provider details and failed status. The read-only delivery history maps 131049 to the exact text above. Sent, delivered, read and failed remain distinct; a failed record cannot be overwritten by late delivered/read events.

Direct Meta HTTP rejections with code 131049 also return this exact explanation and preserve metaErrorCode in structured error details and the existing failed-attempt audit. They mark the review/attempt failed and cannot be submitted again. A direct rejected request may not return a Meta message ID; no synthetic ID is invented. All real webhook IDs remain preserved for troubleshooting.

No automatic retry, repeated resend, template substitution, category/language change or approval-text rewrite was added. Correct recipient formatting does not resolve or bypass Meta's engagement restriction. The approved dynamic patient_thank_you preview still has exactly the supplied greeting wording and two ordered variables.

## Preservation
- Existing report_ready name, language/payload and normalization behavior remain unchanged; explicit legacy payload regression passes.
- All three new names, Meta categories, language settings, approved wording and variable order remain unchanged.
- Report/invoice document layouts, attachments, template selection, due restrictions and billing behavior are unchanged.
- No MongoDB patient numbers, clinical/billing records or Meta templates were changed.

## Runtime checks without sending
Authenticated greeting review requests were made for both parameter-results and lab-reprint using the existing selected due bill OSP202600092. Both returned the correct +91 recipient, language en, no PDF, and no configurationError. A subsequent read confirmed the patient's database mobile matched its original stored value. No send/media upload endpoint was called and no live webhook was simulated.

## Files changed
- backend/package.json and package-lock.json: add libphonenumber-js for maintained international validation.
- backend/src/modules/whatsapp/lis-recipient.ts and lis-recipient.test.ts: shared normalization and all requested positive/negative cases.
- backend/src/modules/whatsapp/lis-workflow.service.ts and lis-workflow.test.ts: prepare/recheck canonical recipients, remove obsolete prefix requirement, preserve patient data, and verify definite 131049 failure/no-resubmit handling.
- backend/src/modules/whatsapp/lis-delivery.service.ts and lis-delivery.test.ts: exact user-friendly 131049 wording and direct/webhook failure regressions.
- backend/src/modules/whatsapp/whatsapp-send.service.ts: preserve structured Meta error code and map direct 131049 rejection to the same exact explanation; outgoing payload unchanged.
- backend/src/config/env.ts and backend/.env.example: clarify retained compatibility setting and new +91 default; private .env unchanged.
- frontend/src/components/whatsapp/lis-send-dialog.tsx: single shared visible canonical recipient field with immediate +91 default.
- This report.

## Validation
Frontend tests: 98 passed. Relevant backend tests: 38 passed. Frontend/backend TypeScript and both production builds passed. Targeted frontend lint passed. No live WhatsApp messages were sent: provider sends in tests are mocked. Interactive browser checks remain blocked by the automation launcher's unavailable E-drive error; the canonical review values and unchanged storage were independently checked through authenticated API reads/reviews.