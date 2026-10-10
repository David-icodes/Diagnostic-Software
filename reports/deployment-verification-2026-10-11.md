# Deployment verification — 2026-10-11 (Asia/Kolkata)

## Verified this run
- GitHub main resolves to acb2907ce8114a05e46079d459d58aca6f86ce16, matching the saved origin/main reference. Local main remains behind by three commits; existing local integration files were preserved.
- Public Render /health and Vercel /login return HTTP 200.
- Deployed admin login and generated-bill listing return HTTP 200. Session cookie has Secure and SameSite=None attributes. Credentials and session values were not printed or saved in reports.
- Existing targeted storage/workflow tests: 14 passed, zero failures. Backend TypeScript check passed.
- The locally configured Cloudinary environment accepts synthetic A4 portrait report and A4 landscape invoice uploads as authenticated raw assets. Provider-aligned 60-second signed downloads returned HTTP 200 and byte-identical PDFs. Unsigned delivery and deliberately expired signed downloads returned HTTP 401. All temporary uploaded assets were deleted successfully.

## Findings and limits
- This computer's clock was approximately 95–100 seconds behind Cloudinary. The unmodified local 60-second signed-download logic returned a stale-request HTTP 401. Only the verification script uses provider response time for signing; production application logic and system clock were not changed. Synchronize the computer clock before running the application locally. Render's clock was not measured by this test.
- The deployment returned one generated bill, with its populated patientId equal to null. Both PDF preparation requests were rejected with HTTP 400 for patientId. A valid linked patient/bill and submitted results are needed to complete live report/invoice verification. No patient, bill, payment or result records were changed.
- Browser/native automation initialization failed because the environment launcher cannot read F: (OS error 1392). Render dashboard access, private Render environment settings and deployed commit identity could not be inspected. Local credential success does not prove the same settings are configured in Render.
- No release, production configuration change or WhatsApp message was performed. Public endpoint availability alone does not verify the deployed code revision or Cloudinary integration.

## Remaining completion steps
1. Restore deployment-dashboard access and confirm the backend uses commit acb2907 or later and the documented Render runtime settings.
2. Privately configure/confirm all three CLOUDINARY variables in Render for the intended product environment. Local credentials already work; do not paste secrets into the report or commit them.
3. Use a generated bill with an existing linked patient and submitted report results. Prepare and download an invoice and report, check association/content, A4 orientation and visual layout, and confirm stored PdfAsset metadata and restricted Cloudinary assets.
4. Recheck deployment storage retrieval with its own clock and fail-closed behavior. Sending messages remains outside this verification.

## Evidence
- reports/cloudinary-live-verification.json
- reports/deployment-live-verification.json
- verification/cloudinary-live-check.cjs (synthetic-only upload, restricted retrieval, access checks and cleanup)
- verification/deployment-live-check.cjs (login, bill read and prepare only; no send endpoint)
