import type { QueryResultRow } from 'pg';
import type { Queryable } from '../config/db.js';

export interface ChallanRecord extends QueryResultRow {
  id: number;
  challan_number: string;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  created_by: number | null;
  total_quantity: number;
}

export interface ChallanItemRecord extends QueryResultRow {
  id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  unit_price: string;
  quantity: number;
}

export interface ChallanItemInput {
  productId: number;
  productName: string;
  productSku: string;
  unitPrice: number;
  quantity: number;
}

export interface ListChallansParams {
  offset: number;
  limit: number;
  status?: string;
  customerId?: number;
  search?: string;
}

export class ChallanRepository {
  constructor(private readonly db: Queryable) {}

  private static readonly LIST_SELECT = `
    SELECT ch.*, c.name AS customer_name, c.business_name AS customer_business_name,
           u.name AS created_by_name
    FROM challans ch
    LEFT JOIN customers c ON c.id = ch.customer_id
    LEFT JOIN users u ON u.id = ch.created_by
  `;

  async list(params: ListChallansParams): Promise<{ rows: QueryResultRow[]; total: number }> {
    const where: string[] = [];
    const values: unknown[] = [];

    if (params.status) {
      values.push(params.status);
      where.push(`ch.status = $${values.length}`);
    }
    if (params.customerId) {
      values.push(params.customerId);
      where.push(`ch.customer_id = $${values.length}`);
    }
    if (params.search) {
      values.push(`%${params.search.toLowerCase()}%`);
      where.push(
        `(lower(ch.challan_number) LIKE $${values.length} OR lower(c.name) LIKE $${values.length} OR lower(c.business_name) LIKE $${values.length})`,
      );
    }

    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    values.push(params.limit, params.offset);

    const { rows } = await this.db.query<QueryResultRow>(
      `${ChallanRepository.LIST_SELECT}${whereSql} ORDER BY ch.id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    const { rows: countRows } = await this.db.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM challans ch${whereSql}`,
      values.slice(0, -2),
    );
    return { rows, total: Number(countRows[0].total) };
  }

  async findItems(challanId: number, db?: Queryable): Promise<ChallanItemRecord[]> {
    const target = db ?? this.db;
    const { rows } = await target.query<ChallanItemRecord>(
      'SELECT * FROM challan_items WHERE challan_id = $1 ORDER BY id ASC',
      [challanId],
    );
    return rows;
  }

  async findById(id: number): Promise<{ challan: QueryResultRow | undefined; items: QueryResultRow[] }> {
    const { rows } = await this.db.query<QueryResultRow>(`${ChallanRepository.LIST_SELECT} WHERE ch.id = $1`, [id]);
    const challan = rows[0];
    if (!challan) return { challan: undefined, items: [] };
    const items = await this.findItems(id);
    return { challan, items };
  }

  async findByIdWithLock(id: number, db: Queryable): Promise<ChallanRecord | undefined> {
    const { rows } = await db.query<ChallanRecord>('SELECT * FROM challans WHERE id = $1 FOR UPDATE', [id]);
    return rows[0];
  }

  async create(
    input: { customerId: number; totalQuantity: number; status: 'DRAFT' | 'CONFIRMED'; remarks: string | null },
    items: ChallanItemInput[],
    createdBy: number,
    db?: Queryable,
  ): Promise<QueryResultRow> {
    const target = db ?? this.db;
    const { rows } = await target.query<QueryResultRow>(
      `INSERT INTO challans (challan_number, customer_id, total_quantity, status, remarks, confirmed_at, created_by)
       VALUES (
         'CHL-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('challan_number_seq')::text, 6, '0'),
         $1, $2, $3::challan_status, $4, CASE WHEN $3::text = 'CONFIRMED' THEN now() ELSE NULL END, $5
       )
       RETURNING *`,
      [input.customerId, input.totalQuantity, input.status, input.remarks, createdBy],
    );
    const challan = rows[0];

    for (const item of items) {
      await target.query(
        `INSERT INTO challan_items (challan_id, product_id, product_name, product_sku, unit_price, quantity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [challan.id, item.productId, item.productName, item.productSku, item.unitPrice, item.quantity],
      );
    }

    return challan;
  }

  async updateStatus(id: number, status: 'CONFIRMED' | 'CANCELLED', db?: Queryable): Promise<QueryResultRow | undefined> {
    const target = db ?? this.db;
    const { rows } = await target.query<QueryResultRow>(
      `UPDATE challans
       SET status = $2::challan_status,
           confirmed_at = CASE WHEN $2::text = 'CONFIRMED' THEN now() ELSE confirmed_at END,
           cancelled_at = CASE WHEN $2::text = 'CANCELLED' THEN now() ELSE cancelled_at END,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, status],
    );
    return rows[0];
  }
}