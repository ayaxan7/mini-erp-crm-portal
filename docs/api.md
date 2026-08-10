# API Reference

Base URL (local): `http://localhost:4000`

All endpoints except `/health` require a Firebase ID token:

```
Authorization: Bearer <firebase-id-token>
```

## Response envelope

Every endpoint returns `{ "success": true, "data": { ... } }`.

Errors:

```json
{ "success": false, "message": "Human readable message", "errors": [ { "field": "mobile", "message": "Enter a valid mobile number" } ] }
```

List endpoints wrap results in `data` (array) + `meta`:

```json
{ "success": true, "data": [ ... ], "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 } }
```

### Common status codes

| Code | Meaning |
| --- | --- |
| 200 / 201 | Success |
| 400 | Validation failed (fields in `errors`) |
| 401 | Missing / invalid token |
| 403 | Authenticated but role not allowed |
| 404 | Resource not found |
| 409 | Business conflict (duplicate SKU, insufficient stock, double confirm, ...) |

---

## Auth

Auth is handled by **Firebase Auth** — there is no `/auth/login`. The frontend signs
the user in (email/password or Google) and sends the ID token on every request. The
backend verifies it via the Admin SDK, auto-provisions unknown users (first user →
`ADMIN`, everyone else → view-only `ACCOUNTS`), and admins grant roles via the
endpoints below.

### `GET /auth/me`

Returns the current user, provisioning it on first call:

```json
{
  "success": true,
  "data": { "id": 1, "name": "Admin User", "email": "admin@acme.com", "role": "ADMIN" }
}
```

`401` if the token is missing, invalid or expired.

### `GET /auth/users` — _ADMIN_

Lists portal users. Query params: `page` (default 1), `limit` (default 10, max 100), `search` (name/email, case-insensitive).

200 → `{ success, data: [ { id, name, email, role, created_at } ], meta }`.

### `PATCH /auth/users/:id/role` — _ADMIN_

Body: `role*` (`ADMIN|SALES|WAREHOUSE|ACCOUNTS`).

```json
{ "role": "SALES" }
```

- `403` if the caller is not an admin (enforced server-side).
- `409` if `:id` is your own user — you cannot change your own role.

200 → the updated user.

---
## Customers

### `GET /customers`

Query params (all optional): `page` (default 1), `limit` (default 10, max 100), `search` (case-insensitive on name / business name / mobile), `type` (`RETAIL|WHOLESALE|DISTRIBUTOR`), `status` (`LEAD|ACTIVE|INACTIVE`).

200:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Arjun Mehta",
      "mobile": "9876543210",
      "email": null,
      "business_name": "Siddharth Traders",
      "gst_number": null,
      "type": "WHOLESALE",
      "address": "Mumbai",
      "status": "ACTIVE",
      "follow_up_date": "2026-08-15",
      "notes": null,
      "created_by": 1,
      "created_by_name": "Admin User",
      "created_at": "2026-08-10T08:30:00.000Z",
      "updated_at": "2026-08-10T08:30:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 8, "totalPages": 1 }
}
```

### `POST /customers` — _ADMIN, SALES_

Body: `name*`, `mobile*`, `type*`, `status*`, optional `email`, `businessName`, `gstNumber` (15 chars), `address`, `followUpDate` (`YYYY-MM-DD`), `notes`.

```json
{ "name": "Rohit Sharma", "mobile": "9988776655", "type": "RETAIL", "status": "LEAD" }
```

201 → the created customer.

### `GET /customers/:id`

200 → the customer, or `404`.

### `PATCH /customers/:id` — _ADMIN, SALES_

Same fields as create (partial update).

### `GET /customers/:id/followups`

200 → `{ success, data: [ { id, customer_id, notes, follow_up_date, created_by, created_by_name, created_at } ] }`.

### `POST /customers/:id/followups` — _ADMIN, SALES_

Body: `notes*`, optional `followUpDate`.

## Products & Inventory

### `GET /products`

Query params: `page`, `limit`, `search` (name/SKU, case-insensitive), `category`, `lowStock` (`true|false` → only items at/below minimum).

200:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Steel Water Bottle 750ml",
      "sku": "WB-750",
      "category": "Accessories",
      "unit_price": "450",
      "current_stock": 235,
      "min_stock": 20,
      "location": "Rack A-1",
      "is_low_stock": false,
      "created_by_name": "Admin User",
      "created_at": "2026-08-01T09:00:00.000Z",
      "updated_at": "2026-08-10T10:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 9, "totalPages": 1 }
}
```

### `POST /products` — _ADMIN, WAREHOUSE_

Body: `name*`, `sku*` (auto-uppercased, case-insensitively unique → `409` on clash), `unitPrice*`, optional `category`, `currentStock` (creates an opening `IN` movement), `minStock`, `location`.

### `GET /products/:id`

200 → the product, or `404`.

### `PATCH /products/:id` — _ADMIN, WAREHOUSE_

