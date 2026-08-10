import type { QueryResultRow } from 'pg';
import { query } from '../config/db.js';

export interface ListMovementsParams {
  offset: number;
  limit: number;
  productId?: number;
}

export async function insertMovement(input: {
  productId: number;
  quantityChanged: number;
  movementType: 'IN' | 'OUT';
  reason: string;
  referenceType?: string | null;
  referenceId?: number | null;
  createdBy: number;
}): Promise<QueryResultRow> {
  const result = await query<QueryResultRow>(
    `INSERT INTO stock_movements (product_id, quantity_changed, movement_type, reason, reference_type, reference_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.productId,
      input.quantityChanged,
      input.movementType,
      input.reason,
      input.referenceType ?? null,
      input.referenceId ?? null,
      input.createdBy,
    ],
  );
  return result.rows[0];
}

export async function listByProduct(
  productId: number,
  params: ListMovementsParams,
): Promise<{ rows: QueryResultRow[]; total: number }> {
  const values: unknown[] = [productId, params.limit, params.offset];
  const { rows } = await query<QueryResultRow>(
    `SELECT m.*, u.name AS created_by_name
     FROM stock_movements m
     LEFT JOIN users u ON u.id = m.created_by
     WHERE m.product_id = $1
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT $2 OFFSET $3`,
    values,
  );
  const countResult = await query<{ total: string }>(
    'SELECT COUNT(*) AS total FROM stock_movements WHERE product_id = $1',
    [productId],
  );
  return { rows, total: Number(countResult.rows[0].total) };
}

export async function listAll(params: ListMovementsParams): Promise<{ rows: QueryResultRow[]; total: number }> {
  const where = params.productId ? 'WHERE m.product_id = $1' : '';
  const conditionParams = params.productId ? [params.productId] : [];
  const { rows } = await query<QueryResultRow>(
    `SELECT m.*, u.name AS created_by_name, p.name AS product_name, p.sku AS product_sku
     FROM stock_movements m
     LEFT JOIN users u ON u.id = m.created_by
     LEFT JOIN products p ON p.id = m.product_id
     ${where}
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT $${conditionParams.length + 1} OFFSET $${conditionParams.length + 2}`,
    [...conditionParams, params.limit, params.offset],
  );
  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM stock_movements m ${where}`,
    conditionParams,
  );
  return { rows, total: Number(countResult.rows[0].total) };
}