-- Mini ERP + CRM Operations Portal schema

CREATE TYPE user_role AS ENUM ('ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS');
CREATE TYPE customer_type AS ENUM ('RETAIL', 'WHOLESALE', 'DISTRIBUTOR');
CREATE TYPE customer_status AS ENUM ('LEAD', 'ACTIVE', 'INACTIVE');
CREATE TYPE movement_type AS ENUM ('IN', 'OUT');
CREATE TYPE challan_status AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- users
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          user_role NOT NULL DEFAULT 'SALES',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- customers
CREATE TABLE IF NOT EXISTS customers (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  mobile        VARCHAR(20) NOT NULL,
  email         VARCHAR(255),
  business_name VARCHAR(200),
  gst_number    VARCHAR(30),
  type          customer_type NOT NULL DEFAULT 'RETAIL',
  address       TEXT,
  status        customer_status NOT NULL DEFAULT 'LEAD',
  follow_up_date DATE,
  notes         TEXT,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_name        ON customers (lower(name));
CREATE INDEX IF NOT EXISTS idx_customers_business    ON customers (lower(business_name));
CREATE INDEX IF NOT EXISTS idx_customers_type_status ON customers (type, status);
CREATE INDEX IF NOT EXISTS idx_customers_followup    ON customers (follow_up_date) WHERE follow_up_date IS NOT NULL;

-- customer_followups
CREATE TABLE IF NOT EXISTS customer_followups (
  id             SERIAL PRIMARY KEY,
  customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  notes          TEXT NOT NULL,
  follow_up_date DATE,
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_followups_customer ON customer_followups (customer_id, created_at DESC);

-- products
CREATE TABLE IF NOT EXISTS products (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  sku           VARCHAR(50) NOT NULL,
  category      VARCHAR(100) NOT NULL DEFAULT 'General',
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  min_stock     INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  location      VARCHAR(150),
  image_url     VARCHAR(500),
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_products_sku ON products (lower(sku));

ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_products_name     ON products (lower(name));
CREATE INDEX IF NOT EXISTS idx_products_category ON products (lower(category));

-- stock_movements (audit history)
CREATE TABLE IF NOT EXISTS stock_movements (
  id               SERIAL PRIMARY KEY,
  product_id       INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity_changed INTEGER NOT NULL CHECK (quantity_changed <> 0),
  movement_type    movement_type NOT NULL,
  reason           VARCHAR(255) NOT NULL,
  reference_type   VARCHAR(30),
  reference_id     INTEGER,
  created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements (created_at DESC);

-- challans
CREATE SEQUENCE IF NOT EXISTS challan_number_seq START 1;

CREATE TABLE IF NOT EXISTS challans (
  id              SERIAL PRIMARY KEY,
  challan_number  VARCHAR(40) NOT NULL UNIQUE,
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  total_quantity  INTEGER NOT NULL CHECK (total_quantity > 0),
  status          challan_status NOT NULL DEFAULT 'DRAFT',
  remarks         TEXT,
  confirmed_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challans_status      ON challans (status);
CREATE INDEX IF NOT EXISTS idx_challans_customer    ON challans (customer_id);
CREATE INDEX IF NOT EXISTS idx_challans_created     ON challans (created_at DESC);

-- challan_items (with product snapshot)
CREATE TABLE IF NOT EXISTS challan_items (
  id            SERIAL PRIMARY KEY,
  challan_id    INTEGER NOT NULL REFERENCES challans(id) ON DELETE CASCADE,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name  VARCHAR(200) NOT NULL,
  product_sku   VARCHAR(50) NOT NULL,
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challan_items_challan ON challan_items (challan_id);