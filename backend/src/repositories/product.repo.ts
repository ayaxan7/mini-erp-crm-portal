import type { QueryResultRow } from 'pg';
import { query } from '../config/db.js';

export interface ProductInput {
  name: string;
  sku: string;
  category?: string | null;
  unitPrice: number;
  currentStock?: number;
  minStock?: number;
  location?: string | null;
}

export interface ListProductsParams {
  offset: number;
  limit: number;
  search?: string;
  category?: string;
  lowStock?: boolean;
}

const SELECT = `
  SELECT p.*, u.name AS created_by_name,
         (p.current_stock <= p.min_stock) AS is_low_stock
  FROM products p
  LEFT JOIN users u ON u.id = p.created_by
`;

export async function list(params: ListProductsParams): Promise<{ rows: QueryResultRow[]; total: number }> {
  const where: string[] = [];
  const values: unknown[] = [];

  if (params.search) {
    values.push(`%${params.search.toLowerCase()}%`);
    where.push(`(lower(p.name) LIKE $${values.length} OR lower(p.sku) LIKE $${values.length})`);
  }
  if (params.category) {
    values.push(params.category.toLowerCase());
    where.push(`lower(p.category) = $${values.length}`);
  }
  if (params.lowStock) {
    where.push('p.current_stock <= p.min_stock');
  }

  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  values.push(params.limit);
  const limitIdx = values.length;
  values.push(params.offset);
  const offsetIdx = values.length;

  const { rows } = await query<QueryResultRow>(
    `${SELECT}${whereSql} ORDER BY p.id DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    values,
  );

  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM products p${whereSql}`,
    values.slice(0, limitIdx - 1),
  );

  return { rows, total: Number(countResult.rows[0].total) };
}

export async function findById(id: number): Promise<QueryResultRow | undefined> {
  const result = await query<QueryResultRow>(`${SELECT} WHERE p.id = $1`, [id]);
  return result.rows[0];
}

export async function findBySku(sku: string): Promise<QueryResultRow | undefined> {
  const result = await query<QueryResultRow>('SELECT * FROM products WHERE lower(sku) = lower($1)', [sku]);
  return result.rows[0];
}

export async function create(input: ProductInput, createdBy: number): Promise<QueryResultRow> {
  const result = await query<QueryResultRow>(
    `INSERT INTO products (name, sku, category, unit_price, current_stock, min_stock, location, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.name,
      input.sku,
      input.category ?? 'General',
      input.unitPrice,
      input.currentStock ?? 0,
      input.minStock ?? 0,
      input.location ?? null,
      createdBy,
    ],
  );
  return result.rows[0];
}

export async function update(id: number, input: Partial<ProductInput>): Promise<QueryResultRow | undefined> {
  const fields: string[] = [];
  const values: unknown[] = [];

  const fieldMap: Record<string, string> = {
    name: 'name',
    sku: 'sku',
    category: 'category',
    unitPrice: 'unit_price',
    minStock: 'min_stock',
    location: 'location',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    const value = (input as Record<string, unknown>)[key];
    if (value !== undefined) {
      values.push(value ?? null);
      fields.push(`${column} = $${values.length}`);
    }
  }

  if (fields.length === 0) return undefined;

  const result = await query<QueryResultRow>(
    `UPDATE products SET ${fields.join(', ')}, updated_at = now() WHERE id = $${values.length + 1} RETURNING *`,
    [...values, id],
  );
  return result.rows[0];
}