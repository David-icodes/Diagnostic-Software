# Anjali Diagnostics — Diagnostic Centre / Laboratory Information System (LIS)

A full Diagnostic Centre / Laboratory Information System, built from scratch in phases. This repository currently contains **Phase 0 (project foundation)**, **Phase 1 (login + protected dashboard)**, **Phase 2.1 (Patients foundation)**, **Phase 2.2 (OSP Lab Billing + Department/Test foundation)**, **Phase 2.3 (Lab navigation restructure + Cancel Lab Bill + Collect Lab Dues)**, **Phase 2.4 (Lab billing UI sheets + Modify Lab Bill + Vendor-Client Lab Bill)**, **Phase 2.5 (Sample Collections + Parameter Based Test Results + Lab Reprint)**, **Phase 3 (Reports — all 11 reports built: Generated Lab Bills, Lab Summary, OSP Patient Registration, Referral Doctor Commission, Lab Collection Summary, Client Lab Generated Bills, Outside Sent LabTest Details, Dues, Cancelled Bills, Bill-wise Collection, Hospital Price Card)**, **Phase 4.1 (Database modules — Create Doctor, Doctor Specialisation, Doctor Designation, New Address, New Department, Create Package)** and **Phase 4.2 (Lab Master screens — Create New Lab Test, New Lab Test Parameter, Lab Tariffs, Dr & Dept Wise Commission Mapping, Client Wise Lab Tariffs)**.

> Demo/dummy data is used throughout; patient data is limited to a few demo records. **No real patient data.**

---

## Technology Stack

| Layer    | Technology |
| -------- | ---------- |
| Frontend | Next.js (App Router, `src/`), React, TypeScript, Tailwind CSS v4, shadcn/ui (Radix), Lucide React, React Hook Form, Zod, TanStack Query |
| Backend  | Node.js, Express.js, TypeScript |
| Database | MongoDB, Mongoose |
| Media    | Cloudinary (reserved for future phases — logos, signatures, organization assets) |

## Folder Structure

```
diagnostic-lis/
├── frontend/                  Next.js application
│   └── src/
│       ├── app/               routes: /login, /dashboard, /patients(/new, /[id]), /billing/osp(/new, /[id]),
│       │                       /laboratory/billing(/cancel, /collect-dues, /modify, /vendor-client),
│       │                       /laboratory/test-result(/sample-collections, /parameter-based-test-results,
│       │                       /lab-reprint), /reports/generated-lab-bills, /reports/lab-summary,
│       │                       /reports/osp-registration, /reports/referral-doctor-commission,
│       │                       /reports/lab-collection-summary, /reports/client-generated-lab-bills,
│       │                       /reports/outside-sent-lab-tests, /reports/due-bills, /reports/cancelled-bills,
│       │                       /reports/bills-wise-collection, /reports/hospital-price-card,
│       │                       /database/doctor(/create, /specialisation, /designation),
│       │                       /database/address/new, /database/department/new, /database/package/create,
│       │                       /laboratory/master(/create-lab-test, /lab-test-parameter, /lab-tariffs,
│       │                       /doctor-commission-mapping, /client-lab-tariffs) (+ proxy)
│       ├── components/
│       │   ├── layout/        Header, Sidebar (incl. Database → DOCTOR / COMMON / LAB MASTER groups), DashboardLayout
│       │   ├── dashboard/     cards, tables, panels, DashboardContent
│       │   ├── billing/       OSP bill form/view, cancel lab bill, collect lab dues, modify, vendor-client, bill header/action bar, pickers
│       │   ├── test-result/   sample collections, parameter based test results, lab reprint
│       │   ├── lab/           lab master screens (create lab test, lab test parameter, lab tariffs,
│       │   │                   doctor commission mapping, client lab tariffs) + shared lab-actions
│       │       ├── reports/       reusable report components + the 11 implemented reports (each: toolbar, filters, table, print sheet)
│       │   ├── database/      shared database components (PageHeader, FormField, FormSection, FormActions, DataTable,
│       │   │                   SearchInput, StatusBadge, ConfirmDialog) + the 6 module screens + MasterContent
│       │   ├── patients/      patient form, list, profile
│       │   ├── auth/          login page + form
│       │   ├── common/        LoadingState, EmptyState, ErrorState
│       │   ├── ui/            shadcn/ui primitives (Select, Textarea, Dialog, ...)
│       │   └── providers/     TanStack Query provider
│       ├── services/          typed API service functions
│       ├── hooks/             useAuth (session context)
│       ├── lib/               API client, app config
│       ├── types/             shared TypeScript types
│       └── validations/       Zod schemas (auth, patient, billing, test-result)
│
├── backend/                   Express API
│   └── src/
│       ├── config/            environment (zod) + MongoDB connection
│       ├── models/            User, Patient, Counter, AuditLog, Department, LabTest, Doctor, LabBill, LabBillPayment,
│       │                       LabSample, LabTestParameter, LabTestResult, LabTechnician, LabClient,
│       │                       DoctorCommission, LabClientTariff
│   ├── middleware/        authenticate, requirePermission, validate, notFound, errorHandler
│       ├── modules/
│       │   ├── auth/          login / logout / me
│       │   ├── dashboard/     summary / today-bills / due-bills (demo data)
│       │   ├── patients/      patient CRUD (create / list / get / update)
│       │   ├── departments/   department catalog (create / list / get / update, activate/deactivate, `type` field)
│       │   ├── lab-tests/     lab test catalog (create / list / get / update)
│       │   ├── doctors/       referring doctor registry (search / create / update / list / activate/deactivate, full registration)
│       │   ├── lab-bills/     OSP bill creation / list / get / cancel / due-collection / modify (server-side pricing)
│       │   ├── lab-test-parameters/  test parameter master (per-test parameter rows, GENDER_WISE reference ranges,
│       │   │                   result types/modes, active toggles, distinct sample/subtitle options)
│       │   ├── lab-tariffs/    lab tariff master (OP tariff per test, bulk set/override, tier-wise unset)
│       │   ├── commission-mappings/  doctor + department commission master (assign/overwrite per test)
│       │   ├── client-tariffs/ client-wise tariff master (per-client test price override)
│       │   ├── lab-clients/   vendor-account client registry
│       │   ├── lab-samples/   sample list (lazy creation) + status transition (collection workflow)
│       │   ├── test-results/  parameters / results / submit (versioned result entry)
│       │   ├── lab-technicians/ technician registry (result signatures)
│       │   ├── doctor-specialisations/  specialisation master (case-insensitive unique, active toggles)
│       │   ├── doctor-designations/     designation master (case-insensitive unique, active toggles)
│       │   ├── locations/     hierarchical Country → State → District → City master (cascading creates, active toggles)
│       │   ├── packages/      lab test package master (Lab type, amount + ins amount, composed tests, no name uniqueness)
│       │   ├── database-options/  shared dropdown constants (`GET /database/options`)
│       │       ├── reports/      Generated Lab Bills + Lab Summary + OSP Patient Registration + Referral Doctor Commission
│       │       │                  + Lab Collection Summary + Client Generated Lab Bills + Outside Sent LabTest Details
│       │       │                  + Due Bills + Cancelled Bills + Bill-wise Collection + Hospital Price Card
│       │       │                  (controllers/services/routes/validations/types per report)
│       │   └── audit/         minimal audit service
│       ├── routes/            v1 API router
│       ├── services/          (reserved for future service layer)
│       ├── scripts/           seedAdmin.ts, seedDemoPatients.ts, seedLabCatalog.ts, seedDatabase.ts
│       ├── utils/             ApiError, asyncHandler, jwt, http, id-generator, object-id, require-user-id
│       └── server.ts
│
├── docs/
│   └── project-roadmap.md     future phases (documented, NOT implemented)
├── .gitignore
├── package.json               root scripts (run both servers together)
└── README.md
```

