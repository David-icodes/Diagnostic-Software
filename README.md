# Anjali Diagnostics — Diagnostic Centre / Laboratory Information System (LIS)

A full Diagnostic Centre / Laboratory Information System, built from scratch in phases. This repository currently contains **Phase 0 (project foundation)** and **Phase 1 (login + protected dashboard)** only.

> Demo/dummy data is used throughout Phase 1. **No real patient data.**

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
│       ├── app/               routes: /login, /dashboard (+ proxy)
│       ├── components/
│       │   ├── layout/        Header, Sidebar, DashboardLayout
│       │   ├── dashboard/     cards, tables, panels, DashboardContent
│       │   ├── auth/          login page + form
│       │   ├── common/        LoadingState, EmptyState, ErrorState
│       │   └── providers/     TanStack Query provider
│       ├── services/          typed API service functions
│       ├── hooks/             useAuth (session context)
│       ├── lib/               API client, app config
│       ├── types/             shared TypeScript types
│       └── validations/       Zod schemas
│
├── backend/                   Express API
│   └── src/
│       ├── config/            environment (zod) + MongoDB connection
│       ├── models/            User model
│       ├── middleware/        authenticate, validate, notFound, errorHandler
│       ├── modules/
│       │   ├── auth/          login / logout / me
│       │   └── dashboard/     summary / today-bills / due-bills (demo data)
│       ├── routes/            v1 API router
│       ├── services/          (reserved for future service layer)
│       ├── scripts/           seedAdmin.ts
│       ├── utils/             ApiError, asyncHandler, jwt, http helpers
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
5. Next.js proxy (`src/proxy.ts`) protects `/dashboard` optimistically; the real session is verified via `GET /api/v1/auth/me`.
6. `POST /api/v1/auth/logout` clears the cookie and returns to `/login`.

Sensitive credentials are never stored in `localStorage`; passwords are never stored in plaintext.

## API Endpoints (Phase 1)

| Method | Endpoint                      | Auth | Description                        |
| ------ | ----------------------------- | ---- | ---------------------------------- |
| GET    | `/api/v1/health`              | No   | Health check                       |
| POST   | `/api/v1/auth/login`          | No   | Login (sets HTTP-only cookie)      |
| POST   | `/api/v1/auth/logout`         | No   | Logout (clears cookie)             |
| GET    | `/api/v1/auth/me`             | Yes  | Current user                       |
| GET    | `/api/v1/dashboard/summary`   | Yes  | Demo summary (13 / 5 / 8)          |
| GET    | `/api/v1/dashboard/today-bills` | Yes | Demo bills table                   |
| GET    | `/api/v1/dashboard/due-bills` | Yes  | Demo due bills (empty in Phase 1)  |

## Current Phase

- **Phase 0 — Project initialization:** completed
- **Phase 1 — Login + Dashboard:** completed (UI review pending)

See [`docs/project-roadmap.md`](docs/project-roadmap.md) for future phases. They are documented only — **not implemented**.