import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { pool } from '../src/config/db.js';
import { app, loginAs, auth, resetDb } from './helpers.js';

const EMAIL = 'sneha@acme.example';

async function requestAccess(payload: Record<string, unknown>) {
  return request(app).post('/auth/request-access').send(payload);
}

describe('ACCESS REQUESTS', () => {
  it('rejects invalid payloads', async () => {
    const cases = [
      { name: 'A', email: 'x@example.com', role: 'SALES' },
      { name: 'Alex', email: 'not-an-email', role: 'SALES' },
      { name: 'Alex', email: 'alex@example.com', role: 'ADMIN' },
      { name: 'Alex', email: 'alex@example.com', role: 'CEO' },
      {},
    ];
    for (const body of cases) {
      const res = await requestAccess(body);
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    }
  });

  it('creates a pending request without auth', async () => {
    await resetDb();
    const res = await requestAccess({ name: 'Sneha Iyer', email: EMAIL, role: 'SALES', message: 'New hire on the sales team' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ email: EMAIL, role: 'SALES', status: 'PENDING', name: 'Sneha Iyer' });
  });

  it('rejects a duplicate pending request for the same email', async () => {
    await resetDb();
    await requestAccess({ name: 'Sneha Iyer', email: EMAIL, role: 'SALES' });
    const res = await requestAccess({ name: 'Sneha Again', email: EMAIL, role: 'WAREHOUSE' });
    expect(res.status).toBe(409);
  });

  it('rejects requests for an email that already has an account', async () => {
    await resetDb();
    const res = await requestAccess({ name: 'Ravi', email: 'sales@crmportal.dev', role: 'SALES' });
    expect(res.status).toBe(409);
  });

  it('only allows ADMIN to list access requests', async () => {
    await resetDb();
    await requestAccess({ name: 'Sneha Iyer', email: EMAIL, role: 'ACCOUNTS' });
    const sales = await auth('SALES');
    const forbidden = await sales.get('/auth/access-requests');
    expect(forbidden.status).toBe(403);

    const admin = await auth('ADMIN');
    const res = await admin.get('/auth/access-requests');
    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(1);
    expect(res.body.data.data[0]).toMatchObject({ email: EMAIL, status: 'PENDING' });
    expect(res.body.data.meta).toMatchObject({ page: 1, total: 1 });
  });

  it('filters by status', async () => {
    await resetDb();
    await requestAccess({ name: 'Sneha Iyer', email: EMAIL, role: 'SALES' });
    const admin = await auth('ADMIN');
    const res = await admin.get('/auth/access-requests?status=APPROVED');
    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(0);
    expect(res.body.data.meta.total).toBe(0);
  });

  it('approves a request, creates the user, and returns a generated password', async () => {
    await resetDb();
    await requestAccess({ name: 'Sneha Iyer', email: EMAIL, role: 'WAREHOUSE', message: 'Warehouse picker' });
    const admin = await auth('ADMIN');

    const res = await admin.patch(`/auth/access-requests/1/approve`).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email: EMAIL, role: 'WAREHOUSE' });
    expect(res.body.data.request.status).toBe('APPROVED');
    expect(res.body.data.generatedPassword).toBeTruthy();

    const login = await request(app).post('/auth/login').send({ email: EMAIL, password: res.body.data.generatedPassword });
    expect(login.status).toBe(200);
    expect(login.body.data.user).toMatchObject({ role: 'WAREHOUSE' });
  });

  it('approves with a custom initial password that satisfies the policy', async () => {
    await resetDb();
    await requestAccess({ name: 'Sneha Iyer', email: EMAIL, role: 'SALES' });
    const admin = await auth('ADMIN');
    const res = await admin.patch(`/auth/access-requests/1/approve`).send({ initialPassword: 'Temp#Pass1' });
    expect(res.status).toBe(200);
    expect(res.body.data.generatedPassword).toBeUndefined();
    const login = await request(app).post('/auth/login').send({ email: EMAIL, password: 'Temp#Pass1' });
    expect(login.status).toBe(200);
  });

  it('rejects a weak initial password', async () => {
    await resetDb();
    await requestAccess({ name: 'Sneha Iyer', email: EMAIL, role: 'SALES' });
    const admin = await auth('ADMIN');
    const res = await admin.patch(`/auth/access-requests/1/approve`).send({ initialPassword: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/password/i);
  });

  it('cannot approve twice or approve after rejection', async () => {
    await resetDb();
    await requestAccess({ name: 'Sneha Iyer', email: EMAIL, role: 'SALES' });
    const admin = await auth('ADMIN');

    const first = await admin.patch(`/auth/access-requests/1/approve`).send({});
    expect(first.status).toBe(200);
    const second = await admin.patch(`/auth/access-requests/1/approve`).send({});
    expect(second.status).toBe(409);

    await resetDb();
    const created = await requestAccess({ name: 'Priya Menon', email: 'priya@acme.example', role: 'ACCOUNTS' });
    const reject = await admin.patch(`/auth/access-requests/${created.body.data.id}/reject`).send({ reason: 'No open headcount' });
    expect(reject.status).toBe(200);
    expect(reject.body.data.status).toBe('REJECTED');
    expect(reject.body.data.review_note).toBe('No open headcount');
    const lateApprove = await admin.patch(`/auth/access-requests/${created.body.data.id}/approve`).send({});
    expect(lateApprove.status).toBe(409);
  });

  it('rejects approval when a user already exists with the request email', async () => {
    await resetDb();
    const created = await requestAccess({ name: 'Sneha Iyer', email: EMAIL, role: 'SALES' });
    expect(created.status).toBe(201);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ('Rival', 'sneha@acme.example', 'hash', 'SALES')`,
    );
    const admin = await auth('ADMIN');
    const res = await admin.patch(`/auth/access-requests/${created.body.data.id}/approve`).send({});
    expect(res.status).toBe(409);
  });

  it('does not leak list/approve endpoints to non-admins', async () => {
    await resetDb();
    const accounts = await auth('ACCOUNTS');
    const list = await accounts.get('/auth/access-requests');
    const approve = await accounts.patch('/auth/access-requests/1/approve').send({});
    const reject = await accounts.patch('/auth/access-requests/1/reject').send({});
    for (const res of [list, approve, reject]) {
      expect(res.status).toBe(403);
    }
  });

  it('allows a fresh request after a previous one was rejected', async () => {
    await resetDb();
    await requestAccess({ name: 'Priya Menon', email: 'priya@acme.example', role: 'ACCOUNTS' });
    const admin = await auth('ADMIN');
    await admin.patch(`/auth/access-requests/1/reject`).send({ reason: 'No headcount' });
    const res = await requestAccess({ name: 'Priya Menon', email: 'priya@acme.example', role: 'ACCOUNTS' });
    expect(res.status).toBe(201);
  });
});

describe('AUTH', () => {
  it('logs in with valid credentials for every role', async () => {
    await resetDb();
    const token = await loginAs('SALES');
    expect(token).toBeTruthy();
  });
});
