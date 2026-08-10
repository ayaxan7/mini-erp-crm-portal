# Mini ERP + CRM Operations Portal

A full-stack internal operations tool that combines a lightweight **CRM** (customers,
follow-ups) with **ERP** functionality (products, live inventory, stock movements and
sales challans) under role-based access.

- **Backend** — Node.js 20+, Express 5, TypeScript, PostgreSQL 14, dependency injection,
  transactional business rules, Zod validation. `backend/`
- **Frontend** — React 19, TypeScript, Vite, custom design system (no UI library),
  role-aware UI. `frontend/`
- **Tests** — Vitest + Supertest against a disposable test database (57 tests).

---

## Features

| Area | What you get |
| --- | --- |
| **Authentication** | **Firebase Auth** (email/password + Google). The backend verifies Firebase ID tokens via the Admin SDK, auto-provisions new users as view-only `ACCOUNTS`, and admins grant roles in-app. First user becomes `ADMIN`. |
| **Roles** | `ADMIN`, `SALES`, `WAREHOUSE`, `ACCOUNTS`. Every write endpoint is role-checked server-side; the UI hides what a role cannot do. |
| **Customers (CRM)** | CRUD, search + type/status filters, pagination, scheduled follow-up date, full follow-up timeline with notes. |
| **Products (ERP)** | CRUD with unique SKU, opening stock, min-stock low-stock flag, category and storage location. |
| **Stock movements** | Adjust stock IN/OUT with a reason; every change is logged with who/when/reference; full movement history per product. |
| **Sales challans** | Draft/confirm/cancel. Confirming **deducts stock atomically** (row locks + transaction); cancelling a confirmed challan restocks it. Line items store product **snapshots** (name, SKU, unit price) so history survives price/rename changes. |
| **Dashboard** | Stat cards, 6-month challan trend, recent challans, low-stock alerts. |

---

## Tech stack

- **Runtime:** Node.js 20+, Express 5, TypeScript 5
- **Database:** PostgreSQL 14, `pg` driver, raw SQL, enums + unique lower-case indexes
- **Validation:** Zod (shared schemas for body/query/params)
- **Auth:** Firebase Auth + `firebase-admin` (no self-managed passwords or JWT secrets)
- **Tests:** Vitest + Supertest
- **Frontend:** React 18, React Router 7, Vite
- **Hosting configs:** `render.yaml` (backend), `vercel.json` (frontend), GitHub Actions CI

---

## Repository layout

```
backend/
  src/
    config/        env, db pool + Queryable (transaction-friendly), date parser
    db/            schema.sql, seed, setup/reset script
    middleware/    auth (requireAuth/requireRole), error handler, validation
    repositories/  raw SQL per table, receive a Queryable so they work in transactions
    services/      business logic + DI wiring, challan transaction orchestration
    controllers/   thin HTTP layer
    routes/        express routers (factory functions)
    validation/    zod schemas
    utils/         ApiError, asyncHandler, pagination helpers
    app.ts         composition root (DI)
    server.ts      bootstrap + graceful shutdown
  tests/           6 test files, global setup, helpers (seed + reset fixtures)
docs/              API reference, deployment guide, Postman collection
frontend/          React + Vite SPA (design system, pages, API client)
render.yaml        deploy config (backend, optional Postgres)
vercel.json        deploy config (frontend)
```

---

## Getting started

### Prerequisites

- Node.js 20+ (`node -v`)
- PostgreSQL 14+ running locally (`pg_isready`)
- npm 10+

### 1. Configure Firebase (one-time)