## Prerequisites

- Node.js **20+** (tested on 24)
- npm
- MongoDB running locally on `127.0.0.1:27017` (or a MongoDB Atlas connection string)

## Backend Setup

```bash
cd backend
npm install
copy .env.example .env    # then edit values (JWT_SECRET, MONGODB_URI, ...)
```

Environment variables (see `backend/.env.example`):

| Variable        | Purpose                                  |
| --------------- | ---------------------------------------- |
| `PORT`          | API port (default `5000`)                |
| `MONGODB_URI`   | MongoDB connection string                |
| `JWT_SECRET`    | Secret for signing auth tokens (≥16 chars) |
| `JWT_EXPIRES_IN`| Token lifetime (default `7d`)            |
| `COOKIE_NAME`   | HTTP-only session cookie name            |
| `FRONTEND_URL`  | Allowed CORS origin (the Next.js URL)    |
| `ADMIN_*`       | Used only by the seed script             |

Create the initial administrator account:

```bash
npm run seed
```

Seed a few demo patient records (for the Patients module):

```bash
npm run seed:patients
```

Seed the demo lab catalog (departments, tests, doctors, test parameters, lab technicians, doctor commissions, outside labs + sent samples + referring-doctor demo bills — for OSP Billing, Test Results and the Reports):

```bash
npm run seed:lab
```

Seed demo OSP / Vendor bills with partial payments and cancellations (demo data for the Due Bills, Cancelled Bills and Bill-wise Collection reports; uses `DEMO` bill-number prefix and is fully idempotent — re-running only backfills what is missing):

```bash
npm run seed:bills
```

Seed the Database (LIS) master data — doctor specialisations, doctor designations, locations (Country/State/District/City), departments, the 6 FEVER PROFILE tests and the 14 packages (incl. two `VITAMIN PROFILE` rows) — fully idempotent:

```bash
npm run seed:db
```

Start the development server:

```bash
npm run dev        # http://localhost:5000
```

## Frontend Setup

```bash
cd frontend
npm install
copy .env.example .env.local    # NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
npm run dev                    # http://localhost:3000
```

## Running Both Together (from the project root)

```bash
npm install        # installs root dev tooling (concurrently)
npm run dev        # starts backend + frontend
```

## Demo Login

After `npm run seed` (defaults from `.env`):

```
Username: admin
Password: Admin@123
```

## Authentication Flow

1. User opens `/login`.
2. Credentials are sent to `POST /api/v1/auth/login`.
3. Backend verifies password (bcrypt) and sets a signed JWT in an **HTTP-only cookie**.
4. User is redirected to `/dashboard`.
5. Next.js proxy (`src/proxy.ts`) protects `/dashboard`, `/billing`, `/laboratory`, `/reports` and `/database` optimistically; the real session is verified via `GET /api/v1/auth/me`.
6. `POST /api/v1/auth/logout` clears the cookie and returns to `/login`.

Sensitive credentials are never stored in `localStorage`; passwords are never stored in plaintext.

## API Endpoints

