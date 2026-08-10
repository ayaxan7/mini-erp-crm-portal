import { beforeAll } from 'vitest';
import request, { type Test } from 'supertest';
import { pool } from '../src/config/db.js';
import { createApp } from '../src/app.js';
import type { Role } from '../src/types/index.js';
import type { AuthTokenVerifier } from '../src/services/firebaseVerifier.js';

class FakeTokenVerifier implements AuthTokenVerifier {
  async verifyToken(token: string) {
    try {
      const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf-8')) as { uid?: string; email?: string; name?: string };
      if (!payload.uid) return null;
      return { uid: payload.uid, email: payload.email ?? null, name: payload.name ?? null };
    } catch {
      return null;
    }
  }
}

export const app = createApp({ tokenVerifier: new FakeTokenVerifier() });

export interface ApiClient {
  get: (path: string) => Test;
  post: (path: string) => Test;
  patch: (path: string) => Test;
  put: (path: string) => Test;
  delete: (path: string) => Test;
}

export const TEST_IDENTITY: Record<Role, { uid: string; name: string; email: string }> = {
  ADMIN: { uid: 'fb-admin-1', name: 'Admin', email: 'admin@test.local' },
  SALES: { uid: 'fb-sales-1', name: 'Sales', email: 'sales@test.local' },
  WAREHOUSE: { uid: 'fb-warehouse-1', name: 'Warehouse', email: 'warehouse@test.local' },
  ACCOUNTS: { uid: 'fb-accounts-1', name: 'Accounts', email: 'accounts@test.local' },
};

beforeAll(async () => {
  await resetDb();
});

export function tokenFor(identity: { uid: string; email?: string; name?: string }): string {
  return Buffer.from(JSON.stringify(identity)).toString('base64');
}

export async function resetDb(): Promise<{ products: { id: number; sku: string; current_stock: number }[]; customerId: number }> {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');

  for (const [role, identity] of Object.entries(TEST_IDENTITY)) {
    await pool.query(
      `INSERT INTO users (firebase_uid, name, email, role) VALUES ($1, $2, $3, $4::user_role)`,
      [identity.uid, identity.name, identity.email, role as Role],
    );
  }

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
     VALUES ('Test Customer', '9876543210', 'RETAIL', 'ACTIVE', (SELECT id FROM users WHERE firebase_uid = 'fb-admin-1'))
     RETURNING id`,
  );

  return { products, customerId: customers[0].id };
}

export async function loginAs(role: Role): Promise<string> {
  return tokenFor(TEST_IDENTITY[role]);
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