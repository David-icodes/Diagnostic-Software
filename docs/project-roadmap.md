# Project Roadmap — Anjali Diagnostics LIS

This document describes future phases. **Nothing below is implemented yet** unless explicitly marked. Each phase will be developed, reviewed and approved incrementally.

Legend: ✅ done &nbsp; 🔜 planned (not implemented)

## Phase 0 — Project Initialization ✅
- Monorepo structure (`frontend/`, `backend/`, `docs/`), Git, `.gitignore`, env examples.

## Phase 1 — Authentication + Dashboard ✅
- Login (`/login`), protected dashboard (`/dashboard`), header, collapsible sidebar, stat/action cards, Today's Bills & Today's Due Bills (demo data).
- Backend: Express + Mongoose, User model, bcrypt + JWT in an HTTP-only cookie, `auth` + demo `dashboard` endpoints.

## Phase 2 — Patient Management 🔜
- Patient registration/profile model, patient search & listing, patient dashboard, patient documents, history.
- API: `/api/v1/patients/*`.

## Phase 3 — Laboratory / Tests 🔜
- Lab test catalog, test parameters, reference ranges, packages, test-wise patient registration, sample types/containers.
- API: `/api/v1/lab/*`, `/api/v1/tests/*`.

## Phase 4 — Billing 🔜
- Bill creation (New OSP Bill, Due Collection), payments, credit/due tracking, invoice number generation (`DIAG2026-...`), receipts.
- Connect dashboard cards & tables to real data (`/api/v1/dashboard/*`).

## Phase 5 — Sample Collection & Barcode 🔜
- Sample registration, collection counters, barcode generation/printing, sample tracking.

## Phase 6 — Result Entry & Calculations 🔜
- Result entry per test/parameter, auto-calculations, flags, remarks.

## Phase 7 — Report Generation & Distribution 🔜
- Doctor verification/sign-off, report preview, PDF generation, print, email, WhatsApp delivery.

## Phase 8 — Referrals / Doctor Commission 🔜
- Referring doctor registry, commission tracking & settlement.

## Phase 9 — Admin & Settings 🔜
- Organization settings (name, logo, support phone), user management, roles, audit logs.
- Header/sidebar branding to be driven by backend settings instead of the current `frontend/src/lib/app-config.ts` demo values.

## Phase 10 — Cloudinary Integration 🔜
- Upload & management of organization logo, user avatars, doctor/pathologist signatures, other media.
- Architecture placeholder already in place (avatar/logo fallbacks are used today).

## Phase 11 — Analytics & Reporting 🔜
- Revenue, tests, collections dashboards, exports.

---

### Notes
- Phase 1 dashboard values are **demo data** and will be swapped for real queries in later phases.
- Models for Patient, LabTest, Result, Report, Billing, Sample are intentionally **not created yet**.