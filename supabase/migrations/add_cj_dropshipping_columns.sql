-- ✅ CJ Dropshipping Integration - Database Schema Updates

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS cj_product_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS is_dropship BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cj_commission_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS max_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_recharged_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS recharge_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  cj_product_id TEXT NOT NULL,
  quantity_added INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  recharged_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_cj_product_id ON products(cj_product_id);
CREATE INDEX IF NOT EXISTS idx_products_is_dropship ON products(is_dropship);
CREATE INDEX IF NOT EXISTS idx_recharge_logs_product_id ON recharge_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_recharge_logs_recharged_at ON recharge_logs(recharged_at);

CREATE OR REPLACE VIEW dropship_analytics AS
SELECT 
  COUNT(DISTINCT p.id) as total_dropship_products,
  COUNT(DISTINCT CASE WHEN p.stock = 0 THEN p.id END) as out_of_stock_count,
  COUNT(DISTINCT CASE WHEN p.stock < 10 AND p.stock > 0 THEN p.id END) as low_stock_count,
  SUM(COALESCE(p.stock, 0)) as total_stock,
  AVG(COALESCE(p.cj_commission_rate, 0)) as avg_commission_rate
FROM products p
WHERE p.is_dropship = true;

ALTER TABLE recharge_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view recharge logs" ON recharge_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admin can insert recharge logs" ON recharge_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

