import { describe, expect, it } from 'vitest';
import { auth, resetDb } from './helpers.js';

describe('CHALLANS', () => {
  it('creates a draft without touching stock and computes total quantity', async () => {
    await resetDb();
    const api = await auth('SALES');
    const before = await api.get('/products/1');
    const res = await api.post('/challans').send({
      customerId: 1,
      items: [
        { productId: 1, quantity: 3 },
        { productId: 2, quantity: 2 },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.total_quantity).toBe(5);
    expect(res.body.data.challan_number).toMatch(/^CHL-\d{8}-\d{6}$/);
    const after = await api.get('/products/1');
    expect(after.body.data.current_stock).toBe(before.body.data.current_stock);
  });

  it('confirms a draft: deducts stock and records OUT movements', async () => {
    await resetDb();
    const api = await auth('SALES');
    const draft = await api.post('/challans').send({ customerId: 1, items: [{ productId: 1, quantity: 6 }] });
    const confirmed = await api.patch(`/challans/${draft.body.data.id}/confirm`);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.challan.status).toBe('CONFIRMED');
    expect(confirmed.body.data.challan.confirmed_at).toBeTruthy();

    const product = await api.get('/products/1');
    expect(product.body.data.current_stock).toBe(14);

    const movements = await api.get('/products/1/movements');
    const salesMovement = movements.body.data.data[0];
    expect(salesMovement).toMatchObject({ quantity_changed: -6, movement_type: 'OUT', reason: 'Sales Challan' });
    expect(salesMovement.reference_type).toBe('CHALLAN');
    expect(salesMovement.reference_id).toBe(draft.body.data.id);
  });

  it('creates a confirmed challan directly and deducts stock atomically', async () => {
    await resetDb();
    const api = await auth('SALES');
    const res = await api.post('/challans').send({ customerId: 1, status: 'CONFIRMED', items: [{ productId: 2, quantity: 4 }] });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('CONFIRMED');
    const product = await api.get('/products/2');
    expect(product.body.data.current_stock).toBe(6);
  });

  it('handles multiple products in one challan and deducts each', async () => {
    await resetDb();
    const api = await auth('ADMIN');
    const res = await api.post('/challans').send({
      customerId: 1,
      status: 'CONFIRMED',
      items: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 5 },
        { productId: 4, quantity: 1 },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.total_quantity).toBe(8);
    expect((await api.get('/products/1')).body.data.current_stock).toBe(18);
    expect((await api.get('/products/2')).body.data.current_stock).toBe(5);
    expect((await api.get('/products/4')).body.data.current_stock).toBe(4);

    const get = await api.get(`/challans/${res.body.data.id}`);
    expect(get.body.data.items).toHaveLength(3);
  });

  it('preserves product snapshot even after the product is renamed', async () => {
    await resetDb();
    const api = await auth('SALES');
    const challan = await api.post('/challans').send({ customerId: 1, items: [{ productId: 1, quantity: 2 }] });
    await api.patch('/products/1').send({ name: 'Renamed Product A', sku: 'SKU-RENAMED' });
    const get = await api.get(`/challans/${challan.body.data.id}`);
    expect(get.body.data.items[0].product_name).toBe('Product A');
    expect(get.body.data.items[0].product_sku).toBe('SKU-A');
    expect(get.body.data.items[0].unit_price).toBe('100.00');
  });

  it('fails to confirm when stock is insufficient and leaves no partial deduction', async () => {
    await resetDb();
    const api = await auth('SALES');
    const draft = await api.post('/challans').send({
      customerId: 1,
      items: [
        { productId: 1, quantity: 3 },
        { productId: 2, quantity: 25 },
      ],
    });
    const before1 = (await api.get('/products/1')).body.data.current_stock;
    const res = await api.patch(`/challans/${draft.body.data.id}/confirm`);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/insufficient stock/i);
    expect((await api.get('/products/1')).body.data.current_stock).toBe(before1);
    expect((await api.get('/products/2')).body.data.current_stock).toBe(10);
    const challan = await api.get(`/challans/${draft.body.data.id}`);
    expect(challan.body.data.challan.status).toBe('DRAFT');
    expect(challan.body.data.challan.confirmed_at).toBeNull();
  });

  it('rejects a confirmed creation with insufficient stock and creates no challan', async () => {
    await resetDb();
    const api = await auth('SALES');
    const res = await api.post('/challans').send({ customerId: 1, status: 'CONFIRMED', items: [{ productId: 1, quantity: 999 }] });
    expect(res.status).toBe(409);
    const list = await api.get('/challans');
    expect(list.body.data.meta.total).toBe(0);
  });

  it('generates unique challan numbers', async () => {
    await resetDb();
    const api = await auth('ADMIN');
    const seen = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const res = await api.post('/challans').send({ customerId: 1, items: [{ productId: 1, quantity: 1 }] });
      seen.add(res.body.data.challan_number);
    }
    expect(seen.size).toBe(5);
  });

  it('returns 409 when confirming an already confirmed or cancelled challan', async () => {
    await resetDb();
    const api = await auth('ADMIN');
    const confirmed = await api.post('/challans').send({ customerId: 1, status: 'CONFIRMED', items: [{ productId: 1, quantity: 1 }] });
    const again = await api.patch(`/challans/${confirmed.body.data.id}/confirm`);
    expect(again.status).toBe(409);

    const draft = await api.post('/challans').send({ customerId: 1, items: [{ productId: 1, quantity: 1 }] });
    await api.patch(`/challans/${draft.body.data.id}/cancel`);
    const confirmAfterCancel = await api.patch(`/challans/${draft.body.data.id}/confirm`);
    expect(confirmAfterCancel.status).toBe(409);
  });

  it('cancels a draft with no stock change', async () => {
    await resetDb();
    const api = await auth('SALES');
    const before = (await api.get('/products/1')).body.data.current_stock;
    const draft = await api.post('/challans').send({ customerId: 1, items: [{ productId: 1, quantity: 4 }] });
    const res = await api.patch(`/challans/${draft.body.data.id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.data.challan.status).toBe('CANCELLED');
    expect(res.body.data.challan.cancelled_at).toBeTruthy();
    expect((await api.get('/products/1')).body.data.current_stock).toBe(before);
  });

  it('cancels a confirmed challan and restores stock with IN movements', async () => {
    await resetDb();
    const api = await auth('ADMIN');
    const confirmed = await api.post('/challans').send({ customerId: 1, status: 'CONFIRMED', items: [{ productId: 1, quantity: 4 }] });
    expect((await api.get('/products/1')).body.data.current_stock).toBe(16);
    const res = await api.patch(`/challans/${confirmed.body.data.id}/cancel`);
    expect(res.status).toBe(200);
    expect((await api.get('/products/1')).body.data.current_stock).toBe(20);
    const movements = await api.get('/products/1/movements');
    const reversal = movements.body.data.data[0];
    expect(reversal.movement_type).toBe('IN');
    expect(reversal.reason).toBe('Sales Challan Cancelled');
    expect(reversal.reference_id).toBe(confirmed.body.data.id);
  });

  it('rejects an empty challan and invalid quantities', async () => {
    await resetDb();
    const api = await auth('SALES');
    const empty = await api.post('/challans').send({ customerId: 1, items: [] });
    expect(empty.status).toBe(400);
    for (const quantity of [0, -2]) {
      const res = await api.post('/challans').send({ customerId: 1, items: [{ productId: 1, quantity }] });
      expect(res.status).toBe(400);
    }
  });

  it('returns 404 for a missing customer or product', async () => {
    await resetDb();
    const api = await auth('SALES');
    const noCustomer = await api.post('/challans').send({ customerId: 99999, items: [{ productId: 1, quantity: 1 }] });
    expect(noCustomer.status).toBe(404);
    const noProduct = await api.post('/challans').send({ customerId: 1, items: [{ productId: 99999, quantity: 1 }] });
    expect(noProduct.status).toBe(404);
  });

  it('lists challans with status filter and pagination', async () => {
    await resetDb();
    const api = await auth('ADMIN');
    await api.post('/challans').send({ customerId: 1, items: [{ productId: 1, quantity: 1 }] });
    await api.post('/challans').send({ customerId: 1, status: 'CONFIRMED', items: [{ productId: 1, quantity: 1 }] });
    await api.post('/challans').send({ customerId: 1, status: 'CONFIRMED', items: [{ productId: 1, quantity: 1 }] });
    const drafts = await api.get('/challans?status=DRAFT');
    expect(drafts.body.data.meta.total).toBe(1);
    const confirmed = await api.get('/challans?status=CONFIRMED');
    expect(confirmed.body.data.meta.total).toBe(2);
    const page = await api.get('/challans?limit=2');
    expect(page.body.data.meta.totalPages).toBe(2);
  });

  it('returns 404 for a missing challan', async () => {
    await resetDb();
    const api = await auth('ADMIN');
    const res = await api.get('/challans/99999');
    expect(res.status).toBe(404);
  });
});