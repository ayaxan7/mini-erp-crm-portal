import { describe, expect, it } from 'vitest';
import { auth, resetDb } from './helpers.js';

describe('PRODUCTS', () => {
  it('creates a product and uppercases the SKU', async () => {
    await resetDb();
    const api = await auth('WAREHOUSE');
    const res = await api.post('/products').send({ name: 'Steel Bottle', sku: 'sb-001', category: 'Kitchen', unitPrice: 299, currentStock: 50, minStock: 10, location: 'WH-B' });
    expect(res.status).toBe(201);
    expect(res.body.data.sku).toBe('SB-001');
    expect(res.body.data.current_stock).toBe(50);
  });

  it('creates a product with default stock of zero', async () => {
    await resetDb();
    const api = await auth('ADMIN');
    const res = await api.post('/products').send({ name: 'No Stock Item', sku: 'NS-1', unitPrice: 10 });
    expect(res.status).toBe(201);
    expect(res.body.data.current_stock).toBe(0);
    expect(res.body.data.category).toBe('General');
  });

  it('rejects duplicate SKU', async () => {
    await resetDb();
    const api = await auth('WAREHOUSE');
    await api.post('/products').send({ name: 'First', sku: 'DUP-1', unitPrice: 10 });
    const res = await api.post('/products').send({ name: 'Second', sku: 'dup-1', unitPrice: 10 });
    expect(res.status).toBe(409);
  });

  it('rejects invalid product data', async () => {
    await resetDb();
    const api = await auth('ADMIN');
    const cases = [
      { name: '', sku: 'X-1', unitPrice: 10 },
      { name: 'X', sku: '', unitPrice: 10 },
      { name: 'X', sku: 'X-1', unitPrice: -5 },
      { name: 'X', sku: 'X-1', unitPrice: 10, currentStock: -1 },
      { name: 'X', sku: 'X-1', unitPrice: 10, minStock: -1 },
    ];
    for (const body of cases) {
      const res = await api.post('/products').send(body);
      expect(res.status).toBe(400);
    }
  });

  it('lists products with search and low-stock filter', async () => {
    await resetDb();
    const api = await auth('WAREHOUSE');
    const res = await api.get('/products?search=Product+A');
    expect(res.status).toBe(200);
    expect(res.body.data.data[0].sku).toBe('SKU-A');

    const low = await api.get('/products?lowStock=true');
    expect(low.status).toBe(200);
    expect(low.body.data.data.every((p: { is_low_stock: boolean }) => p.is_low_stock === true)).toBe(true);
  });

  it('gets and updates a product', async () => {
    await resetDb();
    const api = await auth('WAREHOUSE');
    const created = await api.post('/products').send({ name: 'Editable', sku: 'EDIT-1', unitPrice: 10, minStock: 4 });
    const get = await api.get(`/products/${created.body.data.id}`);
    expect(get.body.data.name).toBe('Editable');

    const updated = await api.patch(`/products/${created.body.data.id}`).send({ unitPrice: 20, minStock: 8, location: 'WH-A' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.unit_price).toBe('20.00');
    expect(updated.body.data.min_stock).toBe(8);
    expect(updated.body.data.location).toBe('WH-A');
  });

  it('returns 404 for a missing product', async () => {
    await resetDb();
    const api = await auth('ADMIN');
    const res = await api.get('/products/99999');
    expect(res.status).toBe(404);
  });
});