# Requirements Audit

Status of every requirement from the project brief against the delivered system.
Local environment: API `http://localhost:4000`, SPA `http://localhost:5173`.

Legend: ✅ implemented & verified · ⚠️ implemented, manual step needed to go live

## Functional checklist

| # | Requirement | Status | Evidence / location |
| --- | --- | --- | --- |
| 1 | Role-based auth, 4 roles | ✅ | `backend/src/middleware/auth.ts`, `src/db/schema.sql` (`user_role` enum); first user→`ADMIN`, others→`ACCOUNTS`; `LoginPage`, `AuthContext.can` (ADMIN bypasses) |
| 2 | Server-side role checks on all writes | ✅ | `requireRole` on every POST/PATCH route; `tests/roles.test.ts` (403s) |
| 3a | User management (admin grants roles) | ✅ | `GET /auth/users`, `PATCH /auth/users/:id/role` (ADMIN-only, self-change blocked), Users page in app |
| 3 | Firebase Auth login + session restore + logout | ✅ | Firebase email/password + Google sign-in; backend verifies ID token via Admin SDK; `GET /auth/me` auto-provisions; token in `localStorage`, 401 → `crm:unauthorized` → `/login` |
| 4 | Customer CRUD | ✅ | `/customers` GET/POST/PATCH; `tests/customers.test.ts` |
| 5 | Customer search + filters + pagination | ✅ | `/customers?search&type&status&page&limit`; UI toolbar, `DataTable`+`Pagination` |
| 6 | Follow-up scheduling + history | ✅ | `customer_followups` table; detail-page timeline; field `follow_up_date` |
| 7 | Products CRUD, unique SKU | ✅ | `uq_products_sku` (case-insensitive), duplicate → `409`; `tests/products.test.ts` |
| 8 | Live inventory, stock IN/OUT | ✅ | `POST /products/:id/stock` (transactional); `tests/stock.test.ts` (7 tests incl. rollback) |
| 9 | Stock movement history | ✅ | `GET /products/:id/movements`, `GET /stock/movements`; product detail page |
| 10 | Low-stock tracking + alerts | ✅ | `is_low_stock` derived; low-stock filter, dashboard alerts card |
| 11 | Challans draft / confirm / cancel | ✅ | `POST /challans` (status DRAFT|CONFIRMED), `PATCH .../confirm|cancel` |
| 12 | Confirm deducts stock **atomically** | ✅ | `challan.service.confirm`: `BEGIN` → `SELECT … FOR UPDATE` → validate → deduct → movements → `COMMIT`; rollback test |
| 13 | Cancel restocks confirmed challans | ✅ | `challan.service.cancel`: `IN` movements, reason `Sales Challan Cancelled` |
| 14 | Product snapshots in challans | ✅ | `challan_items` stores `product_name/_sku/unit_price` at creation |
| 15 | Sequence challan numbering | ✅ | `CHL-YYYYMMDD-NNNNNN` via `challan_number_seq` |
| 16 | Insufficient-stock conflict mapping | ✅ | `409` + product name/available; shown as toast in UI |
| 17 | Dashboard summary (stats/trend/recent/alerts) | ✅ | `GET /dashboard/summary`; dashboard page with 6-month bar chart |
| 18 | Custom design system (no UI library) | ✅ | tokens + hand-built kit in `frontend/src/components/ui` |
| 19 | Responsive + mobile nav | ✅ | `AppShell` drawer ≤768px |
| 20 | Loading / empty / error / confirm states | ✅ | `Spinner/Skeleton/Empty/ErrorState`, `ConfirmDialog`, `Toast` context |

## Engineering & quality checklist

| Criteria | Status |
| --- | --- |
| Constructor-based DI (composition root in `app.ts`) | ✅ |
| Repositories reusable inside transactions (`Queryable`) | ✅ |
| No ORM; `schema.sql` is source of truth | ✅ |
| No mocked mandatory features — all real Postgres | ✅ |
| Minimal comments | ✅ |
| Tests | ✅ 57/57 in 6 files |
| Typecheck + production build clean (both apps) | ✅ |
| Git: module-per-commit pushes to `main` | ✅ (`8ee68db`, `7965c7f` …) |
| `.env` / secrets excluded | ✅ |

## Verification snapshots

- `npm run test` (backend) → **6 files, 57/57 passed**. Run 2026-08-10 on the Firebase-auth commit.
- `npm run build` → backend `tsc` ok; frontend `vite build` ok.
- Firebase flow covered by injected `FakeTokenVerifier` in tests (no real Firebase in CI).
- E2E via Vite proxy (5173 → 4000): sign-in, dashboard summary, customers list,
  challan create + cancel, Users-role grant round-trip correctly.

## Go-live steps (deployment)

1. **Firebase**: enable Email/Password (+ Google) in Authentication; create web app;
   generate service-account key; add Vercel + localhost to Google Authorized domains.
2. **Neon**: create project, grab pooled connection string.
   - Run seeds once: `cd backend && DATABASE_URL=<neon> npm run db:setup`.
3. **Render**: import repo via `render.yaml` blueprint; set env vars (`DATABASE_URL`,
   `TEST_DATABASE_URL`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
   `FIREBASE_PRIVATE_KEY`, `FRONTEND_URL`) → deploy; health = `/health`.
4. **Vercel**: import repo root dir `frontend`; set `VITE_API_URL`, `VITE_FIREBASE_*`
   web-config vars.
5. First user to sign in becomes `ADMIN` — grant teammate roles from the Users page.

Full detail: `docs/deployment.md`.