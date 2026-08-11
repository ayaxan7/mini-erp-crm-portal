import type { QueryResultRow } from 'pg';
import type { Queryable } from '../config/db.js';
import type { CreateProductInput, UpdateProductInput } from '../validation/product.schema.js';

export interface ListProductsParams {
  offset: number;
  limit: number;
  search?: string;
  category?: string;
  lowStock?: boolean;
}

export class ProductRepository {
  constructor(private readonly db: Queryable) {}

  private static readonly SELECT = `
    SELECT p.*, u.name AS created_by_name,
           (p.current_stock <= p.min_stock) AS is_low_stock
    FROM products p
    LEFT JOIN users u ON u.id = p.created_by
  `;

  private buildWhere(params: ListProductsParams): { sql: string; values: unknown[] } {
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

    return { sql: where.length ? ` WHERE ${where.join(' AND ')}` : '', values };
  }

  async list(params: ListProductsParams): Promise<{ rows: QueryResultRow[]; total: number }> {
    const { sql, values } = this.buildWhere(params);
    values.push(params.limit, params.offset);
    const { rows } = await this.db.query<QueryResultRow>(
      `${ProductRepository.SELECT}${sql} ORDER BY p.id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    const { rows: countRows } = await this.db.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM products p${sql}`,
      values.slice(0, -2),
    );
    return { rows, total: Number(countRows[0].total) };
  }

  async findById(id: number): Promise<QueryResultRow | undefined> {
    const { rows } = await this.db.query<QueryResultRow>(`${ProductRepository.SELECT} WHERE p.id = $1`, [id]);
    return rows[0];
  }

  async findBySku(sku: string): Promise<QueryResultRow | undefined> {
    const { rows } = await this.db.query<QueryResultRow>('SELECT * FROM products WHERE lower(sku) = lower($1)', [sku]);
    return rows[0];
  }

  async create(input: CreateProductInput, createdBy: number): Promise<QueryResultRow> {
    const { rows } = await this.db.query<QueryResultRow>(
      `INSERT INTO products (name, sku, category, unit_price, current_stock, min_stock, location, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.name,
        input.sku,
        input.category,
        input.unitPrice,
        input.currentStock ?? 0,
        input.minStock ?? 0,
        input.location,
        createdBy,
      ],
    );
    return rows[0];
  }

  async update(id: number, input: UpdateProductInput): Promise<QueryResultRow | undefined> {
    const setters: string[] = [];
    const values: unknown[] = [];

    const columns: Record<string, string> = {
      name: 'name',
      sku: 'sku',
      category: 'category',
      unitPrice: 'unit_price',
      minStock: 'min_stock',
      location: 'location',
    };

    for (const [key, column] of Object.entries(columns)) {
      const value = input[key as keyof UpdateProductInput];
      if (value !== undefined) {
        values.push(value as string | number | null);
        setters.push(`${column} = $${values.length}`);
      }
    }

    if (setters.length === 0) return undefined;

    const { rows } = await this.db.query<QueryResultRow>(
      `UPDATE products SET ${setters.join(', ')}, updated_at = now() WHERE id = $${values.length + 1} RETURNING *`,
      [...values, id],
    );
    return rows[0];
  }

  async setImage(id: number, imageUrl: string): Promise<QueryResultRow | undefined> {
    const { rows } = await this.db.query<QueryResultRow>(
      'UPDATE products SET image_url = $2, updated_at = now() WHERE id = $1 RETURNING *',
      [id, imageUrl],
    );
    return rows[0];
  }

  async findManyByIds(ids: number[]): Promise<QueryResultRow[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
    const { rows } = await this.db.query<QueryResultRow>(`SELECT * FROM products WHERE id IN (${placeholders})`, ids);
    return rows;
  }

  async lockByIds(ids: number[], db: Queryable | undefined): Promise<QueryResultRow[]> {
    const target = db ?? this.db;
    if (ids.length === 0) return [];
    const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
    const { rows } = await target.query<QueryResultRow>(
      `SELECT id, name, current_stock FROM products WHERE id IN (${placeholders}) FOR UPDATE`,
      ids,
    );
    return rows;
  }

  async adjustStock(id: number, delta: number, db: Queryable | undefined): Promise<void> {
    const target = db ?? this.db;
    await target.query('UPDATE products SET current_stock = current_stock + $2, updated_at = now() WHERE id = $1', [
      id,
      delta,
    ]);
  }
}