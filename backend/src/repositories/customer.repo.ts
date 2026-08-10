import type { QueryResultRow } from 'pg';
import { query } from '../config/db.js';

export interface CustomerInput {
  name: string;
  mobile: string;
  email?: string | null;
  businessName?: string | null;
  gstNumber?: string | null;
  type: 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR';
  address?: string | null;
  status: 'LEAD' | 'ACTIVE' | 'INACTIVE';
  followUpDate?: string | null;
  notes?: string | null;
}

export interface ListCustomersParams {
  offset: number;
  limit: number;
  search?: string;
  type?: string;
  status?: string;
}

const SELECT = `
  SELECT c.*, u.name AS created_by_name
  FROM customers c
  LEFT JOIN users u ON u.id = c.created_by
`;

export async function list(params: ListCustomersParams): Promise<{ rows: QueryResultRow[]; total: number }> {
  const where: string[] = [];
  const values: unknown[] = [];

  if (params.search) {
    values.push(`%${params.search.toLowerCase()}%`);
    where.push(
      `(lower(c.name) LIKE $${values.length} OR lower(c.business_name) LIKE $${values.length} OR c.mobile LIKE $${values.length})`,
    );
  }
  if (params.type) {
    values.push(params.type);
    where.push(`c.type = $${values.length}`);
  }
  if (params.status) {
    values.push(params.status);
    where.push(`c.status = $${values.length}`);
  }

  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  values.push(params.limit);
  const limitIdx = values.length;
  values.push(params.offset);
  const offsetIdx = values.length;

  const { rows } = await query<QueryResultRow>(
    `${SELECT}${whereSql} ORDER BY c.id DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    values,
  );

  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM customers c${whereSql}`,
    values.slice(0, limitIdx - 1),
  );

  return { rows, total: Number(countResult.rows[0].total) };
}

export async function findById(id: number): Promise<QueryResultRow | undefined> {
  const result = await query<QueryResultRow>(`${SELECT} WHERE c.id = $1`, [id]);
  return result.rows[0];
}

export async function create(input: CustomerInput, createdBy: number): Promise<QueryResultRow> {
  const result = await query<QueryResultRow>(
    `INSERT INTO customers
       (name, mobile, email, business_name, gst_number, type, address, status, follow_up_date, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      input.name,
      input.mobile,
      input.email ?? null,
      input.businessName ?? null,
      input.gstNumber ?? null,
      input.type as string,
      input.address ?? null,
      input.status as string,
      input.followUpDate ?? null,
      input.notes ?? null,
      createdBy,
    ],
  );
  return result.rows[0];
}

export async function update(id: number, input: Partial<CustomerInput>): Promise<QueryResultRow | undefined> {
  const fields: string[] = [];
  const values: unknown[] = [];

  const fieldMap: Record<string, string> = {
    name: 'name',
    mobile: 'mobile',
    email: 'email',
    businessName: 'business_name',
    gstNumber: 'gst_number',
    type: 'type',
    address: 'address',
    status: 'status',
    followUpDate: 'follow_up_date',
    notes: 'notes',
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
    `UPDATE customers SET ${fields.join(', ')}, updated_at = now() WHERE id = $${values.length + 1} RETURNING *`,
    [...values, id],
  );
  return result.rows[0];
}

export async function addFollowup(
  customerId: number,
  notes: string,
  followUpDate: string | null,
  createdBy: number,
): Promise<QueryResultRow> {
  const result = await query<QueryResultRow>(
    `INSERT INTO customer_followups (customer_id, notes, follow_up_date, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [customerId, notes, followUpDate, createdBy],
  );
  return result.rows[0];
}

export async function listFollowups(customerId: number): Promise<QueryResultRow[]> {
  const result = await query<QueryResultRow>(
    `SELECT f.*, u.name AS created_by_name
     FROM customer_followups f
     LEFT JOIN users u ON u.id = f.created_by
     WHERE f.customer_id = $1
     ORDER BY f.created_at DESC`,
    [customerId],
  );
  return result.rows;
}