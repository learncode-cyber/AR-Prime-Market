-- ═══════════════════════════════════════════════════════════════════════════
-- AR PRIME MARKET - Advanced Agents Database Schema
-- ═══════════════════════════════════════════════════════════════════════════

-- 1️⃣ Marketing Strategy Table
CREATE TABLE IF NOT EXISTS marketing_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  original_price DECIMAL(10, 2),
  sale_price DECIMAL(10, 2),
  discount_percent INTEGER,
  scarcity_level TEXT,
  social_proof_enabled BOOLEAN DEFAULT true,
  urgency_message TEXT,
  ab_test_variant TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2️⃣ Customer Segmentation
CREATE TABLE IF NOT EXISTS customer_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  segment_type TEXT, -- new, repeat, vip, at_risk, inactive
  lifetime_value DECIMAL(12, 2),
  order_count INTEGER,
  last_order_date TIMESTAMP,
  engagement_score DECIMAL(3, 2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3️⃣ Personalization Profiles
CREATE TABLE IF NOT EXISTS personalization_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE,
  tone TEXT, -- formal, casual, friendly, professional
  communication_channel TEXT, -- email, sms, telegram, all
  response_time_preference TEXT,
  language TEXT DEFAULT 'bengali',
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 4️⃣ Support Tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  issue_type TEXT,
  priority TEXT, -- low, medium, high, urgent
  status TEXT DEFAULT 'open', -- open, in_progress, resolved, closed
  assigned_to TEXT,
  target_response_time INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 5️⃣ Return Requests
CREATE TABLE IF NOT EXISTS return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  refund_amount DECIMAL(10, 2),
  return_shipping_label TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 6️⃣ Product Bundles
CREATE TABLE IF NOT EXISTS product_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  main_product_id UUID NOT NULL,
  bundle_items JSONB,
  bundle_discount INTEGER,
  expected_aov_increase INTEGER,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (main_product_id) REFERENCES products(id)
);

-- 7️⃣ A/B Tests
CREATE TABLE IF NOT EXISTS ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  variant_a JSONB,
  variant_b JSONB,
  split_percent INTEGER DEFAULT 50,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  winner TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 8️⃣ Loyalty Programs
CREATE TABLE IF NOT EXISTS loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE,
  reward_points INTEGER DEFAULT 0,
  loyalty_tier TEXT, -- bronze, silver, gold, platinum
  benefits JSONB,
  last_updated TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 9️⃣ Demand Forecasts
CREATE TABLE IF NOT EXISTS demand_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  forecast_date DATE,
  predicted_units INTEGER,
  confidence DECIMAL(3, 2),
  seasonal_factor DECIMAL(3, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 🔟 Financial Tracking
CREATE TABLE IF NOT EXISTS financial_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE,
  total_revenue DECIMAL(12, 2),
  total_costs DECIMAL(12, 2),
  profit DECIMAL(12, 2),
  profit_margin DECIMAL(5, 3),
  roi DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 1️⃣1️⃣ Supplier Management
CREATE TABLE IF NOT EXISTS supplier_management (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID,
  performance_score DECIMAL(3, 2),
  reliability INTEGER,
  quality INTEGER,
  price_competitiveness INTEGER,
  last_order_date TIMESTAMP,
  next_order_recommended BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 1️⃣2️⃣ Product Recommendations
CREATE TABLE IF NOT EXISTS product_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  recommended_product_id UUID NOT NULL,
  correlation_score DECIMAL(3, 2),
  discount_when_bundled INTEGER,
  frequency INTEGER,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (recommended_product_id) REFERENCES products(id)
);

-- Indexes for Performance
CREATE INDEX idx_customer_segments_customer ON customer_segments(customer_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_marketing_strategies_product ON marketing_strategies(product_id);
CREATE INDEX idx_demand_forecasts_date ON demand_forecasts(forecast_date);
CREATE INDEX idx_return_requests_status ON return_requests(status);

