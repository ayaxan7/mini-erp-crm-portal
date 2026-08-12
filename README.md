# Mini ERP + CRM Operations Portal

A full-stack internal operations tool that combines a lightweight **CRM** (customers,
follow-ups) with **ERP** functionality (products, live inventory, stock movements and
sales challans) under role-based access.

- **Backend** — Node.js 20+, Express 5, TypeScript, PostgreSQL 14, dependency injection,
  transactional business rules, Zod validation. `backend/`
- **Frontend** — React 18, TypeScript, Vite, custom design system (no UI library),
  role-aware UI. `frontend/`
- **Tests** — Vitest + Supertest against a disposable test database (54 tests).

> Live demo and links:
>
> - **Repository:** https://github.com/ayaxan7/mini-erp-crm-portal
> - **Frontend:** https://meridian.smayaan.me
> - **API base URL:** https://meridian.smayaan.me/api (served through the frontend's
>   nginx; the backend container itself binds to port 4000 on the EC2 VM and is not
>   exposed directly to the internet).

---

## Features

| Area | What you get |
| --- | --- |
| **Authentication** | Login with JWT (8h expiry), session restore via `/auth/me`, route guards on both API and UI. |
| **Roles** | `ADMIN`, `SALES`, `WAREHOUSE`, `ACCOUNTS`. Every write endpoint is role-checked server-side; the UI hides what a role cannot do. |
| **Customers (CRM)** | CRUD, search + type/status filters, pagination, scheduled follow-up date, full follow-up timeline with notes. |
| **Products (ERP)** | CRUD with unique SKU, opening stock, min-stock low-stock flag, category and storage location. Optional **product image** — uploaded to AWS S3 when configured, local disk otherwise. |
| **Stock movements** | Adjust stock IN/OUT with a reason; every change is logged with who/when/reference; full movement history per product. |
| **Sales challans** | Draft/confirm/cancel. Confirming **deducts stock atomically** (row locks + transaction); cancelling a confirmed challan restocks it. Line items store product **snapshots** (name, SKU, unit price) so history survives price/rename changes. |
| **Invoice (PDF)** | Any challan exports a branded HTML/EJS **invoice** and a **PDF** (puppeteer-core + system Chromium) with customer billing/shipping blocks, GST line and grand total. |
| **Dashboard** | Stat cards, 6-month challan trend, recent challans, low-stock alerts. |
| **Docker + EC2** | Multi-stage Dockerfiles and a single `docker-compose.yml` for dev and prod; GitHub Actions builds images to GHCR; deploy to EC2 with `docker compose up -d`. |

---

## Tech stack

- **Runtime:** Node.js 20+, Express 5, TypeScript 5
- **Database:** PostgreSQL 14, `pg` driver, raw SQL, enums + unique lower-case indexes
- **Validation:** Zod (shared schemas for body/query/params)
- **Auth:** `jsonwebtoken` + `bcryptjs`
- **Invoices:** EJS templates + `puppeteer-core` (system Chromium)
- **Images:** `multer` uploads + AWS SDK v3 S3 (local-disk fallback)
- **Tests:** Vitest + Supertest
- **Frontend:** React 18, React Router 7, Vite
- **Hosting configs:** `render.yaml` (backend), `vercel.json` (frontend), Docker/`docker-compose.yml` (EC2), GitHub Actions CI + image build

---

## Repository layout

```
backend/
  src/
    config/        env, db pool + Queryable (transaction-friendly), date parser
    db/            schema.sql, seed, setup/reset script
    middleware/    auth (requireAuth/requireRole), error handler, validation, upload (multer)
    repositories/  raw SQL per table, receive a Queryable so they work in transactions
    services/      business logic + DI wiring, challan transaction orchestration
    controllers/   thin HTTP layer
    routes/        express routers (factory functions)
    validation/    zod schemas
    views/         EJS invoice template
    utils/         ApiError, asyncHandler, pagination helpers
    app.ts         composition root (DI)
    server.ts      bootstrap + graceful shutdown
  tests/           6 test files, global setup, helpers (seed + reset fixtures)
docs/              API reference, deployment guide, Postman collection
frontend/          React + Vite SPA (design system, pages, API client)
docker-compose.yml single compose file (dev + prod profiles)
render.yaml        deploy config (backend, optional Postgres)
vercel.json        deploy config (frontend)
```

---

## Getting started

### Prerequisites

- Node.js 20+ (`node -v`)
- PostgreSQL 14+ running locally (`pg_isready`)
- npm 10+

### 1. Configure the backend

```bash
cd backend
cp .env.example .env
# edit .env — set DATABASE_URL, TEST_DATABASE_URL, JWT_SECRET, FRONTEND_URL
```

Required variables:

| Variable | Example | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://localhost:5432/crm_dev` | Main database |
| `TEST_DATABASE_URL` | `postgres://localhost:5432/crm_test` | Used only by the test suite |
| `JWT_SECRET` | long random string | Signs auth tokens — never commit the real value |
| `JWT_EXPIRES_IN` | `8h` | Token lifetime |
| `FRONTEND_URL` | `http://localhost:5173` | CORS allow-list (comma-separated, spaces ok) |
| `PORT` | `4000` | API port |

