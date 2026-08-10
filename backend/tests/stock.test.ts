import { describe, expect, it } from 'vitest';
import { auth, resetDb } from './helpers.js';

describe('STOCK', () => {
  it('records an IN movement and increases stock', async () => {
    await resetDb();
    const api = await auth('WAREHOUSE');
    const res = await api.post('/products/2/stock').send({ type: 'IN', quantity: 15, reason: 'Supplier restock' });
    expect(res.status).toBe(200);
    expect(res.body.data.current_stock).toBe(25);

    const movements = await api.get('/products/2/movements');
    expect(movements.body.data.data[0]).toMatchObject({ quantity_changed: 15, movement_type: 'IN', reason: 'Supplier restock' });
  });

  it('records an OUT movement and decreases stock', async () => {
    await resetDb();
    const api = await auth('WAREHOUSE');
    const res = await api.post('/products/1/stock').send({ type: 'OUT', quantity: 5, reason: 'Damaged goods' });
    expect(res.status).toBe(200);
    expect(res.body.data.current_stock).toBe(15);
  });

  it('rejects OUT when stock is insufficient', async () => {
    await resetDb();
    const api = await auth('WAREHOUSE');
    const res = await api.post('/products/1/stock').send({ type: 'OUT', quantity: 25, reason: 'Too much' });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/insufficient stock/i);
  });

  it('rejects zero and negative quantities', async () => {
    await resetDb();
    const api = await auth('WAREHOUSE');
    for (const quantity of [0, -5]) {
      const res = await api.post('/products/1/stock').send({ type: 'IN', quantity, reason: 'Bad qty' });
      expect(res.status).toBe(400);
    }
  });

  it('rejects an invalid movement type', async () => {
    await resetDb();
    const api = await auth('WAREHOUSE');
    const res = await api.post('/products/1/stock').send({ type: 'SIDE', quantity: 1, reason: 'Bad type' });
    expect(res.status).toBe(400);
  });

  it('does not leave partial state when an OUT on a zero-stock product fails', async () => {
    await resetDb();
    const api = await auth('WAREHOUSE');
    const res = await api.post('/products/3/stock').send({ type: 'OUT', quantity: 2, reason: 'Impossible' });
    expect(res.status).toBe(409);
    const get = await api.get('/products/3');
    expect(get.body.data.current_stock).toBe(0);
  });

  it('paginates the movement history', async () => {
    await resetDb();
    const api = await auth('WAREHOUSE');
    await api.post('/products/1/stock').send({ type: 'IN', quantity: 1, reason: 'Fill 1' });
    await api.post('/products/1/stock').send({ type: 'IN', quantity: 2, reason: 'Fill 2' });
    await api.post('/products/1/stock').send({ type: 'IN', quantity: 3, reason: 'Fill 3' });
    const res = await api.get('/products/1/movements?limit=2');
    expect(res.body.data.meta.total).toBe(3);
    expect(res.body.data.meta.totalPages).toBe(2);
    expect(res.body.data.data).toHaveLength(2);
  });
});