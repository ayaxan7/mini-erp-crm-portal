# Requirements Audit

Status of every requirement from the project brief against the delivered system.
Local environment: API `http://localhost:4000`, SPA `http://localhost:5173`.

Legend: ✅ implemented & verified · ⚠️ implemented, manual step needed to go live

## Functional checklist

| # | Requirement | Status | Evidence / location |
| --- | --- | --- | --- |
| 1 | Role-based auth, 4 roles | ✅ | `backend/src/middleware/auth.ts`, `src/db/seed.ts`; `LoginPage`, `AuthContext.can` (ADMIN bypasses) |
| 2 | Server-side role checks on all writes | ✅ | `requireRole` on every POST/PATCH route; `tests/roles.test.ts` (403s) |
| 3 | JWT login + session restore + logout | ✅ | `POST /auth/login`, `GET /auth/me`; token in `localStorage`, 401 → `crm:unauthorized` → `/login` |
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
| Tests | ✅ 54/54 in 6 files |
| Typecheck + production build clean (both apps) | ✅ |
| Git: module-per-commit pushes to `main` | ✅ (`8ee68db`, `7965c7f` …) |
| `.env` / secrets excluded | ✅ |

## Verification snapshots

- `npm run test` (backend) → **6 files, 54/54 passed**. Run 2026-08-10 on the latest commit.
- `npm run build` → backend `tsc` ok; frontend `vite build` ok (72 modules).
- E2E via Vite proxy (5173 → 4000): login, dashboard summary, customers list,
  challan create + cancel all round-trip correctly.

## Go-live steps (deployment)

1. **Neon**: create project, grab pooled connection string.
   - Run seeds once: `cd backend && DATABASE_URL=<neon> npm run db:setup`.
2. **Render**: import repo via `render.yaml` blueprint; set env vars (`DATABASE_URL`,
   `TEST_DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`) → deploy; health = `/health`.
3. **Vercel**: import repo root dir `frontend`; set `VITE_API_URL` = Render URL.
4. Seed passwords are demo defaults — rotate before a public launch.

Full detail: `docs/deployment.md`.