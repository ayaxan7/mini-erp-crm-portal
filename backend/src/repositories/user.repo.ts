import type { Queryable } from '../config/db.js';
import type { UserRow } from '../types/db.js';

export class UserRepository {
  constructor(private readonly db: Queryable) {}

  async findByEmail(email: string): Promise<UserRow | undefined> {
    const { rows } = await this.db.query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0];
  }
}