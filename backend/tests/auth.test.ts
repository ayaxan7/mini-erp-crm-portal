import { describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app, loginAs, auth, resetDb } from './helpers.js';

const ADMIN = 'admin@crmportal.dev';

describe('AUTH', () => {
  it('logs in with valid credentials for every role', async () => {
    const cases = [
      ['admin@crmportal.dev', 'Admin@123', 'ADMIN'],
      ['sales@crmportal.dev', 'Sales@123', 'SALES'],
      ['warehouse@crmportal.dev', 'Warehouse@123', 'WAREHOUSE'],
      ['accounts@crmportal.dev', 'Accounts@123', 'ACCOUNTS'],
    ] as const;
    for (const [email, password, role] of cases) {
      const res = await request(app).post('/auth/login').send({ email, password });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeTruthy();
      expect(res.body.data.user).toMatchObject({ email, role });
    }
  });

  it('rejects a wrong password', async () => {
    const res = await request(app).post('/auth/login').send({ email: ADMIN, password: 'Wrong-Pass-1' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it('rejects an unknown email', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'nobody@nowhere.io', password: 'whatever' });
    expect(res.status).toBe(401);
  });

  it('rejects missing credentials', async () => {
    const missing = [await request(app).post('/auth/login').send({}), await request(app).post('/auth/login').send({ email: ADMIN })];
    for (const res of missing) {
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    }
  });

  it('rejects an invalid email format', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'not-an-email', password: 'x' });
    expect(res.status).toBe(400);
  });

  it('returns the current user from a valid token', async () => {
    const token = await loginAs('SALES');
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email: 'sales@crmportal.dev', role: 'SALES' });
  });

  it('rejects requests without a token', async () => {
    const res = await request(app).get('/customers');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid token', async () => {
    const res = await request(app).get('/customers').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const token = jwt.sign({ id: 1, name: 'x', email: 'x@x.com', role: 'ADMIN' }, process.env.JWT_SECRET!, { expiresIn: '-10s' });
    const res = await request(app).get('/customers').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('applies role restrictions', async () => {
    await resetDb();
    const accounts = await auth('ACCOUNTS');
    const res = await accounts.post('/products').send({ name: 'Nope', sku: 'NOPE-1', unitPrice: 5 });
    expect(res.status).toBe(403);
  });
});