| Method | Endpoint                      | Auth | Description                        |
| ------ | ----------------------------- | ---- | ---------------------------------- |
| GET    | `/api/v1/health`              | No   | Health check                       |
| POST   | `/api/v1/auth/login`          | No   | Login (sets HTTP-only cookie)      |
| POST   | `/api/v1/auth/logout`         | No   | Logout (clears cookie)             |
| GET    | `/api/v1/auth/me`             | Yes  | Current user                       |
| GET    | `/api/v1/dashboard/summary`   | Yes  | Demo summary (13 / 5 / 8)          |
| GET    | `/api/v1/dashboard/today-bills` | Yes | Demo bills table                   |
| GET    | `/api/v1/dashboard/due-bills` | Yes  | Demo due bills (empty in Phase 1)  |
| GET    | `/api/v1/patients`            | Yes  | List/search patients (paged)       |
| POST   | `/api/v1/patients`            | Yes  | Create patient (server-side ID)    |
| GET    | `/api/v1/patients/:id`        | Yes  | Get patient (by ID or Patient ID)  |
| PUT    | `/api/v1/patients/:id`        | Yes  | Update patient                     |
| GET    | `/api/v1/departments`         | Yes  | List departments (with test counts)|
| POST   | `/api/v1/departments`         | Yes  | Create department                  |
| GET    | `/api/v1/departments/:id`     | Yes  | Get department                     |
| PUT    | `/api/v1/departments/:id`     | Yes  | Update department                  |
| GET    | `/api/v1/lab-tests`           | Yes  | List tests (`departmentId`, `search`, `status`, paged) |
| POST   | `/api/v1/lab-tests`           | Yes  | Create lab test                    |
| GET    | `/api/v1/lab-tests/:id`       | Yes  | Get lab test                       |
| PUT    | `/api/v1/lab-tests/:id`       | Yes  | Update lab test                    |
| PATCH  | `/api/v1/lab-tests/:id/activate|deactivate` | Yes | Enable/disable a lab test (referenced by an active package ⇒ 422) |
| GET    | `/api/v1/lab-tests/specimen-options` | Yes | Distinct sample types + container names across tests |
| GET    | `/api/v1/lab-test-parameters` | Yes  | List test parameters (`departmentId`, `testId`, `mode=parameter|template`, paged) |
| POST   | `/api/v1/lab-test-parameters` | Yes  | Create test parameter (unique test+name; GENERAL or GENDER_WISE reference) |
| PUT    | `/api/v1/lab-test-parameters/:id` | Yes | Update test parameter (details + gender reference ranges; subtitles kept distinct) |
| PATCH  | `/api/v1/lab-test-parameters/:id/activate|deactivate` | Yes | Enable/disable a test parameter |
| GET    | `/api/v1/lab-test-parameters/subtitles` | Yes | Distinct parameter subtitles (options for the parameter picker) |
| GET    | `/api/v1/lab-tariffs`         | Yes  | List department test OP tariffs (paged) |
| PUT    | `/api/v1/lab-tariffs/bulk`    | Yes  | Bulk set OP tariff per test (`overwrite` controls existing rows; omitted tier key unsets it) |
| GET    | `/api/v1/commission-mappings` | Yes  | Commission mapping rows + all department tests (assignability state) |
| PUT    | `/api/v1/commission-mappings` | Yes  | Assign/overwrite department+doctor commission per test |
| GET    | `/api/v1/client-tariffs`      | Yes  | Client tariff rows + all tests (client-name filter) |
| PUT    | `/api/v1/client-tariffs`      | Yes  | Apply/overwrite client-wise test price tariff |
| GET    | `/api/v1/doctors`             | Yes  | Search referring doctors           |
| POST   | `/api/v1/doctors`             | Yes  | Create referring doctor (legacy quick-create `name/qualification/specialization/mobile` still supported; full registration via name parts) |
| GET    | `/api/v1/doctors/list`        | Yes  | Paginated doctor list (`search`, `status`, `page`, `limit`) |
| GET    | `/api/v1/doctors/:id`         | Yes  | Get referring doctor               |
| PUT    | `/api/v1/doctors/:id`         | Yes  | Update referring doctor (name recomputed from merged name parts) |
| PATCH  | `/api/v1/doctors/:id/activate|deactivate` | Yes | Enable/disable a doctor (`database.doctor.write`; referenced doctors cannot be deactivated) |
| GET    | `/api/v1/database/options`    | Yes  | Shared dropdown constants (department types, package types, doctor types, genders, Y/N; `database.view`) |
| GET    | `/api/v1/database/doctor-specialisations` | Yes | Specialisation list (paged, searchable; `database.specialisation.read`) |
| POST   | `/api/v1/database/doctor-specialisations` | Yes | Create specialisation (case-insensitive unique; `database.specialisation.write`) |
| PUT/PATCH | `/api/v1/database/doctor-specialisations/:id(/activate|deactivate)` | Yes | Update / enable or disable a specialisation |
| GET    | `/api/v1/database/doctor-designations` | Yes | Designation list (paged, searchable; `database.designation.read`) |
| POST   | `/api/v1/database/doctor-designations` | Yes | Create designation (case-insensitive unique; `database.designation.write`) |
| PUT/PATCH | `/api/v1/database/doctor-designations/:id(/activate|deactivate)` | Yes | Update / enable or disable a designation |
| GET    | `/api/v1/database/locations`  | Yes  | Location list by `type` (country/state/district/city) + `parentId`/`active` (`database.location.read`) |
| POST   | `/api/v1/database/locations`  | Yes  | Create a location (parent must match previous level; `database.location.write`) |
| PUT/PATCH | `/api/v1/database/locations/:id(/activate|deactivate)` | Yes | Rename / enable or disable a location |
| PATCH  | `/api/v1/departments/:id/activate\|deactivate` | Yes | Enable/disable a department (`database.department.write`; referenced departments cannot be deactivated) |
| GET    | `/api/v1/database/packages`   | Yes  | Package list (paged, searchable; `database.package.read`) |
| POST   | `/api/v1/database/packages`   | Yes  | Create package (`name` may repeat, `packageType` = Lab, `amount`, `insAmount`, `items` [{testId, departmentId}]; `database.package.write`) |
| GET    | `/api/v1/database/packages/:id` | Yes | Get package with populated item test/department names |
| PUT    | `/api/v1/database/packages/:id` | Yes | Update package (items validated unique by test) |
| PATCH  | `/api/v1/database/packages/:id/activate|deactivate` | Yes | Enable/disable a package |
| GET    | `/api/v1/lab-bills`           | Yes  | List bills (`status`, `search`, `billType`, `fromDate`/`toDate`, paged) |
| POST   | `/api/v1/lab-bills`           | Yes  | Create bill (draft or generated; `osp` or `vendor` type) |
| GET    | `/api/v1/lab-bills/:id`       | Yes  | Get bill (populated patient + doctor) |
| GET    | `/api/v1/lab-bills/due`       | Yes  | Due bills (`fromDate`/`toDate`/`patientId`/`patientName`/`billNumber`, paged) |
| GET    | `/api/v1/lab-bills/by-bill-number/:billNumber` | Yes | Get bill by bill number (populated) |
| POST   | `/api/v1/lab-bills/:id/cancel` | Yes  | Cancel bill (remarks required; admin/staff) |
| POST   | `/api/v1/lab-bills/:id/collect-due` | Yes | Record a due-collection payment (admin/staff) |
| PUT    | `/api/v1/lab-bills/:id`       | Yes  | Modify bill (draft/unpaid only; admin/staff) |
| GET    | `/api/v1/lab-clients`         | Yes  | Search/list vendor-account clients |
| POST   | `/api/v1/lab-clients`         | Yes  | Create vendor-account client |
| GET    | `/api/v1/lab-clients/:id`     | Yes  | Get client |
| PUT    | `/api/v1/lab-clients/:id`     | Yes  | Update client |
| GET    | `/api/v1/lab-samples`         | Yes  | Samples (`mode=today\|criteria`, filters; lazy-create per bill+test) |
| PATCH  | `/api/v1/lab-samples/:id/status` | Yes | Sample status transition (validated map; admin/staff) |
| GET    | `/api/v1/lab-test-results/test-parameters` | Yes | Parameters for a test (`testId`) |
| GET    | `/api/v1/lab-test-results/results` | Yes | Results for a bill+test (`billId`, `testId`) |
| POST   | `/api/v1/lab-test-results/results/submit` | Yes | Submit/re-submit results (versioned, no silent overwrite; admin/staff) |
| GET    | `/api/v1/lab-technicians`     | Yes  | List lab technicians (result signatures) |
| GET    | `/api/v1/reports/generated-lab-bills` | Yes | Generated Lab Bills report (filters, paged, totals; admin/staff) |
| GET    | `/api/v1/reports/lab-summary` | Yes | Lab Summary report (date range, department/test/type/bill no filters, derived Lab/Approval status, "Only Delayed" flag; admin/staff) |
| GET    | `/api/v1/reports/osp-registration` | Yes | OSP Patient Registration report (date range, gender, mobile, name, bill type; admin/staff) |
| GET    | `/api/v1/reports/referral-doctor-commission` | Yes | Referral Doctor Commission report (doctor/department/test filters, `commissionBasis`, `amountBasis`; admin/staff) |
| GET    | `/api/v1/reports/lab-collection-summary` | Yes | Lab Collection Summary report (lab income vs expenses by date range; admin/staff) |
| GET    | `/api/v1/reports/client-generated-lab-bills` | Yes | Client Generated Lab Bills report (vendor bills, client/doctor filters, `orderBy`; admin/staff) |
| GET    | `/api/v1/reports/outside-sent-lab-tests` | Yes | Outside Sent LabTest Details report (date range, outside-lab filter; admin/staff) |
| GET    | `/api/v1/reports/outside-labs` | Yes | Outside-lab catalog options for the report filter (`outside_sent` permission) |
| GET    | `/api/v1/reports/options` | Yes | Shared report filter options — bill types, pay modes, active users, price-card dropdowns (`reports.view` permission) |
| GET    | `/api/v1/reports/due-bills` | Yes | Due Bills report (date range, patient ID, Collected By multi-select; `reports.dues`) |
| GET    | `/api/v1/reports/cancelled-bills` | Yes | Cancelled Bills report (Summary/Detailed mode, date range, bill type/pay mode/cancelled-by multi-selects; `reports.cancelled_bills`) |
| GET    | `/api/v1/reports/bills-wise-collection` | Yes | Bill-wise Collection report (per-payment ledger from `LabBillPayment`; date range, patient ID, orderBy, patient types, withCancelled, bill type/collected-by/pay-mode multi-selects; `reports.bill_collection`) |
| GET    | `/api/v1/reports/hospital-price-card` | Yes | Hospital Price Card report (service type, department, lab name, status; OP amount from `LabTest.price`, IP/ER tariffs `—`; `reports.price_card`) |

