-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create subscription_categories table
CREATE TABLE subscription_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL UNIQUE,
  color VARCHAR(7) NOT NULL DEFAULT '#6B7280',
  icon VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default categories
INSERT INTO subscription_categories (name, color, icon) VALUES
  ('Entertainment', '#EF4444', 'tv'),
  ('Productivity', '#3B82F6', 'briefcase'),
  ('Cloud Storage', '#10B981', 'cloud'),
  ('Software', '#8B5CF6', 'code'),
  ('Education', '#F59E0B', 'academic-cap'),
  ('Health & Fitness', '#EC4899', 'heart'),
  ('Finance', '#06B6D4', 'currency-dollar'),
  ('News & Media', '#6366F1', 'newspaper'),
  ('Gaming', '#84CC16', 'puzzle'),
  ('Other', '#6B7280', 'tag');

-- Create subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_name VARCHAR(255) NOT NULL,
  category_id UUID REFERENCES subscription_categories(id) ON DELETE SET NULL,
  cost DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  billing_cycle VARCHAR(20) NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'semi-annually', 'annually', 'weekly')),
  
  -- Dates
  start_date DATE NOT NULL,
  next_billing_date DATE NOT NULL,
  end_date DATE,
  trial_end_date DATE,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'paused', 'trial', 'expired')),
  auto_renew BOOLEAN DEFAULT true,
  
  -- Additional info
  description TEXT,
  website_url TEXT,
  cancellation_url TEXT,
  notification_days_before INTEGER DEFAULT 7,
  
  -- Email parsing metadata
  confidence_score DECIMAL(3, 2),
  source_email JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_next_billing_date ON subscriptions(next_billing_date);
CREATE INDEX idx_subscriptions_category_id ON subscriptions(category_id);

-- Create trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create subscription_history table for tracking changes
CREATE TABLE subscription_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscription_history_subscription_id ON subscription_history(subscription_id);

-- Create notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('trial_ending', 'payment_upcoming', 'price_change', 'cancellation_reminder')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Subscriptions policies
CREATE POLICY "Users can view their own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
  ON subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Subscription history policies
CREATE POLICY "Users can view their own subscription history"
  ON subscription_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscription history"
  ON subscription_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Categories are public read
CREATE POLICY "Anyone can view categories"
  ON subscription_categories FOR SELECT
  USING (true);

-- Create view for subscription statistics
CREATE VIEW subscription_stats AS
SELECT 
  user_id,
  COUNT(*) as total_subscriptions,
  COUNT(*) FILTER (WHERE status = 'active') as active_subscriptions,
  COUNT(*) FILTER (WHERE status = 'trial') as trial_subscriptions,
  SUM(CASE 
    WHEN status = 'active' AND billing_cycle = 'monthly' THEN cost
    WHEN status = 'active' AND billing_cycle = 'quarterly' THEN cost / 3
    WHEN status = 'active' AND billing_cycle = 'semi-annually' THEN cost / 6
    WHEN status = 'active' AND billing_cycle = 'annually' THEN cost / 12
    WHEN status = 'active' AND billing_cycle = 'weekly' THEN cost * 4.33
    ELSE 0
  END) as monthly_total,
  SUM(CASE 
    WHEN status = 'active' AND billing_cycle = 'monthly' THEN cost * 12
    WHEN status = 'active' AND billing_cycle = 'quarterly' THEN cost * 4
    WHEN status = 'active' AND billing_cycle = 'semi-annually' THEN cost * 2
    WHEN status = 'active' AND billing_cycle = 'annually' THEN cost
    WHEN status = 'active' AND billing_cycle = 'weekly' THEN cost * 52
    ELSE 0
  END) as yearly_total
FROM subscriptions
GROUP BY user_id;