import type { Queryable } from '../config/db.js';

export interface DashboardSummary {
  customers: { total: number; active: number; leads: number; overdueFollowups: number };
  products: { total: number; lowStock: number; stockValue: number };
  challans: { total: number; drafts: number; confirmed: number; cancelled: number };
  monthlyChallans: { label: string; count: number }[];
  recentChallans: { id: number; challan_number: string; customer_name: string; status: string; total_quantity: number; created_at: Date }[];
  lowStockProducts: { id: number; name: string; sku: string; current_stock: number; min_stock: number }[];
}

export class DashboardRepository {
  constructor(private readonly db: Queryable) {}

  async getSummary(): Promise<DashboardSummary> {
    const [
      customers,
      productStats,
      lowStock,
      challanStats,
      monthly,
      recent,
      lowStockProducts,
    ] = await Promise.all([
      this.db.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
                COUNT(*) FILTER (WHERE status = 'LEAD')::int AS leads,
                COUNT(*) FILTER (WHERE follow_up_date IS NOT NULL AND follow_up_date <= CURRENT_DATE)::int AS overdue_followups
         FROM customers`,
      ),
      this.db.query(
        `SELECT COUNT(*)::int AS total,
                COALESCE(SUM(current_stock * unit_price), 0)::numeric AS stock_value
         FROM products`,
      ),
      this.db.query(`SELECT COUNT(*)::int AS total FROM products WHERE current_stock <= min_stock`),
      this.db.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'DRAFT')::int AS drafts,
                COUNT(*) FILTER (WHERE status = 'CONFIRMED')::int AS confirmed,
                COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled
         FROM challans`,
      ),
      this.db.query(
        `SELECT to_char(DATE_TRUNC('month', created_at), 'Mon') AS label, COUNT(*)::int AS count
         FROM challans
         WHERE created_at >= now() - interval '5 months'
         GROUP BY DATE_TRUNC('month', created_at)
         ORDER BY DATE_TRUNC('month', created_at)`,
      ),
      this.db.query(
        `SELECT ch.id, ch.challan_number, c.name AS customer_name, ch.status,
                ch.total_quantity, ch.created_at
         FROM challans ch
         LEFT JOIN customers c ON c.id = ch.customer_id
         ORDER BY ch.created_at DESC
         LIMIT 6`,
      ),
      this.db.query(
        `SELECT id, name, sku, current_stock, min_stock FROM products
         WHERE current_stock <= min_stock
         ORDER BY (current_stock::float / NULLIF(min_stock, 0)) ASC
         LIMIT 6`,
      ),
    ]);

    return {
      customers: {
        total: customers.rows[0]?.total ?? 0,
        active: customers.rows[0]?.active ?? 0,
        leads: customers.rows[0]?.leads ?? 0,
        overdueFollowups: customers.rows[0]?.overdue_followups ?? 0,
      },
      products: {
        total: productStats.rows[0]?.total ?? 0,
        lowStock: lowStock.rows[0]?.total ?? 0,
        stockValue: Number(productStats.rows[0]?.stock_value ?? 0),
      },
      challans: {
        total: challanStats.rows[0]?.total ?? 0,
        drafts: challanStats.rows[0]?.drafts ?? 0,
        confirmed: challanStats.rows[0]?.confirmed ?? 0,
        cancelled: challanStats.rows[0]?.cancelled ?? 0,
      },
      monthlyChallans: monthly.rows.map((row) => ({ label: row.label as string, count: row.count as number })),
      recentChallans: recent.rows as DashboardSummary['recentChallans'],
      lowStockProducts: lowStockProducts.rows as DashboardSummary['lowStockProducts'],
    };
  }
}