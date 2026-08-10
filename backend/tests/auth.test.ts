import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, loginAs, resetDb, tokenFor, TEST_IDENTITY } from './helpers.js';

describe('AUTH', () => {
  it('resolves the current user from a valid token for every role', async () => {
    const roles = ['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'] as const;
    for (const role of roles) {
      const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${await loginAs(role)}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ email: TEST_IDENTITY[role].email, role });
    }
  });

  it('provisions an unknown Firebase user with view-only access', async () => {
    const token = tokenFor({ uid: 'fb-new-guy', name: 'Brand New', email: 'new@test.local' });
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Brand New', email: 'new@test.local', role: 'ACCOUNTS' });
  });

  it('does not duplicate a user on subsequent requests', async () => {
    const token = tokenFor({ uid: 'fb-returning', email: 'returning@test.local' });
    await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    const admin = await auth('ADMIN');
    const res = await admin.get('/auth/users?search=returning');
    const matches = res.body.data.data.filter((user: { email: string }) => user.email === 'returning@test.local');
    expect(matches).toHaveLength(1);
  });

  it('rejects requests without a token', async () => {
    const res = await request(app).get('/customers');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid token', async () => {
    const res = await request(app).get('/customers').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed bearer header', async () => {
    const res = await request(app).get('/customers').set('Authorization', 'Basic abc');
    expect(res.status).toBe(401);
  });

  it('applies role restrictions to writes', async () => {
    await resetDb();
    const accounts = await auth('ACCOUNTS');
    const res = await accounts.post('/products').send({ name: 'Nope', sku: 'NOPE-1', unitPrice: 5 });
    expect(res.status).toBe(403);
  });
});

describe('USER MANAGEMENT', () => {
  it('lists users for admins', async () => {
    await resetDb();
    const admin = await auth('ADMIN');
    const res = await admin.get('/auth/users');
    expect(res.status).toBe(200);
    expect(res.body.data.meta.total).toBe(Object.keys(TEST_IDENTITY).length);
  });

  it('denies the users list to non-admins', async () => {
    const sales = await auth('SALES');
    const res = await sales.get('/auth/users');
    expect(res.status).toBe(403);
  });

  it('lets an admin grant a role to another user', async () => {
    await resetDb();
    const admin = await auth('ADMIN');
    const list = await admin.get('/auth/users');
    const target = list.body.data.data.find((user: { email: string }) => user.email === TEST_IDENTITY.SALES.email);
    expect(target?.role).toBe('SALES');

    const salesToken = await loginAs('SALES');
    const before = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ name: 'Blocked', sku: 'BLKD-1', unitPrice: 5 });
    expect(before.status).toBe(403);

    const res = await admin.patch(`/auth/users/${target.id}/role`).send({ role: 'WAREHOUSE' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('WAREHOUSE');

    const after = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ name: 'Allowed', sku: 'OK-1', unitPrice: 5 });
    expect(after.status).toBe(201);
  });

  it('promotes a newly-provisioned user after the admin grants a role', async () => {
    await resetDb();
    const token = tokenFor({ uid: 'fb-grant-me', name: 'Grant Me', email: 'grant@test.local' });
    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    const userId = me.body.data.id;

    const admin = await auth('ADMIN');
    const res = await admin.patch(`/auth/users/${userId}/role`).send({ role: 'SALES' });
    expect(res.status).toBe(200);

    const promoted = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(promoted.body.data.role).toBe('SALES');
  });

  it('blocks an admin from changing their own role', async () => {
    await resetDb();
    const admin = await auth('ADMIN');
    const me = await admin.get('/auth/me');
    const res = await admin.patch(`/auth/users/${me.body.data.id}/role`).send({ role: 'SALES' });
    expect(res.status).toBe(409);
  });

  it('rejects an invalid role value', async () => {
    const admin = await auth('ADMIN');
    const list = await admin.get('/auth/users');
    const target = list.body.data.data.find((user: { email: string }) => user.email === TEST_IDENTITY.SALES.email);
    const res = await admin.patch(`/auth/users/${target.id}/role`).send({ role: 'SUPERUSER' });
    expect(res.status).toBe(400);
  });
});