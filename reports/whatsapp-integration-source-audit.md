# WhatsApp integration source audit — 9 October 2026

## Result

Implementation stopped at the user's required configuration check. No application code, environment configuration, database records, or existing WhatsApp behavior was changed. No WhatsApp messages were sent. The temporary read-only inspection script was removed.

## Existing template compatibility

- `frontend/src/components/test-result/lab-reprint.tsx` calls the existing WhatsApp service with `templateName: "report_ready"` and `languageCode: "en"`.
- That caller supplies no components or PDF attachment. Its actual payload and behavior must remain unchanged; the new document templates are separate additions.
- `frontend/src/services/whatsapp.ts` uses `/api/whatsapp/test-message`.
- `backend/src/modules/whatsapp/whatsapp-send.service.ts` sends the template through the configured Meta phone-number endpoint. Existing sender, routes, webhook, and message model were left untouched.

## Exact new template languages cannot be determined

No language configuration was found for `lab_report_ready`, `lab_invoice_ready`, or `patient_thank_you`.

The backend's loaded local configuration reports these values absent:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_WABA_ID`
- `WHATSAPP_PHONE_NUMBER_ID`

Without the configured access token and WABA ID, the exact template language, status, and component definitions cannot be retrieved from Meta. The phone-number ID is also needed for sending. No language was guessed, and the existing `report_ready` language was not reused for the new templates. This finding concerns the inspected local configuration; it does not establish what is configured in a separate deployment.

## Centre source investigation

A read-only inventory of the configured MongoDB database returned:

`auditlogs`, `counters`, `departments`, `doctorcommissions`, `doctordesignations`, `doctors`, `doctorspecialisations`, `labbillpayments`, `labbills`, `labclients`, `labclienttariffs`, `labpackages`, `labreportuploads`, `labsamples`, `labtechnicians`, `labtestparameters`, `labtestresults`, `labtests`, `locations`, `outsidelabs`, `patients`, `users`, `whatsappmessages`.

No diagnostic-centre, organisation, or settings master collection was found in that inventory or the application's model/API definitions.

The actual existing diagnostic-centre branding source is `frontend/src/config/organisation.ts`, which reads `NEXT_PUBLIC_ORG_*` deployment settings with existing report-branding fallbacks. It is not a database-backed list of centres.

- `outsidelabs` represents external referral laboratories.
- `labclients` represents client/vendor organisations.
- `locations` represents country/state/district/city geography.

None was silently substituted for a diagnostic-centre master. No selector or duplicate master was created.

## Required before continuing

1. Configure the existing backend Meta credentials privately so template metadata can be retrieved for the three exact new template names. Do not paste access tokens into chat.
2. Identify an existing authoritative diagnostic-centre record source if it resides elsewhere. The inspected database has no such master; using deployment branding instead would require a clarified requirement, because it cannot supply the requested database-backed centre selector.

## Validation

Read-only code/configuration inspection and MongoDB collection inventory completed. No implementation changes were made, so lint, TypeScript, build, and functional tests were not rerun for this audit.
