-- ✅ FEATURE 13: Subscription System Schema

-- Create subscription tiers table
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  price NUMERIC(10,2) NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  max_orders INTEGER DEFAULT 0,
  discount_percentage NUMERIC(5,2) DEFAULT 0,
  features TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default tiers
INSERT INTO subscription_tiers (name, price, billing_cycle, discount_percentage, features, is_active)
VALUES
  ('Free', 0, 'monthly', 0, ARRAY['Browse products', 'Add to cart', 'Basic support'], true),
  ('Starter', 9.99, 'monthly', 5, ARRAY['Unlimited purchases', '5% discount', 'Priority support', 'Early access'], true),
  ('Pro', 19.99, 'monthly', 10, ARRAY['Unlimited purchases', '10% discount', 'VIP support', 'Free shipping', 'Monthly gift'], true),
  ('Elite', 49.99, 'monthly', 15, ARRAY['Unlimited purchases', '15% discount', 'Dedicated manager', 'Same-day support', 'Free express shipping', 'Premium gift box'], true);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES subscription_tiers(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'paused', 'expired')),
  start_date TIMESTAMP DEFAULT NOW(),
  next_billing_date TIMESTAMP NOT NULL,
  auto_renew BOOLEAN DEFAULT true,
  payment_method TEXT NOT NULL,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create subscription invoices table
CREATE TABLE IF NOT EXISTS subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  invoice_date TIMESTAMP DEFAULT NOW(),
  due_date TIMESTAMP NOT NULL,
  paid_date TIMESTAMP,
  payment_method TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_subscription_id ON subscription_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_status ON subscription_invoices(status);

-- Enable RLS
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscriptions
CREATE POLICY "Customers can view own subscriptions" ON subscriptions
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Admin can manage subscriptions" ON subscriptions
  FOR ALL USING (auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM customers WHERE id = auth.uid() AND role = 'admin'
  ));

