import type { QueryResultRow } from 'pg';
import type { Queryable } from '../config/db.js';
import type { Role } from '../types/index.js';
import type { UserRow } from '../types/db.js';

export interface ListUsersParams {
  offset: number;
  limit: number;
  search?: string;
}

export class UserRepository {
  constructor(private readonly db: Queryable) {}

  async findByFirebaseUid(firebaseUid: string): Promise<UserRow | undefined> {
    const { rows } = await this.db.query<UserRow>('SELECT * FROM users WHERE firebase_uid = $1', [firebaseUid]);
    return rows[0];
  }

  async findById(id: number): Promise<UserRow | undefined> {
    const { rows } = await this.db.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0];
  }

  async count(): Promise<number> {
    const { rows } = await this.db.query<{ total: string }>('SELECT COUNT(*) AS total FROM users');
    return Number(rows[0].total);
  }

  async create(input: { firebaseUid: string; name: string; email: string; role: Role }): Promise<UserRow> {
    const { rows } = await this.db.query<UserRow>(
      `INSERT INTO users (firebase_uid, name, email, role)
       VALUES ($1, $2, $3, $4::user_role)
       RETURNING *`,
      [input.firebaseUid, input.name, input.email, input.role],
    );
    return rows[0];
  }

  async list(params: ListUsersParams): Promise<{ rows: QueryResultRow[]; total: number }> {
    const where: string[] = [];
    const values: unknown[] = [];
    if (params.search) {
      values.push(`%${params.search.toLowerCase()}%`);
      where.push(`(lower(name) LIKE $${values.length} OR lower(email) LIKE $${values.length})`);
    }
    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    values.push(params.limit, params.offset);

    const { rows } = await this.db.query<QueryResultRow>(
      `SELECT id, name, email, role, created_at FROM users${whereSql}
       ORDER BY created_at ASC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    const { rows: countRows } = await this.db.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM users${whereSql}`,
      values.slice(0, -2),
    );
    return { rows, total: Number(countRows[0].total) };
  }

  async updateRole(id: number, role: Role): Promise<UserRow | undefined> {
    const { rows } = await this.db.query<UserRow>(
      `UPDATE users SET role = $2::user_role, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, role],
    );
    return rows[0];
  }
}