### Patient API notes

- Patient IDs (`GP2026XXXXX`) are generated **server-side** by the Counter collection via an atomic `$inc` — concurrency-safe, and ignored if a client tries to send one.
- `fullName` is computed automatically from first + last name.
- List endpoint supports `?page=`, `?limit=`, `?search=` (Patient ID / name / mobile) and `?status=`, returning `{ success, data, pagination }`.
- There is intentionally **no delete endpoint** in this phase.

### Lab Bill API notes

- Bill numbers (`OSP2026XXXXX`) are generated **server-side** through the same Counter pattern — concurrency-safe (verified with parallel creates).
- The client only sends `{ testId, quantity }` per item; **the server looks up each test's price** and snapshots `testCode/testName/department/price` so historical bills keep their original prices even after a catalog price change.
- Server computes `totalAmount → discountAmount → netAmount → paidAmount → dueAmount` and rejects `paid > net`, `discount > 100%`, empty item lists, inactive/nonexistent tests and inactive patients.
- Status: `draft` (Save Draft) or `generated` (Generate Bill); a `generated` bill becomes `cancelled` via `POST /:id/cancel` (requires a reason; the record is never deleted) — see Phase 2.3.
- **Cancellation** (`post /lab-bills/:id/cancel`): remarks required (validation), double-cancel rejected (`409`), cancelled bills are excluded from the dues list and cannot receive payments (`422`); `cancelledAt`/`cancelledBy`/`cancellationRemarks` are recorded.
- **Due collection** (`post /lab-bills/:id/collect-due`): only on `generated` bills with an outstanding balance and for an amount ≤ the balance; each collection is stored as a `LabBillPayment` row and updates `paidAmount`/`dueAmount` (initial payment at creation is also recorded as a payment row).
- **Permissions**: `admin`/`staff` get cancel + collect-due; `operator` is limited to viewing and creating bills (`requirePermission` middleware).
- Departments/tests are **never hardcoded** in the billing UI — they are read from the catalog endpoints.

## Current Phase

- **Phase 0 — Project initialization:** completed
- **Phase 1 — Login + Dashboard:** completed (UI review pending)
- **Phase 2 — Patient Management:** foundation started (see below)

### Phase 2.1 — Patients foundation ✅

- Patient model (Patient ID, demographics, contacts, address, status) + `Counter` + minimal `AuditLog`.
- Concurrency-safe Patient ID generation (`GP202600001`-style).
- Backend: `POST/GET /api/v1/patients`, `GET/PUT /api/v1/patients/:id` with search + pagination.
- Frontend: `/patients` list (search + pagination), `/patients/new` registration form, `/patients/[id]` profile with inline edit.
- Sidebar **Patients** navigation enabled.
- Demo records via `npm run seed:patients` (Ravi Kumar, Priya Sharma, Demo Patient, ...).
- Ahead: patient documents, history, dashboard — see `docs/project-roadmap.md`.

### Phase 2.2 — OSP Lab Billing + Department/Test foundation ✅

