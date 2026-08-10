import type pg from 'pg';

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: 'ADMIN' | 'SALES' | 'WAREHOUSE' | 'ACCOUNTS';
  created_at: Date | string;
  updated_at: Date | string;
}

export type CustomerRow = pg.QueryResultRow;
export type CustomerFollowupRow = pg.QueryResultRow;
export type ProductRow = pg.QueryResultRow;
export type StockMovementRow = pg.QueryResultRow;
export type ChallanRow = pg.QueryResultRow;
export type ChallanItemRow = pg.QueryResultRow;
export type DashboardRow = pg.QueryResultRow;