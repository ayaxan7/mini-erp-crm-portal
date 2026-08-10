import type { QueryResultRow } from 'pg';
import type { Queryable } from '../config/db.js';
import type { CreateCustomerInput, UpdateCustomerInput } from '../validation/customer.schema.js';

export interface ListCustomersParams {
  offset: number;
  limit: number;
  search?: string;
  type?: string;
  status?: string;
}

export class CustomerRepository {
  constructor(private readonly db: Queryable) {}

  private static readonly SELECT = `
    SELECT c.*, u.name AS created_by_name
    FROM customers c
    LEFT JOIN users u ON u.id = c.created_by
  `;

  private buildWhere(params: ListCustomersParams): { sql: string; values: unknown[] } {
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

    return { sql: where.length ? ` WHERE ${where.join(' AND ')}` : '', values };
  }

  async list(params: ListCustomersParams): Promise<{ rows: QueryResultRow[]; total: number }> {
    const { sql, values } = this.buildWhere(params);
    values.push(params.limit, params.offset);
    const { rows } = await this.db.query<QueryResultRow>(
      `${CustomerRepository.SELECT}${sql} ORDER BY c.id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    const { rows: countRows } = await this.db.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM customers c${sql}`,
      values.slice(0, -2),
    );
    return { rows, total: Number(countRows[0].total) };
  }

  async findById(id: number): Promise<QueryResultRow | undefined> {
    const { rows } = await this.db.query<QueryResultRow>(`${CustomerRepository.SELECT} WHERE c.id = $1`, [id]);
    return rows[0];
  }

  async create(input: CreateCustomerInput, createdBy: number): Promise<QueryResultRow> {
    const { rows } = await this.db.query<QueryResultRow>(
      `INSERT INTO customers
        (name, mobile, email, business_name, gst_number, type, address, status, follow_up_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        input.name,
        input.mobile,
        input.email,
        input.businessName,
        input.gstNumber,
        input.type,
        input.address,
        input.status,
        input.followUpDate,
        input.notes,
        createdBy,
      ],
    );
    return rows[0];
  }

  async update(id: number, input: UpdateCustomerInput): Promise<QueryResultRow | undefined> {
    const setters: string[] = [];
    const values: unknown[] = [];

    const columns: Record<string, string> = {
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

    for (const [key, column] of Object.entries(columns)) {
      const value = input[key as keyof UpdateCustomerInput];
      if (value !== undefined) {
        values.push(value as string | number | Date | null);
        setters.push(`${column} = $${values.length}`);
      }
    }

    if (setters.length === 0) return undefined;

    const { rows } = await this.db.query<QueryResultRow>(
      `UPDATE customers SET ${setters.join(', ')}, updated_at = now() WHERE id = $${values.length + 1} RETURNING *`,
      [...values, id],
    );
    return rows[0];
  }

  async addFollowup(customerId: number, notes: string, followUpDate: string | null, createdBy: number): Promise<QueryResultRow> {
    const { rows } = await this.db.query<QueryResultRow>(
      `INSERT INTO customer_followups (customer_id, notes, follow_up_date, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [customerId, notes, followUpDate, createdBy],
    );
    return rows[0];
  }

  async listFollowups(customerId: number): Promise<QueryResultRow[]> {
    const { rows } = await this.db.query<QueryResultRow>(
      `SELECT f.*, u.name AS created_by_name
       FROM customer_followups f
       LEFT JOIN users u ON u.id = f.created_by
       WHERE f.customer_id = $1
       ORDER BY f.created_at DESC`,
      [customerId],
    );
    return rows;
  }
}