- **Department** model + CRUD (list includes active-test counts, sort order & status filter) — departments are database-driven, never hardcoded in the UI.
- **LabTest** catalog (testCode, department, sample/container, price, `resultMode`, active flag) with search / status / pagination.
- **Doctor** abstraction (minimal registry — search + create only; no full Doctor Management module yet).
- **LabBill** model + API: Counter-based bill numbers (`OSP202600001`), item price snapshots, server-side pricing/discount/payment math with strict validation, `draft` / `generated` statuses.
- Frontend `/billing/osp/new`: patient picker (search + inline registration), referring-doctor picker (search + add), database-driven **three-panel test selector** (departments → tests → selected), payment/discount section (RHF + Zod), live totals card, `[Clear] [Save Draft] [Generate Bill]` actions.
- Frontend `/billing/osp/[id]`: read-only generated-bill view (patient, doctor, itemized tests, totals, payment mode, print).
- Dashboard **New OSP Bill** action card wired to the form; Next.js proxy now guards `/billing` as well as `/dashboard`.
- Demo catalog via `npm run seed:lab` (9 departments, 18 tests, 2 doctors).
- Deliberately **excluded** from this phase: sample collection, result entry, reports, PDF/email/WhatsApp, bill cancellation, refunds, due collection.

### Phase 2.3 — Lab navigation + Cancel Lab Bill + Collect Lab Dues ✅

- **Navigation restructure**: sidebar no longer shows a standalone **Patients** item; all lab features are grouped under **LABORATORY → LAB BILL** (OSP Lab Bill, Cancel Lab Bill, Collect Lab Dues, Modify Lab Bill, Vendor-Client Lab Bill) and **LABORATORY → TEST RESULT** (Sample Collections*, Parameter Based Test Results*, Lab Reprint*). Only the `TEST RESULT` items remain placeholders (`*`) showing a "Coming Soon" notice; Patients/Reports/Database pages remain reachable. In collapsed desktop mode, clicking the Laboratory group un-collapses the sidebar.
- **Cancel Lab Bill** (`/laboratory/billing/cancel`): look up any bill by bill number (with patient/doctor strip auto-filled), then cancel it with a mandatory cancellation reason. Already-cancelled bills show a banner and cannot be re-cancelled; cancelled records are never deleted and are excluded from dues.
- **Collect Lab Dues** (`/laboratory/billing/collect-dues`): search today's dues / by criteria (dates, patient), or directly by bill no; select a bill to see balance, enter amount/mode/comments with a live new-balance preview, and record the collection. Overpayments are rejected; cancelled/full-paid bills are excluded.
- Backend foundations for both: `LabBill` cancellation fields, `LabBillPayment` model, due-list / cancel / collect-due endpoints, and a `requirePermission` middleware (admin/staff can cancel/collect; operator is view+create only).
- Dashboard **Due Collection** action card wired to `/laboratory/billing/collect-dues`; the OSP bill view now shows a **Cancelled** badge + cancellation banner/printer disabled for cancelled bills.

### Phase 2.4 — Lab billing UI sheets + Modify Lab Bill + Vendor-Client Lab Bill ✅

- **Cancel Lab Bill** polished to the sheet layout: inline `Enter Bill Number :` search with `[Show]`, an always-visible **9-column** bill table (`Bill No / OP/IP/ER/GP ID / Lab Test Name / Test Amount / Test Date / Discount / Net Amount / Paid / Balance`) with a `No bill found.` empty state, `Cancellation Remarks`, and centered `[Cancel Bill] [Clear] [Home]` actions; cancelled bills render a banner and disable the cancel action.
- **Investigations Collect Dues** reworked to the sheet layout: radio filter **To days Dues / Criteria / Bill No**, date + patient search fields with `[Search] [Clear]`, an always-visible **8-column** dues table (`No Records To Display` empty row + `Total` footer), a secondary **Name / Amount / Bill Date** items table for the selected bill, and a payment section of LEFT **Payment Mode** / MIDDLE **Comments** / RIGHT **Total Amount**, **Enter Discount (Rs.)**, **Net Amount**, **Paying Amount**, with bottom `[Submit] [Clear] [Home]`. Additional per-collection discount (`discountAmount` on `LabBillPayment`) is validated server-side against the outstanding balance and the payable is recomputed; net/due totals update accordingly.
- **Modify Lab Bill** (`/laboratory/billing/modify`): top-right bill search + fullscreen toggle, selectable bill list (`Select / Bill No / Bill Date / Pat Id / Ref Id / Pat Name / Gender / Age / Mobile No / Pat Type`), and a three-panel editor — **Departments** (searchable) → **Lab Tests** (searchable, `>>` transfer) → **Existed Lab Tests** table (`Delete / Dept Name / Lab Test Name / Amount / Qty / Total` with qty steppers). Payment Mode, Comments, and a **Display comments in Bill** checkbox sit below; the right column shows **Total Amount / Enter Discount : % / Discount ₹ / Net Amount / Paid Amount / Balance Amount**. Submit calls the new `PUT /lab-bills/:id` (permission `billing.modify`): items are re-snapshotted and re-priced server-side; cancelled and already-paid (`generated`, `paidAmount > 0`) bills are rejected; an audit entry `lab_bill.modified` is written.
- **Vendor-Client Lab Bill** (`/laboratory/billing/vendor-client`): same structure as the OSP form plus a database-driven **Client picker**; bills are created with `billType: "vendor"` (numbers `VCB2026XXXXX`), require an active client, and store `clientId`/`clientName`. Client-specific tariffs are **not** implemented yet (catalog prices apply).
- Backend additions: `LabClient` model + `/api/v1/lab-clients` (search/list/create/update with `VC2026XXXXX`-style client codes) registered in the API router; `LabBill.billType` + `clientId`/`clientName`; seeded demo clients (run `npm run seed:lab` again).
- Frontend shared components: `BillPageHeader`, `BillActionBar` (`[Submit] [Clear] [Home]`), and `ClientPicker` (search dialog).

### Phase 2.5 — Sample Collections + Parameter Based Test Results + Lab Reprint ✅