1. Create a project in the [Firebase Console](https://console.firebase.google.com).
2. Enable **Email/Password** and (optionally) **Google** under
   Authentication → Sign-in method.
3. Add a **Web app** (Project settings → Your apps) and copy its `apiKey`, `authDomain`,
   `projectId`, `appId`.
4. Generate a **service account key** (Project settings → Service accounts → Generate
   new private key). This is the Server SDK credential the backend uses to verify ID
   tokens. Treat it as a secret — never commit it.

### 2. Configure the backend

```bash
cd backend
cp .env.example .env
# edit .env — set DATABASE_URL, TEST_DATABASE_URL, FIREBASE_CREDENTIALS_PATH, FRONTEND_URL
```

Required variables:

| Variable | Example | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://localhost:5432/crm_dev` | Main database |
| `TEST_DATABASE_URL` | `postgres://localhost:5432/crm_test` | Used only by the test suite |
| `FIREBASE_CREDENTIALS_PATH` | `.firebase/meridian-erp-firebase-adminsdk.json` | Service-account JSON for the Admin SDK (path or inline `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`) |
| `FRONTEND_URL` | `http://localhost:5173` | CORS allow-list (comma-separated, spaces ok) |
| `PORT` | `4000` | API port |

> Note: port **5000** is avoided because macOS AirPlay/Control Center owns it.

### 3. Prepare the databases

```bash
# Creates the databases if missing, applies schema, and seeds dev data (customers/products)
npm run db:setup
# Reset (drop + recreate) whenever you want a clean slate
npm run db:reset
```

There are **no seeded logins** — users come from Firebase. The first person who signs
in (email/password or Google) is auto-promoted to `ADMIN`; everyone else starts
view-only (`ACCOUNTS`) until an admin grants a role on the **Users** page.

The dev seed adds 8 customers and 8 products with opening-stock movements.

### 4. Run the backend

```bash
npm run dev        # tsx watch, port 4000
```

### 5. Run the frontend

```bash
cd ../frontend
cp .env.example .env
# edit .env — set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID
npm install
npm run dev        # Vite on :5173, proxies /auth /customers /products /stock /challans /dashboard /health to :4000
```

Open http://localhost:5173 and sign in — or create an account. The first sign-in
bootstraps the admin user.

### Other scripts

```bash
npm run typecheck  # backend: tsc --noEmit
npm run build      # backend: compile to dist/
npm run test       # backend: full test suite (needs a reachable test DB)
```

---

## Commands & scripts

| Command | Where | What |
| --- | --- | --- |
| `npm run db:setup` | backend | Create DBs + schema + seed |
| `npm run db:reset` | backend | Drop & recreate + reseed |
| `npm run dev` | backend / frontend | Dev servers (API :4000, SPA :5173) |
| `npm run test` | backend | 57 tests, disposable `crm_test` DB |
| `npm run build` / `typecheck` | backend, frontend | Compile + typecheck |

---

## Authentication & roles

### How it works

1. The frontend signs the user in with **Firebase Auth** (email/password or Google).
2. It fetches an ID token (`getIdToken()`) and stores it (`localStorage crm.token`),
   attaching `Authorization: Bearer <token>` on every request.
3. The backend verifies the token with the **Firebase Admin SDK** and maps the user to
   a local row (`firebase_uid`). Unknown users are auto-provisioned: the **first user
   becomes `ADMIN`**, everyone else starts view-only (`ACCOUNTS`).
4. `requireAuth` verifies the token; `requireRole('SALES')` etc. gates endpoints.
5. A 401 on any request dispatches `crm:unauthorized`, which signs the user out of
   Firebase and redirects to `/login`.
6. Admins grant roles from the in-app **Users** page (`GET /auth/users`,
   `PATCH /auth/users/:id/role`). Changing your own role is blocked.

### Permission matrix (enforced server-side)

| Capability | ADMIN | SALES | WAREHOUSE | ACCOUNTS |
| --- | :-: | :-: | :-: | :-: |
| View dashboard / lists / details | ✓ | ✓ | ✓ | ✓ |
| Manage customers + follow-ups | ✓ | ✓ | – | – |
| Manage products + adjust stock | ✓ | – | ✓ | – |
| Create / confirm / cancel challans | ✓ | ✓ | – | – |

---

## API overview

Base URL (local): `http://localhost:4000`

| Method | Endpoint | Description | Roles |
| --- | --- | --- | --- |
| `GET` | `/auth/me` | Current user (provisions new users on first call) | all |
| `GET` | `/auth/users` | List portal users (search/paginate) | ADMIN |
| `PATCH` | `/auth/users/:id/role` | Grant/change a role | ADMIN |
| `GET` | `/health` | Health check | public |
| `GET/POST` | `/customers` | List (search/filter/paginate) / create | all / ADMIN,SALES |
| `GET/PATCH` | `/customers/:id` | Detail / update | all / ADMIN,SALES |
| `GET/POST` | `/customers/:id/followups` | Follow-up history / add | all / ADMIN,SALES |
| `GET/POST` | `/products` | List (search/low-stock) / create | all / ADMIN,WAREHOUSE |
| `GET/PATCH` | `/products/:id` | Detail / update | all / ADMIN,WAREHOUSE |
| `POST` | `/products/:id/stock` | Stock IN/OUT with reason | ADMIN,WAREHOUSE |
| `GET` | `/products/:id/movements` | Movement history | all |
| `GET` | `/stock/movements` | All movements (pagination) | all |
| `GET/POST` | `/challans` | List (status/customer/search) / create (draft) | all / ADMIN,SALES |
| `GET` | `/challans/:id` | Detail with snapshot items | all |
| `PATCH` | `/challans/:id/confirm` | Confirm → atomic stock deduction | ADMIN,SALES |
| `PATCH` | `/challans/:id/cancel` | Cancel → restock if confirmed | ADMIN,SALES |
| `GET` | `/dashboard/summary` | Dashboard stats | all |

### Response envelope

Every endpoint returns `{ success, data?, message?, errors? }`. Lists add `meta`
(`page`, `limit`, `total`, `totalPages`). Errors carry an HTTP status plus a
human-readable `message`, and validation failures include `errors: [{ field, message }]`.

Full request/response examples, SRP `docs/api.md`, and a ready-to-import
**Postman collection** live in `docs/`.

---

## Business rules worth knowing

- **Challan confirmation is atomic.** Within one DB transaction the products are
  locked `SELECT … FOR UPDATE`, availability is validated, stock is deducted, movement
  rows (`OUT`, reference type `CHALLAN`) are written, and the challan is set to
  `CONFIRMED`. Any failure rolls everything back.
- **Cancel semantics.** A `DRAFT` challan can be cancelled without touching stock; a
  `CONFIRMED` challan is restocked with an `IN` movement noting `Sales Challan Cancelled`.
- **Snapshots.** Each challan item stores the product name, SKU and unit price at the
  time of creation, so historical challans never change if products are later renamed
  or re-priced.
- **Unique SKUs case-insensitively** (unique index on `lower(sku)`).
- **Low stock** is derived (`current_stock < min_stock` or `min_stock = 0` with 0 units).

---

## Running the tests

```bash
cd backend
npm run test        # 57 tests across auth, customers, products, stock, challans, roles
npm run test:watch  # interactive
```

The suite automatically creates/refreshes isolation in a separate `crm_test` database
(never touches `crm_dev`), seeds fixtures, and resets between files.

---

## Live environment / deployment

A full, copy-paste guided walkthrough for PostgreSQL provisioning (**Neon**),
**backend on Render** and **frontend on Vercel** is in `docs/deployment.md`. Deploy
yaml for Render and Vercel are included at the repo root.

---

## Roadmap / future work

- Invoice generation from confirmed challans (accounts role)
- Multi-tenant workspaces
- CSV export for customers/products/movements
- Email/SMS reminders for overdue follow-ups