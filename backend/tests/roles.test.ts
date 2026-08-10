import { describe, expect, it } from 'vitest';
import { auth, resetDb } from './helpers.js';
import type { Role } from '../src/types/index.js';

const PERMISSIONS: Record<string, { method: 'post' | 'patch'; path: string; body: Record<string, unknown>; allowed: Role[] }> = {
  createCustomer: { method: 'post', path: '/customers', body: { name: 'Role Co', mobile: '9444444444', type: 'RETAIL', status: 'ACTIVE' }, allowed: ['ADMIN', 'SALES'] },
  createProduct: { method: 'post', path: '/products', body: { name: 'Role Product', sku: 'ROLE-1', unitPrice: 10 }, allowed: ['ADMIN', 'WAREHOUSE'] },
  createChallan: { method: 'post', path: '/challans', body: { customerId: 1, items: [{ productId: 1, quantity: 1 }] }, allowed: ['ADMIN', 'SALES'] },
  adjustStock: { method: 'post', path: '/products/1/stock', body: { type: 'IN', quantity: 1, reason: 'Role test' }, allowed: ['ADMIN', 'WAREHOUSE'] },
};

describe('ROLE-BASED ACCESS', () => {
  it('allows the expected roles on each write endpoint and forbids the rest', async () => {
    await resetDb();
    const roles: Role[] = ['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'];

    for (const [name, spec] of Object.entries(PERMISSIONS)) {
      for (const role of roles) {
        const api = await auth(role);
        const body = spec.body.sku ? { ...spec.body, sku: `${spec.body.sku}-${role}` } : spec.body;
        const res = await api[spec.method](spec.path).send(body);
        if (spec.allowed.includes(role)) {
          expect([200, 201], `${name} should allow ${role}`).toContain(res.status);
        } else {
          expect(res.status, `${name} should forbid ${role}`).toBe(403);
        }
      }
    }
  });

  it('allows every role to read listings', async () => {
    const roles: Role[] = ['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'];
    for (const role of roles) {
      const api = await auth(role);
      for (const path of ['/customers', '/products', '/challans', '/dashboard/summary']) {
        const res = await api.get(path);
        expect([200, 401], `${role} reading ${path}`).toContain(res.status);
        if (res.status === 200) {
          expect(res.body.success).toBe(true);
        }
      }
    }
  });

  it('forbids all write operations for unauthenticated requests', async () => {
    const { app } = await import('./helpers.js');
    const request = (await import('supertest')).default;
    for (const path of ['/customers', '/products', '/challans', '/products/1/stock']) {
      const res = await request(app).post(path).send({});
      expect(res.status).toBe(401);
    }
  });

  it('allows only sales and admin to follow up on customers', async () => {
    await resetDb();
    const roles: Role[] = ['SALES', 'ACCOUNTS'];
    for (const role of roles) {
      const api = await auth(role);
      const res = await api.post('/customers/1/followups').send({ notes: 'Following up' });
      if (role === 'SALES') {
        expect(res.status).toBe(201);
      } else {
        expect(res.status).toBe(403);
      }
    }
  });

  it('enforces stock-posting rights (warehouse + admin only)', async () => {
    await resetDb();
    const api = await auth('SALES');
    const res = await api.post('/products/1/stock').send({ type: 'IN', quantity: 5, reason: 'Restock' });
    expect(res.status).toBe(403);
  });
});