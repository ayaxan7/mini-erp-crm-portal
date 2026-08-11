import type { Queryable } from '../config/db.js';
import type { Role } from '../types/index.js';

export type AccessRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AccessRequestRow {
  id: number;
  name: string;
  email: string;
  role: Role;
  message: string | null;
  status: AccessRequestStatus;
  review_note: string | null;
  reviewed_by: number | null;
  reviewed_at: Date | string | null;
  created_at: Date | string;
  reviewer_name: string | null;
}

export interface AccessRequestListFilters {
  status?: AccessRequestStatus;
  offset: number;
  limit: number;
}

export class AccessRequestRepository {
  constructor(private readonly db: Queryable) {}

  async create(input: { name: string; email: string; role: Role; message: string | null }): Promise<AccessRequestRow> {
    const { rows } = await this.db.query<AccessRequestRow>(
      `INSERT INTO access_requests (name, email, role, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.name, input.email, input.role, input.message],
    );
    return rows[0];
  }

  async findPendingByEmail(email: string): Promise<AccessRequestRow | undefined> {
    const { rows } = await this.db.query<AccessRequestRow>(
      `SELECT * FROM access_requests
       WHERE status = 'PENDING' AND lower(email) = lower($1)
       LIMIT 1`,
      [email],
    );
    return rows[0];
  }

  async findById(id: number, db: Queryable = this.db): Promise<AccessRequestRow | undefined> {
    const { rows } = await db.query<AccessRequestRow>(
      `SELECT ar.*, u.name AS reviewer_name
       FROM access_requests ar
       LEFT JOIN users u ON u.id = ar.reviewed_by
       WHERE ar.id = $1`,
      [id],
    );
    return rows[0];
  }

  async list(filters: AccessRequestListFilters): Promise<{ data: AccessRequestRow[]; total: number }> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filters.status) {
      params.push(filters.status);
      where.push(`ar.status = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    params.push(filters.limit, filters.offset);
    const { rows } = await this.db.query<AccessRequestRow>(
      `SELECT ar.*, u.name AS reviewer_name
       FROM access_requests ar
       LEFT JOIN users u ON u.id = ar.reviewed_by
       ${whereSql}
       ORDER BY
         CASE ar.status WHEN 'PENDING' THEN 0 ELSE 1 END,
         ar.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const countParams = params.slice(0, params.length - 2);
    const { rows: countRows } = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::int AS total FROM access_requests ar ${whereSql}`,
      countParams,
    );

    return { data: rows, total: Number(countRows[0]?.total ?? 0) };
  }

  async updateStatus(
    id: number,
    status: AccessRequestStatus,
    reviewedBy: number,
    db: Queryable = this.db,
    reviewNote: string | null = null,
  ): Promise<AccessRequestRow | undefined> {
    const { rows } = await db.query<AccessRequestRow>(
      `UPDATE access_requests
       SET status = $2, reviewed_by = $3, reviewed_at = now(), review_note = $4
       WHERE id = $1
       RETURNING *`,
      [id, status, reviewedBy, reviewNote],
    );
    return rows[0];
  }
}