Optional (product images):

| Variable | Example | Purpose |
| --- | --- | --- |
| `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `S3_BUCKET` | `us-east-1` / … | Set all four to upload images to S3; if any is empty, uploads go to `backend/uploads` (served at `/uploads`) |

Optional (PDF invoices):

| Variable | Example | Purpose |
| --- | --- | --- |
| `PUPPETEER_EXECUTABLE_PATH` | `/usr/bin/chromium` | Chrome/Chromium binary for `puppeteer-core`; only needed for `invoice.pdf` (auto-set in the Docker image) |

> Note: port **5000** is avoided because macOS AirPlay/Control Center owns it.

### 2. Prepare the databases

```bash
# Creates the databases if missing, applies schema, and seeds dev data
npm run db:setup
# Reset (drop + recreate) whenever you want a clean slate
npm run db:reset
```

Seed accounts (all passwords end in `@123`):

| Role | Email |
| --- | --- |
| Admin | `admin@crmportal.dev` |
| Sales | `sales@crmportal.dev` |
| Warehouse | `warehouse@crmportal.dev` |
| Accounts | `accounts@crmportal.dev` |

The dev seed also adds 8 customers and 8 products with opening-stock movements.

### 3. Run the backend

```bash
npm run dev        # tsx watch, port 4000
```

### 4. Run the frontend

```bash
cd ../frontend
npm install
npm run dev        # Vite on :5173, proxies /auth /customers /products /stock /challans /dashboard /uploads /health to the API
```

Open http://localhost:5173 and sign in with one of the seed accounts.

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
| `npm run test` | backend | 54 tests, disposable `crm_test` DB |
| `npm run build` / `typecheck` | backend, frontend | Compile + typecheck |

---

## Authentication & roles

### How it works

1. `POST /auth/login` returns a JWT and the user profile.
2. The frontend stores the token (`localStorage crm.token`) and attaches
   `Authorization: Bearer <token>` on every request.
3. `requireAuth` verifies the token; `requireRole('SALES')` etc. gates endpoints.
4. A 401 on any request dispatches `crm:unauthorized`, which clears the session and
   redirects to `/login`.

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
| `POST` | `/auth/login` | Sign in → `{ token, user }` | public |
| `GET` | `/auth/me` | Current user from token | all |
| `GET` | `/health` | Health check | public |
| `GET/POST` | `/customers` | List (search/filter/paginate) / create | all / ADMIN,SALES |
| `GET/PATCH` | `/customers/:id` | Detail / update | all / ADMIN,SALES |
| `GET/POST` | `/customers/:id/followups` | Follow-up history / add | all / ADMIN,SALES |
| `GET/POST` | `/products` | List (search/low-stock) / create | all / ADMIN,WAREHOUSE |
| `GET/PATCH` | `/products/:id` | Detail / update | all / ADMIN,WAREHOUSE |
| `POST` | `/products/:id/image` | Upload a product image (`multipart/form-data`, field `image`) | ADMIN,WAREHOUSE |
| `POST` | `/products/:id/stock` | Stock IN/OUT with reason | ADMIN,WAREHOUSE |
| `GET` | `/products/:id/movements` | Movement history | all |
| `GET` | `/stock/movements` | All movements (pagination) | all |
| `GET/POST` | `/challans` | List (status/customer/search) / create (draft) | all / ADMIN,SALES |
| `GET` | `/challans/:id` | Detail with snapshot items | all |
| `GET` | `/challans/:id/invoice` | Branded HTML invoice | ADMIN,SALES |
| `GET` | `/challans/:id/invoice.pdf` | PDF export of the invoice | ADMIN,SALES |
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
npm run test        # 54 tests across auth, customers, products, stock, challans, roles
npm run test:watch  # interactive
```

The suite automatically creates/refreshes isolation in a separate `crm_test` database
(never touches `crm_dev`), seeds fixtures, and resets between files.

---

## Live environment / deployment

A full, copy-paste guided walkthrough for PostgreSQL provisioning (**Neon**) and the
frontend/backend platforms is in `docs/deployment.md`. The repo also ships:

- **Docker** — multi-stage `backend/Dockerfile` and `frontend/Dockerfile`, plus a **single
  `docker-compose.yml`** that runs both dev and production:

  ```bash
  # Development (hot reload + local Postgres on :5432)
  docker compose --profile dev up --build     # API :4000 + SPA :5173

  # Production (uses the DATABASE_URL you provide in .env)
  docker compose --profile prod up -d --build # API :4000 + nginx :80
  ```

- **EC2** — the production compose services are what you run on an EC2 VM (see
  `docs/deployment.md` §Docker & EC2).
- **GitHub Actions** — `ci.yml` runs typecheck/tests/build on every push; `docker.yml`
  builds and pushes both images to GHCR.

---

## Roadmap / future work

- Multi-tenant workspaces
- CSV export for customers/products/movements
- Email/SMS reminders for overdue follow-ups