Partial update of `name`, `sku`, `category`, `unitPrice`, `minStock`, `location`. Stock is not changeable here — use `POST /products/:id/stock`.

### `GET /products/:id/movements`

Query params: `page`, `limit`. 200 → `{ success, data: [ movement, ... ], meta }`.

### `POST /products/:id/stock` — _ADMIN, WAREHOUSE_

Body: `type` (`IN|OUT`), `quantity*` (positive integer), `reason*`.

```json
{ "type": "OUT", "quantity": 12, "reason": "Damaged in transit" }
```

Deducting more than available returns `409` (no partial change — atomic). 200 → the updated product with new `current_stock`.

## All stock movements

### `GET /stock/movements`

Query params: `page`, `limit`, `productId`. 200 → `{ success, data: [ movement, ... ], meta }`.

Movement row:

```json
{
  "id": 41,
  "product_id": 1,
  "quantity_changed": -2,
  "movement_type": "OUT",
  "reason": "Sales Challan",
  "reference_type": "CHALLAN",
  "reference_id": 3,
  "created_by": 1,
  "created_by_name": "Admin User",
  "created_at": "2026-08-10T10:00:00.000Z"
}
```

`quantity_changed` is negative for `OUT`, positive for `IN`.

## Challans

### `GET /challans`

Query params: `page`, `limit`, `status` (`DRAFT|CONFIRMED|CANCELLED`), `customerId`, `search` (challan number / customer name — case-insensitive).

200 row:

```json
{
  "success": true,
  "data": [
    {
      "id": 3,
      "challan_number": "CHL-20260810-000003",
      "customer_id": 1,
      "customer_name": "Siddharth Traders",
      "customer_business_name": "Siddharth Traders",
      "total_quantity": 5,
      "status": "CONFIRMED",
      "remarks": null,
      "confirmed_at": "2026-08-10T09:15:00.000Z",
      "cancelled_at": null,
      "created_by_name": "Admin User",
      "created_at": "2026-08-10T09:15:00.000Z",
      "updated_at": "2026-08-10T09:15:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 3, "totalPages": 1 }
}
```

### `POST /challans` — _ADMIN, SALES_

Body: `customerId*`, `status` (`DRAFT` default | `CONFIRMED`), `remarks` (optional), `items*` (min 1):

```json
{
  "customerId": 1,
  "status": "DRAFT",
  "remarks": "Deliver by Thursday",
  "items": [ { "productId": 1, "quantity": 5 } ]
}
```

Submitting `CONFIRMED` runs the same atomic stock-deduction path as `PATCH /confirm` (see below). 201 → `{ challan, items }`.

### `GET /challans/:id`

200 → `{ success, data: { challan, items } }` where:

```json
{
  "challan": { ...same fields as list row... },
  "items": [
    {
      "id": 11,
      "challan_id": 3,
      "product_id": 1,
      "product_name": "Steel Water Bottle 750ml",
      "product_sku": "WB-750",
      "unit_price": "450",
      "quantity": 5
    }
  ]
}
```

Items are **snapshots** — they keep the name/SKU/price from when the challan was created.

### `PATCH /challans/:id/confirm` — _ADMIN, SALES_

Transactionally: locks products `FOR UPDATE`, validates availability, deducts stock,
writes `OUT` movements referencing the challan, marks it `CONFIRMED` with `confirmed_at`.
Any failure rolls back everything and returns `409`.

- Already confirmed → `409 Conflict`.
- Cancelled challan → `409 Conflict`.
- Insufficient stock → `409` with the failing product name and available qty.

200 → the full `{ challan, items }`.

### `PATCH /challans/:id/cancel` — _ADMIN, SALES_

- `DRAFT` → marked `CANCELLED`, no stock change.
- `CONFIRMED` → restocked (`IN` movements, reason `Sales Challan Cancelled`) then marked `CANCELLED` with `cancelled_at`.
- Already cancelled → `409 Conflict`.

200 → the full `{ challan, items }`.

---

## Dashboard

### `GET /dashboard/summary`

200:

```json
{
  "customers": { "total": 8, "active": 5, "leads": 2, "overdueFollowups": 0 },
  "products": { "total": 9, "lowStock": 1, "stockValue": 153560 },
  "challans": { "total": 3, "drafts": 1, "confirmed": 1, "cancelled": 1 },
  "monthlyChallans": [ { "label": "Mar", "count": 2 } ],
  "recentChallans": [ { "id": 3, "challan_number": "CHL-20260810-000003", "status": "CONFIRMED", "total_quantity": 5, "customer_name": "Siddharth Traders", "created_at": "2026-08-10T09:15:00.000Z" } ],
  "lowStockProducts": [ { "id": 8, "name": "Biscuit Family Pack", "sku": "BC-200", "current_stock": 0, "min_stock": 10 } ]
}
```

## Health

### `GET /health`

200 → `{ "success": true, "message": "OK" }`. Used by deployment health checks.