- **Sample Collections** (`/laboratory/test-result/sample-collections`, title **Lab Sample Collection Status**): status legend (🟩 Collected / 🟪 Received / 🟦 Processed / 🟨 Recollected / 🟥 Rejected / Not updated), `Today Lab Bills` / `Criteria` radio filter (bill date range, bill no, patient id/name), and the always-visible 12-column table `S.No | Bill No | Bill Date | Patient Id | Patient Name | Department | Test Name | Test Status | Sample Status | Time | Comments | Action` with a per-row status dropdown + time + comments + **Save**; row background tinted by status. Backend `GET /lab-samples` lazily creates a sample row per bill+test on first list (IDs `SMP2026XXXXXX`), returns `sampleStatus` + derived `testStatus` (OPEN/CLOSED) and filters by today/criteria server-side. `PATCH /lab-samples/:id/status` enforces the sample lifecycle (Collected → Received → Processed, plus Recollected/Rejected via a strict allowed-transition map) with 422 on illegal jumps, records the matching timestamp (`collectedAt`/`receivedAt`/`processedAt`/`recollectedAt`/`rejectedAt`) + an **HH:MM** optional time, and pushes a status history entry.
- **Parameter Based Test Results** (`/laboratory/test-result/parameter-based-test-results`, title **Enter Test Result**): selectable bill table (`Bill No | Pat Id | Pat Name | Sex/Age | Bill Date`), radio today/criteria + **☑ Include Client Bills**, tests table (`Print | Dept Name | Test Name | Sample | Out | Lab Center`) with per-test print checkboxes and a ✓ "Out" once the test is CLOSED, the **Select Signature to print** technician dropdown, and a parameter table (`Order | Parameter Name | Result | Units | Reference Range | Method`) whose Result inputs are type-aware (plain text / number for NUMBER & RANGE / checkbox for BOOLEAN / dropdown for SELECT). Existing result values are pre-filled; `Submit / Clear / Home` at the bottom. Backend `POST /lab-test-results/results/submit` upserts per (billId, testId, parameterId), validates the value against the parameter `resultType` and that the test belongs to the bill, and versioning: first write → `version: 1`, later writes push the previous document into `revisions` and increment `version` (changes are never silently overwritten).
- **Lab Reprint** (`/laboratory/test-result/lab-reprint`): bill list + its tests, signature selector, and `Submit / Clear / Home / Print / Send Mail / Send Whatsapp`. Print opens the browser print dialog for a dedicated print-only report preview (the UI itself is hidden with `print:hidden`); Send Mail / Send Whatsapp are safe demo placeholders with an explanatory notice (no real dispatch yet).
- Backend models: `LabSample` (sampleId, bill+test unique, status + timestamps + history), `LabTestParameter` (unique test+name, `resultType` TEXT/NUMBER/BOOLEAN/SELECT/RANGE, unit, referenceRange, method, options, displayOrder), `LabTestResult` (unique bill+test+parameter, result, version + revisions), `LabTechnician`; validations `updateSampleStatusSchema` (`TIME_24H_REGEX`) + `submitResultsSchema`; `lab-technicians` endpoint; `listLabBills` gained `fromDate`/`toDate`/`billType`; seed catalog extended with demo parameters (CBC 7 / Lipid 3 / FBS / ALT / AST / T.Bilirubin / Creatinine / Urine Routine) + two demo technicians (run `npm run seed:lab` again).
- Permissions: `admin`/`staff` = `sample.view`+`sample.update`, `test_results.view`+`test_results.enter`+`test_results.update`, `reports.print`; `operator` is view-only (sample list, results view) and gets **403** on status PATCH / result submit.

The `TEST RESULT` sidebar items are now wired to the three pages above.

See [`docs/project-roadmap.md`](docs/project-roadmap.md) for future phases. They are documented only — **not implemented**.

### Phase 3 — Reports ✅ (all 11 Reports implemented)

The sidebar gains a top-level **REPORTS** category with 11 items: **Generated Lab Bills**, Lab Summary Report, OSP Patient Registration Report, Referral Doctor Commission, Lab Collection Summary, Client Generated Lab Bills, Outside Sent LabTest Details, Dues, Cancelled Bills, Bill-wise Collection and Hospital Price Card. All 11 reports are implemented.

