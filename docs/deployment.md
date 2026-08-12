# Deployment Guide

You host three things:

1. **PostgreSQL database** — provisioned on **Neon** (serverless Postgres).
2. **API backend** — Node/Express as a **Docker container** on EC2 (`backend/Dockerfile`).
3. **Frontend** — React/Vite as an **nginx container** on EC2 (`frontend/Dockerfile`).

> Ports: the backend container serves the API on port **4000**; the nginx frontend
> serves the SPA on port **80/443** (TLS via Let's Encrypt). No manual port changes needed.

---

## 1. Provision the database with Neon

1. Create an account at https://neon.tech and click **New Project**.
   - Name: `crm-portal`, Region: pick one close to you.
   - PostgreSQL version 14+.
2. Wait for the project, then open **Connect** → **Connection string**.
   Copy the pooled connection string (port `5432`, `?sslmode=require` suffix).
3. Create two logical databases under it: `neondb` is the default (use it as the
   **main** DB) plus a second one named `crm_test` for automated tests.
   ```
   CREATE DATABASE crm_test;
   ```
4. Save both strings (you'll paste them into Render env vars).

### Schema & seed on Neon (one-time)

The schema and seed data are applied with the same setup command you used locally —
the server does **not** auto-migrate, so run this once from a local checkout,
pointing `DATABASE_URL` at Neon before you deploy:

```bash
cd backend
DATABASE_URL="postgres://<user>:<password>@<host>/neondb?sslmode=require" \
JWT_SECRET=<any-value> \
npm run db:setup
```

Flags: add `--reset` to drop & recreate the schema, or `--seed-only` to keep data
and just (re)apply seed rows. In CI the test suite manages its own `crm_test` DB,
so you only ever seed the main Neon DB manually.

---

## 2. Deploy the backend to Render

`render.yaml` at the repo root describes the service. In the Render dashboard:

1. **New → Blueprint** and point it at your GitHub repo
   (`ayaxan7/mini-erp-crm-portal`). Render reads `render.yaml`, creates the backend
   service and deploys.
2. Add the env vars (or confirm the blueprint prompts):

   | Key | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `PORT` | `4000` |
   | `DATABASE_URL` | Neon pooled connection string |
   | `TEST_DATABASE_URL` | Neon `crm_test` string |
   | `JWT_SECRET` | long random string (never reuse the dev one) |
   | `JWT_EXPIRES_IN` | `8h` |
   | `FRONTEND_URL` | `https://meridian.smayaan.me` (add more origins comma-separated) |

3. Render runs `npm run build` then `npm start`. Health check hits `/health`.

After deploy, note your API URL: `https://<render-service>.onrender.com`.

### Local verification

```bash
curl https://<render-service>.onrender.com/health
curl -X POST https://<render-service>.onrender.com/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@crmportal.dev","password":"Admin@123"}'
```

---

## 3. Deploy the frontend

The frontend ships as an **nginx container** (React/Vite SPA) through `docker-compose.yml`
and is deployed together with the backend on EC2. The production nginx config
(`frontend/nginx.conf`) serves the SPA with client-side routing fallback, proxies
`/api` to the backend, and terminates HTTPS with a Let's Encrypt certificate (certs
mounted from `./certs` on the host). See **section 6 (Deploy with Docker on EC2)** for
the full setup.

> A `VITE_API_URL` is baked in at build time (`/api` by default), so the same build works
> anywhere behind nginx. In local dev there is no `VITE_API_URL`, so Vite proxies to
> `http://localhost:4000`.

---

## 4. CI (GitHub Actions)

`.github/workflows/ci.yml` runs on every push/PR:

- Backend: install → `npm run typecheck` → `npm run test` against an ephemeral
  PostgreSQL 14 service container.
- Frontend: install → `npm run build`.

The backend test suite seeds its own isolated `crm_test` database, so CI needs no
credentials.

---

## 5. Smoke-test the live system

1. Open the live URL (`https://meridian.smayaan.me`), sign in as `admin@crmportal.dev` / `Admin@123`.
2. Create a customer, add a follow-up.
3. Add a product with opening stock, adjust stock IN/OUT; confirm the movement history.
4. Create a challan (draft) → confirm it → verify product stock went down →
   cancel it → verify stock returned.
5. Sign in as `warehouse@crmportal.dev` and confirm the challan buttons are hidden.

> In production, change the seed passwords (edit `backend/src/db/seed.ts`) before a
> public launch.

---

## 6. Deploy with Docker on EC2 (preferred for the case study)

Everything the app needs at runtime is containerised: multi-stage `backend/Dockerfile`
(dev/build/prod, prod bundles system **Chromium** for the PDF invoices) and
`frontend/Dockerfile` (dev/build + nginx prod). A **single `docker-compose.yml`** runs
both dev and prod via **profiles**.

### Architecture

| Container | Role | Exposed |
| --- | --- | --- |
| `postgres` *(dev only)* | Local PostgreSQL 16 for `--profile dev` | 5432 |
| `backend` *(prod)* | Node API; proxied by nginx; Chromium available for PDFs | 4000 |
| `frontend` *(prod)* | nginx serving the SPA and proxying `/api` + `/uploads` | 80 |
| `backend-dev` / `frontend-dev` | Hot-reload dev servers (bind mounts) | 4000 / 5173 |

### On EC2 (Ubuntu 24.04)

```bash
# 1. Install Docker + compose plugin (as required on a fresh VM)
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker

# 2. Open ports 22, 80 (and 443 if you add TLS) in the EC2 security group.

# 3. Clone and configure
git clone <your-repo-url> crm
cd crm
cp backend/.env.example .env        # or create .env from the table below
```

`.env` on the server (prod profile reads these):

```env
# Single value used by the backend container (Neon pooled string)
DATABASE_URL=postgresql://neondb_owner:xxxxx@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&uselibpqcompat=true
JWT_SECRET=<long random string — never reuse the dev one>
JWT_EXPIRES_IN=8h
FRONTEND_URL=http://<your-ec2-ip-or-domain>

# Product images → S3. Leave AWS_* empty to keep uploads on disk (./uploads volume).
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET=my-crm-images
```

```bash
# 4. Start production
docker compose --profile prod up -d --build

# 5. Verify
curl http://localhost/health
curl -X POST http://localhost/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@crmportal.dev","password":"Admin@123"}'
```

- The database is **not** part of prod — it stays on Neon, so nothing to migrate.
- Logs: `docker compose --profile prod logs -f backend frontend`.
- Updates: `git pull && docker compose --profile prod up -d --build`.
- Images are pre-built by GitHub Actions to **Docker Hub** (`docker.yml`): pushes to
  `main` publish `ayaxan7/crm-portal-backend:latest` and
  `ayaxan7/crm-portal-frontend:latest` (pushes to `dev` use the `dev` tag). Pull them
  with `docker compose pull` for zero-build deploys, or run the portal anywhere
  without a local build:

  ```bash
  docker pull ayaxan7/crm-portal-backend:latest
  docker pull ayaxan7/crm-portal-frontend:latest
  ```
- nginx already proxies `/api` to the backend, serves `/uploads` from the backend
  container, and does SPA fallback to `index.html`.
- `./uploads` (and `./frontend/uploads` in dev) lives in a named volume — safe across
  restarts, but for backups prefer the S3 option with real credentials.

### Development on any machine with Docker

```bash
docker compose --profile dev up --build   # API :4000, SPA :5173, local Postgres
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| API returns 503 / render crashes | `DATABASE_URL` wrong or SSL | Use the `?sslmode=require` pooled string from Neon |
| Login returns 401 | `JWT_SECRET` changed between boot | Redeploy after setting a stable secret |
| Frontend shows network error | `VITE_API_URL` mismatch / CORS | Check `FRONTEND_URL` includes the live origin and rerun the frontend build |
| Tests fail locally | test DB unreachable | Ensure `crm_test` exists and `TEST_DATABASE_URL` is correct |
