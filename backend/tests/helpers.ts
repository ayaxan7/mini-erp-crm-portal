import { beforeAll } from 'vitest';
import request, { type Test } from 'supertest';
import { pool } from '../src/config/db.js';
import { createApp } from '../src/app.js';
import { seedUsers } from '../src/db/seed.js';
import type { Role } from '../src/types/index.js';

export const app = createApp();

export interface ApiClient {
  get: (path: string) => Test;
  post: (path: string) => Test;
  patch: (path: string) => Test;
  put: (path: string) => Test;
  delete: (path: string) => Test;
}

const CREDENTIALS: Record<Role, { email: string; password: string }> = {
  ADMIN: { email: 'admin@crmportal.dev', password: 'Admin@123' },
  SALES: { email: 'sales@crmportal.dev', password: 'Sales@123' },
  WAREHOUSE: { email: 'warehouse@crmportal.dev', password: 'Warehouse@123' },
  ACCOUNTS: { email: 'accounts@crmportal.dev', password: 'Accounts@123' },
};

beforeAll(async () => {
  await resetDb();
});

export async function resetDb(): Promise<{ products: { id: number; sku: string; current_stock: number }[]; customerId: number }> {
  await pool.query('TRUNCATE access_requests, users, challan_items, challans, customer_followups, customers, stock_movements, products RESTART IDENTITY CASCADE');
  await seedUsers();

  const { rows: products } = await pool.query(
    `INSERT INTO products (name, sku, unit_price, current_stock, min_stock) VALUES
      ('Product A', 'SKU-A', 100, 20, 5),
      ('Product B', 'SKU-B', 50, 10, 5),
      ('Product C', 'SKU-C', 75, 0, 5),
      ('Product D', 'SKU-D', 25, 5, 5)
     RETURNING id, sku, current_stock`,
  );

  const { rows: customers } = await pool.query(
    `INSERT INTO customers (name, mobile, type, status, created_by)
     VALUES ('Test Customer', '9876543210', 'RETAIL', 'ACTIVE', (SELECT id FROM users WHERE email = 'admin@crmportal.dev'))
     RETURNING id`,
  );

  return { products, customerId: customers[0].id };
}

export async function loginAs(role: Role): Promise<string> {
  const { email, password } = CREDENTIALS[role];
  const res = await request(app).post('/auth/login').send({ email, password });
  if (res.status !== 200 || !res.body.data?.token) {
    throw new Error(`Login failed for ${role}: ${JSON.stringify(res.body)}`);
  }
  return res.body.data.token;
}

export async function auth(role: Role): Promise<ApiClient> {
  const token = await loginAs(role);
  return {
    get: (path) => request(app).get(path).set('Authorization', `Bearer ${token}`),
    post: (path) => request(app).post(path).set('Authorization', `Bearer ${token}`),
    patch: (path) => request(app).patch(path).set('Authorization', `Bearer ${token}`),
    put: (path) => request(app).put(path).set('Authorization', `Bearer ${token}`),
    delete: (path) => request(app).delete(path).set('Authorization', `Bearer ${token}`),
  };
}