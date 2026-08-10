import type { QueryResultRow } from 'pg';
import { query } from '../config/db.js';

export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
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

const LIST_SELECT = `
  SELECT ch.*, c.name AS customer_name, c.business_name AS customer_business_name,
         u.name AS created_by_name
  FROM challans ch
  LEFT JOIN customers c ON c.id = ch.customer_id
  LEFT JOIN users u ON u.id = ch.created_by
`;

export async function list(params: ListChallansParams): Promise<{ rows: QueryResultRow[]; total: number }> {
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

  values.push(params.limit);
  const limitIdx = values.length;
  values.push(params.offset);
  const offsetIdx = values.length;

  const { rows } = await query<QueryResultRow>(
    `${LIST_SELECT}${whereSql} ORDER BY ch.id DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    values,
  );

  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM challans ch${whereSql}`,
    values.slice(0, limitIdx - 1),
  );

  return { rows, total: Number(countResult.rows[0].total) };
}

export async function findItems(challanId: number, db: Queryable = { query }): Promise<QueryResultRow[]> {
  const { rows } = await db.query<QueryResultRow>(
    `SELECT * FROM challan_items WHERE challan_id = $1 ORDER BY id ASC`,
    [challanId],
  );
  return rows;
}

export async function findById(id: number): Promise<{ challan: QueryResultRow | undefined; items: QueryResultRow[] }> {
  const result = await query<QueryResultRow>(`${LIST_SELECT} WHERE ch.id = $1`, [id]);
  const challan = result.rows[0];
  if (!challan) return { challan: undefined, items: [] };
  const items = await findItems(id);
  return { challan, items };
}

export async function create(
  input: {
    customerId: number;
    totalQuantity: number;
    status: 'DRAFT' | 'CONFIRMED';
    remarks?: string | null;
  },
  items: ChallanItemInput[],
  createdBy: number,
  db: Queryable = { query },
): Promise<QueryResultRow> {
  const result = await db.query<QueryResultRow>(
    `INSERT INTO challans (challan_number, customer_id, total_quantity, status, remarks, confirmed_at, created_by)
     VALUES (
       'CHL-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('challan_number_seq')::text, 6, '0'),
       $1, $2, $3::challan_status, $4, CASE WHEN $3 = 'CONFIRMED' THEN now() ELSE NULL END, $5
     )
     RETURNING *`,
    [input.customerId, input.totalQuantity, input.status, input.remarks ?? null, createdBy],
  );
  const challan = result.rows[0];

  for (const item of items) {
    await db.query(
      `INSERT INTO challan_items (challan_id, product_id, product_name, product_sku, unit_price, quantity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [challan.id, item.productId, item.productName, item.productSku, item.unitPrice, item.quantity],
    );
  }

  return challan;
}

export async function updateStatus(
  id: number,
  status: 'CONFIRMED' | 'CANCELLED',
  db: Queryable = { query },
): Promise<QueryResultRow | undefined> {
  const result = await db.query<QueryResultRow>(
    `UPDATE challans
     SET status = $2,
         confirmed_at = CASE WHEN $2 = 'CONFIRMED' THEN now() ELSE confirmed_at END,
         cancelled_at = CASE WHEN $2 = 'CANCELLED' THEN now() ELSE cancelled_at END,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, status],
  );
  return result.rows[0];
}

export async function findByIdWithLock(id: number, db: Queryable): Promise<QueryResultRow | undefined> {
  const result = await db.query<QueryResultRow>(`SELECT * FROM challans WHERE id = $1 FOR UPDATE`, [id]);
  return result.rows[0];
}