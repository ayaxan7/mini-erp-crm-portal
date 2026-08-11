import type { Queryable } from '../config/db.js';
import type { UserRow } from '../types/db.js';
import type { Role } from '../types/index.js';

export class UserRepository {
  constructor(private readonly db: Queryable) {}

  async findByEmail(email: string, db: Queryable = this.db): Promise<UserRow | undefined> {
    const { rows } = await db.query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0];
  }

  async create(
    input: { name: string; email: string; passwordHash: string; role: Role },
    db: Queryable = this.db,
  ): Promise<UserRow> {
    const { rows } = await db.query<UserRow>(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.name, input.email, input.passwordHash, input.role],
    );
    return rows[0];
  }
}
