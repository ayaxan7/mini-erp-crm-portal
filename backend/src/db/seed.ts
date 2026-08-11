import bcrypt from 'bcryptjs';
import type { QueryResultRow } from 'pg';
import { pool } from '../config/db.js';

interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'SALES' | 'WAREHOUSE' | 'ACCOUNTS';
}

export const SEED_USERS: SeedUser[] = [
  { name: 'Admin User', email: 'admin@crmportal.dev', password: 'Admin@123', role: 'ADMIN' },
  { name: 'Ravi Kumar', email: 'sales@crmportal.dev', password: 'Sales@123', role: 'SALES' },
  { name: 'Manoj Shah', email: 'warehouse@crmportal.dev', password: 'Warehouse@123', role: 'WAREHOUSE' },
  { name: 'Priya Nair', email: 'accounts@crmportal.dev', password: 'Accounts@123', role: 'ACCOUNTS' },
];

export async function seedUsers(): Promise<void> {
  for (const u of SEED_USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [u.name, u.email, hash, u.role],
    );
  }
}

export async function seedCustomers(count: { rows: QueryResultRow[] } | undefined): Promise<void> {
  const sample = [
    ['Siddharth Traders', '9812345670', 'siddharth.traders@gmail.com', 'Siddharth & Sons', '27AABCZ1234F1Z5', 'WHOLESALE', 'Mumbai, MH', 'ACTIVE'],
    ['Green Farms Foods', '9820098200', 'hello@greenfarms.in', 'Green Farms Pvt Ltd', '24AAACG2345F1Z2', 'DISTRIBUTOR', 'Pune, MH', 'ACTIVE'],
    ['Urban Mart', '9988776655', 'accounts@urbanmart.in', 'Urban Mart Retail', '', 'RETAIL', 'Thane, MH', 'ACTIVE'],
    ['Navratna Agencies', '9765432109', 'navratna.agency@gmail.com', 'Navratna Agencies', '06AADCN8976K1ZM', 'DISTRIBUTOR', 'Mumbai, MH', 'INACTIVE'],
    ['Krishna Provision Store', '8877665544', '', 'Krishna Store', '', 'RETAIL', 'Navi Mumbai, MH', 'LEAD'],
    ['Bombay Bazaar Group', '9000001111', 'contact@bazaar.co.in', 'Bombay Bazaar', '09AABCB0000Q1Z8', 'WHOLESALE', 'Mumbai, MH', 'ACTIVE'],
    ['Wellness Mart', '9811112222', 'buy@wellnessmart.in', 'Wellness Mart Pvt Ltd', '33AAWCW1234H1Z4', 'RETAIL', 'Nagpur, MH', 'LEAD'],
    ['Shree Ganesh Agencies', '9700000000', 'sg.agencies@gmail.com', 'Shree Ganesh', '21AASGA0000P1Z1', 'WHOLESALE', 'Nashik, MH', 'ACTIVE'],
  ] as const;

  for (const [name, mobile, email, businessName, gstNumber, type, address, status] of sample) {
    await pool.query(
      `INSERT INTO customers (name, mobile, email, business_name, gst_number, type, address, status, created_by)
       VALUES ($1, $2, NULLIF($3, ''), $4, NULLIF($5, ''), $6::customer_type, $7, $8::customer_status, (SELECT id FROM users WHERE email = 'admin@crmportal.dev'))
       ON CONFLICT DO NOTHING`,
      [name, mobile, email, businessName, gstNumber, type, address, status],
    );
  }
  if (count?.rows && count.rows.length === 0) {
    // Seed sample products only when the customers table was empty to stay idempotent.
    await seedProducts();
  }
}

export async function seedProducts(): Promise<void> {
  const products = [
    ['Basmati Rice 1kg', 'BR-101', 'Grains', 89.0, 240, 50, 'Warehouse A'],
    ['Sunflower Oil 1L', 'SO-205', 'Oils', 148.0, 120, 30, 'Warehouse A'],
    ['Wheat Atta 5kg', 'WA-310', 'Grains', 265.0, 60, 40, 'Warehouse A'],
    ['Masoor Dal 1kg', 'DL-112', 'Grains', 112.0, 95, 40, 'Warehouse A'],
    ['Toor Dal 1kg', 'DL-113', 'Grains', 165.0, 80, 40, 'Warehouse A'],
    ['Green Tea 250g', 'GT-501', 'Beverages', 210.0, 150, 25, 'Warehouse B'],
    ['Instant Noodles Pack', 'IN-601', 'Snacks', 120.0, 300, 60, 'Warehouse B'],
    ['Biscuit Family Pack', 'BS-701', 'Snacks', 60.0, 45, 50, 'Warehouse B'],
  ] as const;

  for (const [name, sku, category, unitPrice, currentStock, minStock, location] of products) {
    await pool.query(
      `INSERT INTO products (name, sku, category, unit_price, current_stock, min_stock, location, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT id FROM users WHERE email = 'warehouse@crmportal.dev'))
       ON CONFLICT ((lower(sku))) DO NOTHING`,
      [name, sku, category, unitPrice, currentStock, minStock, location],
    );
  }

  const adminId = await pool.query(`SELECT id FROM users WHERE email = 'admin@crmportal.dev'`);
  const admin = adminId.rows[0].id as number;

  await pool.query(
    `INSERT INTO stock_movements (product_id, quantity_changed, movement_type, reason, reference_type, reference_id, created_by)
     SELECT id, current_stock, 'IN', 'Opening stock', NULL, NULL, $1 FROM products
     WHERE NOT EXISTS (SELECT 1 FROM stock_movements)`,
    [admin],
  );
}

export async function seedAll(): Promise<void> {
  await seedUsers();
  const existing = await pool.query('SELECT id FROM customers LIMIT 1');
  await seedCustomers(existing.rows.length ? undefined : existing);
  const products = await pool.query('SELECT id FROM products LIMIT 1');
  if (products.rows.length === 0) {
    await seedProducts();
  }
}