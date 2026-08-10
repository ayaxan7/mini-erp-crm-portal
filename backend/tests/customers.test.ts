import { describe, expect, it } from 'vitest';
import { auth, resetDb } from './helpers.js';

describe('CUSTOMERS', () => {
  it('creates a customer', async () => {
    await resetDb();
    const api = await auth('SALES');
    const res = await api.post('/customers').send({
      name: 'New Retail Shop',
      mobile: '9123456780',
      email: 'shop@example.com',
      businessName: 'New Retail Pvt Ltd',
      type: 'RETAIL',
      address: 'Mumbai, MH',
      status: 'LEAD',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('New Retail Shop');
    expect(res.body.data.created_by).toBeTruthy();
  });

  it('creates with optional fields omitted and GST optional', async () => {
    await resetDb();
    const api = await auth('ADMIN');
    const res = await api.post('/customers').send({ name: 'Minimal Customer', mobile: '9988776655', type: 'WHOLESALE', status: 'ACTIVE' });
    expect(res.status).toBe(201);
    expect(res.body.data.gst_number).toBeNull();
  });

  it('rejects invalid customer data', async () => {
    await resetDb();
    const api = await auth('SALES');
    const cases = [
      { name: '', mobile: '9123456780', type: 'RETAIL', status: 'ACTIVE' },
      { name: 'Valid', mobile: '123', type: 'RETAIL', status: 'ACTIVE' },
      { name: 'Valid', mobile: '9123456780', type: 'B2B', status: 'ACTIVE' },
      { name: 'Valid', mobile: '9123456780', type: 'RETAIL', status: 'SLEEPING' },
      { name: 'Valid', mobile: '9123456780', type: 'RETAIL', status: 'ACTIVE', gstNumber: '123' },
      { name: 'Valid', mobile: '9123456780', type: 'RETAIL', status: 'ACTIVE', email: 'bad-email' },
    ];
    for (const body of cases) {
      const res = await api.post('/customers').send(body);
      expect(res.status).toBe(400);
    }
  });

  it('lists with pagination metadata and search', async () => {
    await resetDb();
    const api = await auth('ADMIN');
    const res = await api.get('/customers?page=1&limit=2&search=Test');
    expect(res.status).toBe(200);
    expect(res.body.data.meta).toMatchObject({ page: 1, limit: 2 });
    expect(res.body.data.meta.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data.data.length).toBeLessThanOrEqual(2);
    expect(res.body.data.data[0].name).toMatch(/Test/i);
  });

  it('lists and filters by type and status', async () => {
    await resetDb();
    const api = await auth('ADMIN');
    await api.post('/customers').send({ name: 'Wholesale One', mobile: '9000000001', type: 'WHOLESALE', status: 'ACTIVE' });
    await api.post('/customers').send({ name: 'Retail One', mobile: '9000000002', type: 'RETAIL', status: 'LEAD' });
    const res = await api.get('/customers?type=WHOLESALE');
    expect(res.body.data.data.every((c: { type: string }) => c.type === 'WHOLESALE')).toBe(true);
    const res2 = await api.get('/customers?status=LEAD');
    expect(res2.body.data.data.every((c: { status: string }) => c.status === 'LEAD')).toBe(true);
  });

  it('gets a customer by id', async () => {
    await resetDb();
    const api = await auth('ADMIN');
    const created = await api.post('/customers').send({ name: 'Detail Customer', mobile: '9111111111', type: 'DISTRIBUTOR', status: 'ACTIVE' });
    const res = await api.get(`/customers/${created.body.data.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Detail Customer');
  });

  it('returns 404 for a missing customer', async () => {
    await resetDb();
    const api = await auth('ADMIN');
    const res = await api.get('/customers/99999');
    expect(res.status).toBe(404);
  });

  it('updates a customer', async () => {
    await resetDb();
    const api = await auth('SALES');
    const created = await api.post('/customers').send({ name: 'Before Edit', mobile: '9222222222', type: 'RETAIL', status: 'LEAD' });
    const res = await api.patch(`/customers/${created.body.data.id}`).send({ name: 'After Edit', status: 'ACTIVE', followUpDate: '2026-09-01' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('After Edit');
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.follow_up_date).toBe('2026-09-01');
  });

  it('adds follow-up notes and reads them back in order', async () => {
    await resetDb();
    const api = await auth('SALES');
    const created = await api.post('/customers').send({ name: 'Followup Customer', mobile: '9333333333', type: 'RETAIL', status: 'LEAD' });
    const id = created.body.data.id;
    await api.post(`/customers/${id}/followups`).send({ notes: 'Called, interested in bulk order', followUpDate: '2026-08-20' }).expect(201);
    await api.post(`/customers/${id}/followups`).send({ notes: 'Sent quotation' }).expect(201);
    const res = await api.get(`/customers/${id}/followups`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].notes).toBe('Sent quotation');
  });

  it('rejects follow-up with empty notes', async () => {
    await resetDb();
    const api = await auth('SALES');
    const created = await api.post('/customers').send({ name: 'Notes Customer', mobile: '9555555555', type: 'RETAIL', status: 'LEAD' });
    const res = await api.post(`/customers/${created.body.data.id}/followups`).send({ notes: '   ' });
    expect(res.status).toBe(400);
  });
});