- **Backend** (`backend/src/modules/reports/` — `controllers/`, `services/`, `routes/`, `validations/`, `types/`, `utils/`): a new `GET` endpoint per report plus shared filter options via `GET /reports/options` (bill types, pay modes, active users, price-card dropdowns). All share `utils/report-core.ts` — `dayRange()` builds an inclusive from/exclusive to+1 day range (`{$gte,$lt}`), CSV query values (`departmentIds=ID1,ID2`) are split via `splitCsv()`, and `slicePage()` provides paged results; `export=1` bypasses pagination and returns up to `EXPORT_LIMIT=1000` rows so the printed/exported report carries the whole filtered result. Financial values always come from the **item price snapshots** on each bill — old bills are never re-priced with today's catalog prices.
- **Lab Summary Report** (`GET /reports/lab-summary`): OSP tests grouped by department (group headers + group totals) across a bill-date range. Filters: date range, comma-separated `departmentIds`/`testIds`, `patientTypes` (gp/op/ip/er), bill number, derived `labStatus` (OPEN/CLOSED), `approvalStatus` (PENDING/APPROVED), `delayedTat=1`. **Lab Status / Approval Status are derived** — CLOSED/APPROVED means results have been entered for that bill+test, OPEN/PENDING means none (basis documented via `meta.labStatusBasis`/`approvalStatusBasis`); **Delayed** = report date ≥ 24 h (`DELAYED_TAT_HOURS`) after bill date without results. Totals: bill count + total amount.
- **OSP Patient Registration Report** (`GET /reports/osp-registration`): patient registrations by date range with `gender`, `mobile`, `name` and `billType` filters. Printed sheet header is **GP Patients Report**. Totals: patient/bill count + bill amount.
- **Referral Doctor Commission** (`GET /reports/referral-doctor-commission`): per-bill commission rows with `doctorIds`/`departmentIds`/`testIds`/`patientId`/`patientTypes` filters, `commissionBasis = referral | cons_op_ip` (referral ⇒ OSP bills only; cons_op_ip ⇒ OP+IP bills only) and `amountBasis = net | paid`. Commission uses the configured `DoctorCommission` rate with a **resolution order test → department → doctor default**; a missing rate is flagged (`configMissing`) and shown as *missing*, never silently 0%. **Claim Type** currently supports only `all`. Printed sheet title is **Lab - Dr Referral - Bill wise**.
- **Lab Collection Summary** (`GET /reports/lab-collection-summary`): lab income vs expenses by date range. **Expenses are 0** surfaced via `meta.expensesUnavailable` + a displayed note (no expense module exists yet). Printed sheet title is **Lab Income And Expense**.
- **Client Generated Lab Bills** (`GET /reports/client-generated-lab-bills`): **vendor** bills separated from OSP billing, with `clientIds`, `referringDoctorId` and `orderBy = date_asc | date_desc`. Totals: bill count + total/discount/net/paid/due.
- **Outside Sent LabTest Details** (`GET /reports/outside-sent-lab-tests` + `GET /reports/outside-labs`): tests whose samples were marked **sent out** to an outside lab (`LabSample.outsideLabId`/`sentOutAt`), filtered by date range + `outsideLabIds`. Total Amount for a row is the **originating bill-item charge snapshot** (the charge at bill time, not a per-outside-lab price).
- **Dues** (`GET /reports/due-bills`, `/reports/due-bills`): generated bills with `dueAmount > 0`, filtered by date range + patient ID + Collected By (searchable multi-select of active users). "Collected By" = the latest payment's collector name from `LabBillPayment`. Totals row: Bills / Amount / Discount / Net / Paid / Balance.
- **Cancelled Bills** (`GET /reports/cancelled-bills`, `/reports/cancelled-bills`): cancellation history with **Summary / Detailed** mode toggle; filters date range + Bill Type + Pay Mode + Cancelled By. Detailed adds Bill Type + test names; remarks shown. Cancellation from `LabBill.cancelledAt/cancelledBy/cancellationRemarks`.
- **Bill-wise Collection** (`GET /reports/bills-wise-collection`, `/reports/bills-wise-collection`): per-payment ledger from `LabBillPayment` (one row per payment event). Filters: date range, Patient ID, Sort Order, Patient Type (GP/OP/IP/ER), With Cancelled Bills, Bill Type / Collected By / Pay Mode multi-selects. Mode breakdown columns (Cash / UPI / Card / Bank Transfer / Other) from `PAYMENT_MODES`; cancelled excluded unless `withCancelled=1`.
- **Hospital Price Card** (`GET /reports/hospital-price-card`, `/reports/hospital-price-card`): lab test price list. Filters Service Type (default `lab-test`), Select Department, Select Lab Name (main lab), Status (Active/Inactive/All). OP Amt = `LabTest.price`; IP / Ins IP / ER / Ins ER have no tariff source yet and render `—` with a `meta.tariffsUnavailable` note (no fabricated tariffs).
- **Permissions**: every report endpoint sits behind `authenticate` + `requirePermission` with a per-report permission (`reports.generated_bills`, `reports.lab_summary`, `reports.osp_registration`, `reports.doctor_commission`, `reports.collection`, `reports.client_bills`, `reports.outside_sent`, `reports.dues`, `reports.cancelled_bills`, `reports.bill_collection`, `reports.price_card`); granted to `admin`/`staff` only — `operator` gets **403** on all reports (verified).
- **Frontend** (one page per report under `/reports/<slug>`, all proxy-guarded): shared building blocks in `frontend/src/components/reports/` — `ReportToolbar` (`First/Prev/Next/Last`, **Find** + next-match with matching row count + **Refresh**), `ReportFilterBar` (`[Show][Clear] + Home` action row), `ReportSelectionPanel` (search + Select All/checked multi-select for report filters, driven by option endpoints), `ReportTable` (generic, typed columns, totals footer, strong-row highlighting for Find), `ReportSummary` (backend totals card), `ReportPagination`, `ReportDateRange`/`ReportSearchInput`/`ReportSelect`, plus `ReportPrintSheet` (`hidden print:block` sheet with the org header and the report's printed title) and `report-export.ts` (CSV download with UTF-8 BOM naming each file by report + date range). Each page shows the toolbar, filter bar, result table with footer totals and the print/CSV/refresh actions; **Print** opens the browser print dialog (`print:hidden` UI + print-only sheet pattern shared with Lab Reprint), **Export** downloads the full filtered CSV.

### Phase 4.1 — Database (LIS master data) modules ✅

The **DATABASE** sidebar category (`Database → DOCTOR / COMMON / LAB MASTER`) now drives the eleven master-data screens, backed by new permission-gated endpoints (`database.view` + per-module `database.{doctor,specialisation,designation,location,department,package}.{read,write}` and `lab_master.{test,parameter,tariff,commission,client_tariff}.{read,write}`, granted to `admin`/`staff`; `operator` gets 403 — verified).

- **Create Doctor** (`/database/doctor/create`): full registration form — Doctor Type, Employee ID, First/Middle/Last Name (required), Short Name, Gender, Qualification, Mobile/Phone/Email/City/Address, Specialisation, Designation, Doctor Department, Online App. Display (Y/N), Room Number, OP/IP/Hospital/ER consultation fees and Max Free Visits / Max Free Days Visits; `name` is computed server-side from the name parts. The billing doctor-picker's legacy quick-create (`name/qualification/specialization/mobile`) still works. `/doctors/list` paginated table with search, edit (pre-filled form) and activate/deactivate (referenced doctors are protected via `DoctorCommission`/`LabBill`).
- **Doctor Specialisation** (`/database/doctor/specialisation`) and **Doctor Designation** (`/database/doctor/designation`): case-insensitive-unique masters (shared `MasterContent` screen — form + S.No/Name/Status/Action table with edit and activate/deactivate; referenced records cannot be deactivated).
- **New Address** (`/database/address/new`): cascading Country → State → District → City selects with inline "Add new" inputs; Save walks the chain and creates only the missing levels (auto-parenting with the previous level's id). Address table renders every full chain (Country/State/District/City) with edit-rename and activate/deactivate.
- **New Department** (`/database/department/new`): Department Type dropdown (`Lab & X-Ray`, Service, Doctors, Pharmacy, Stores, Inventory, CRM), Name, Short Name (code), Sort Order, Description; list shows Code / Department / Type / Sort Order / Status / Action with client search + status filter + edit + activate/deactivate (referenced departments protected via `LabTest`).
- **Create Package** (`/database/package/create`): three-panel layout — **Package Details** (Name, Package Type `Lab`, Package Amount, Package Amount In), **Select Tests** (Department → Test → Add), **Selected Tests** (removable list + Clear All) — plus Save/Clear/Home and the package table (`S.No | Package Name | Package Type | Amount | Ins Amount | Edit`). Edit loads the full saved package (name, amounts and all composed tests) back into the form. Package names are intentionally **not unique**: the seed records `VITAMIN PROFILE` twice as separate rows, and `FEVER PROFILE` carries exactly 6 seeded tests (Hematology/CBP, Biochemistry/ESR, Microbiology/Widal, Hematology/Malaria, Biochemistry/CRP, Pathology/Urine) — verified via API.
- **Configuration**: dropdown constants centralised in `backend/src/constants/master-data.ts` and served via `GET /database/options`. `npm run seed:db` (`backend/src/scripts/seedDatabase.ts`) idempotently seeds 7 specialisations, 5 designations, 10 locations, 4 departments, the 6 FEVER PROFILE tests and the **14 packages** (with the user-specified amounts, incl. `MASTER PROFILE3` 2500/7500 and `MASTER PROFILE-4` 3000/7000) using stable `seedKey`s so duplicate-name records seed reliably and re-runs backfill only.

### Phase 4.2 — Lab Master screens ✅

The **DATABASE → LAB MASTER** sidebar group adds the five laboratory-master screens (moved here from the old **LABORATORY → MASTER** group — the Laboratory section's LAB BILL / TEST RESULT items are unchanged), backed by permission-gated endpoints (`lab_master.view` + per-module `lab_master.{test,parameter,tariff,commission,client_tariff}.{read,write}`; `operator` gets 403 — verified). All five pages follow the sheet layout (light blue-grey app background + white working area, thin borders, compact aligned field rows, `S.No / Dept / Test / Test Code / OP / IP / Status / View / Edit / Delete`-style tables with `[Submit] [Update] [Home] [Clear]` actions) and keep their original route URLs (`/laboratory/master/*`).

- **Create New Lab Test** (`/laboratory/master/create-lab-test`): Department, Test Name, Test Code (required, ≥2 chars, auto-uppercased server-side), Short Name (required), Sample Name + Tube Container (free-form inputs fed by distinct `GET /lab-tests/specimen-options`), Price (OP amount, `LabTest.price`), and a radio-tabbed result-mode picker — *Direct Value* (DIRECT_VALUE) / *Parameter Based Result* (PARAMETER_BASED) / *Template Based Result* (TEMPLATE_BASED). The list shows active/inactive tests with per-row View (read-only detail), Edit (pre-filled form; omitted tier keys are preserved on update) and Delete (soft-deactivate; blocked with 422 when an active package references the test).
- **New Lab Test Parameter** (`/laboratory/master/lab-test-parameter`): select Department → Test, then add/remove parameter rows in one **Submit** table — S.No / Parameter Name (unique per test, required) / Unit / Method / Subtitle (optional, kept distinct; values reused via a `subtitles` datalist) / Result Type (Normal/Derived/Calculated) / Result Mode (Single Value / Select / Multiple Options). **Reference Range** depends on reference type — *GENERAL* shows one range (Lower / Upper / Range Type), *GENDER_WISE* expands Male + Female rows (Lower / Upper each; e.g. Hb M 13–17 / F 12–15). The parameter table lists existing rows (S.No / Name / Type / Subtitle / Reference Range / Status / Action) with full edit (re-fills the gender ranges) and activate/deactivate.
- **Lab Tariffs** (`/laboratory/master/lab-tariffs`): department test table (S.No / Department / Test / Test Code / OP Price) with per-row **Set Option** dropdown (IP/General/ER — the OP price is edited on the test itself) and an **OP ₹** input; a **Bulk Options** row lets you set multiple entries at once and **Copy The Above Tariff Set** to replicate the first entry's values — existing rows without overwrite consent are rejected with a backend 409 and the screen asks for confirmation before retrying with `overwrite`. Tier prices are stored on the `LabTest` document (`ipPrice/generalPrice/erPrice`); row removal clears the tier.
- **Dr & Dept Wise Commission Mapping** (`/laboratory/master/doctor-commission-mapping`): pick Department + Doctor, then the drill-down **All Tests / Configured / Not Configured** tab driven by `GET /commission-mappings` (full department test list with per-test `commissionPercent` / `amount` / `configured`); a **Set commission % / ✓ Checked** bulk selector covers selected tests, and per-row **Add** to set a single test's % and amount. Assigning tests that don't belong to the selected department is rejected (409) — the mapping requires department membership. Edit via **Click To edit** re-fills the row.
- **Client Wise Lab Tariffs** (`/laboratory/master/client-lab-tariffs`): pick a Client, then assign a client-specific **₹ price** per department test; applying a tariff for a client+test that already has one requires overwrite consent (409 gate retried with `overwrite`). Rows show `Department / Test / Test Code / Client Price` with per-row delete. Vendor billing can later pick up these prices instead of the catalog price.
- **Backend**: new models `DoctorCommission` (doctor+department+test commission; fixed amount wins over % at test scope) and `LabClientTariff` (client+test tariff), module routers under `/api/v1` with the validation rules above, and the `parameterReferenceTypes` values (`GENERAL`, `GENDER_WISE`) fixed in `GET /database/options` to return plain strings. `npm run seed:lab` seeds demo `DoctorCommission` rows (Dr. Anil Mehta doctor-level 10%, etc.); client tariff rows are created from the **Client Wise Lab Tariffs** screen.
- **Frontend**: shared primitives added — `components/ui/checkbox.tsx`, `components/common/segmented-control.tsx`, `components/common/addable-datalist.tsx`; `types/lab-masters.ts` + `services/lab-masters.ts` (typed payloads/rows for every endpoint above); `components/lab/lab-actions.tsx` (`[Submit] [Update] [Home] [Clear]`); each page under `src/app/laboratory/master/<screen>/page.tsx`.

### Lab Sample / Test Result API notes

- Sample numbers (`SMP2026XXXXXX`) are generated **server-side** via the same Counter pattern used for patients/bills.
- Sample status transitions are validated by an explicit allowed map — the server rejects illegal jumps (e.g. `collected → collected`, `processed → collected`) with `422`.
- Result submission is idempotent per (billId, testId, parameterId): re-submitting the same values updates in place but bumps `version` and keeps the previous value in `revisions` (auditable history).
- The backend is authoritative for both features — the UI previews are cosmetic; the transition/result/permission logic enforced by the API.

## Labs / Results walkthrough

1. Create a generated bill for a test with seeded parameters (e.g. CBC — HEM001).
2. `Sample Collections` — today's samples appear (created on first fetch); move a sample from `Collected` → `Received` → `Processed` (each with an optional time/comments, saved per row).
3. `Parameter Based Test Results` — select the bill + test, enter values per parameter (pre-filled if already entered), pick a signature technician, **Submit**.
4. `Lab Reprint` — reselect the bill/test, then **Print** (browser print dialog shows the report-only preview) or try the demo **Send Mail / Send Whatsapp** buttons.