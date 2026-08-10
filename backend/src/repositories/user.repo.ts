import { query } from '../config/db.js';
import type { UserRow } from '../types/db.js';

export async function findByEmail(email: string): Promise<UserRow | undefined> {
  const result = await query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0];
}

export async function findById(id: number): Promise<UserRow | undefined> {
  const result = await query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
}