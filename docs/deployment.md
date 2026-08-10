# Deployment Guide

You host three things:

1. **PostgreSQL database** — provisioned on **Neon** (serverless Postgres).
2. **API backend** — Node/Express on **Render** (`render.yaml` included).
3. **Frontend** — React/Vite on **Vercel** (`vercel.json` included).

> Ports: Render serves the API on port **4000** (configurable via `PORT`). Vercel
> serves the SPA on 443. No manual port changes needed.

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
npm run db:setup
```

Flags: add `--reset` to drop & recreate the schema, or `--seed-only` to keep data
and just (re)apply seed rows. In CI the test suite manages its own `crm_test` DB,
so you only ever seed the main Neon DB manually.

The seed adds demo customers/products only — there are **no seed user accounts**.
Users are created and authorized through Firebase (see §2).

---

## 2. Deploy the backend to Render

> **Before this step, complete the Firebase setup** (one-time, in the web console):
> 1. Create a Firebase project (e.g. `meridian-erp`).
> 2. **Authentication → Sign-in method**: enable **Email/Password** and **Google**,
>    and under Google → **Authorized domains**, allow both your localhost port and the
>    Vercel domain (and `*.firebaseapp.com`) so the Google popup works from everywhere.
> 3. **Project settings → Service accounts → Generate new private key** — this is the
>    Admin SDK credential. Inline env vars (`FIREBASE_PROJECT_ID`,
>    `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) are the easiest to use on Render.

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
   | `FIREBASE_PROJECT_ID` | the Firebase project id (e.g. `meridian-erp`) |
   | `FIREBASE_CLIENT_EMAIL` | the service-account email |
   | `FIREBASE_PRIVATE_KEY` | the service-account private key (paste with actual newlines) |
   | `FRONTEND_URL` | `https://<your-project>.vercel.app` (add more origins comma-separated) |

3. Render runs `npm run build` then `npm start`. Health check hits `/health`.

After deploy, note your API URL: `https://<render-service>.onrender.com`.

### Local verification

```bash
curl https://<render-service>.onrender.com/health
```

Auth is exercised through the web UI (Firebase handles sign-in), so `curl` only
checks that the API is up. The frontend sends the user's Firebase ID token on every
request.

---

## 3. Deploy the frontend to Vercel

`vercel.json` builds the SPA and rewrites unknown paths to `/` for client-side routing.

1. In Vercel: **Add New → Project**, import the same GitHub repo.
2. **Root Directory:** `frontend`
3. Framework preset: **Vite** (auto-detected).
4. Environment variables (from the Firebase web app config —
   Project settings → Your apps):

   | Key | Value |
   | --- | --- |
   | `VITE_API_URL` | `https://<render-service>.onrender.com` |
   | `VITE_FIREBASE_API_KEY` | Firebase **web** API key |
   | `VITE_FIREBASE_AUTH_DOMAIN` | e.g. `meridian-erp.firebaseapp.com` |
   | `VITE_FIREBASE_PROJECT_ID` | e.g. `meridian-erp` |
   | `VITE_FIREBASE_APP_ID` | the web app id |

   > In local dev there is no `VITE_API_URL`, so Vite proxies to `http://localhost:4000`.

5. Deploy. Confirm the `_vercel.json` rewrite rules are applied for deep links like
   `/customers/1` and `/challans/new`.

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

1. Open the Vercel URL and **create an account** (or sign in with Google). The first
   user to sign in is automatically promoted to `ADMIN`; subsequent users start
   view-only (`ACCOUNTS`).
2. As admin, open **Users** and grant roles (e.g. grant yourself `ADMIN` if you were
   auto-created as `ACCOUNTS`, then grant `SALES`/`WAREHOUSE` to coworkers).
3. Create a customer, add a follow-up.
4. Add a product with opening stock, adjust stock IN/OUT; confirm the movement history.
5. Create a challan (draft) → confirm it → verify product stock went down →
   cancel it → verify stock returned.
6. Sign in (or create) a `WAREHOUSE` user directly in a different browser or incognito
   window and confirm the challan create/confirm buttons are hidden for them.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| API returns 503 / render crashes | `DATABASE_URL` wrong or SSL | Use the `?sslmode=require` pooled string from Neon |
| Sign-in works but every API call returns 401 | Backend can't verify the ID token | Confirm `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` are set and match the project; backend `verifyIdToken` is called with the correct project |
| Google sign-in popup closes with an error | Authorized domains missing | Add the Vercel domain (and localhost) to Google sign-in **Authorized domains** in Firebase |
| Frontend shows network error | `VITE_API_URL` mismatch / CORS | Check `FRONTEND_URL` includes the Vercel origin and rerun frontend build |
| Deep link 404s on Vercel | Rewrites missing | Confirm `vercel.json` rewrite to `/` is present |
| Tests fail locally | test DB unreachable | Ensure `crm_test` exists and `TEST_DATABASE_URL` is correct |
