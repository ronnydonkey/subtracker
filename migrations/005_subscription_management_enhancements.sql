-- Migration: Enhanced subscription management features to address user pain points
-- Date: 2025-01-30

-- 1. Add fields to subscriptions table for better tracking
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS 
  last_used_at TIMESTAMP WITH TIME ZONE,
  price_history JSONB DEFAULT '[]'::jsonb,
  original_cost DECIMAL(10, 2),
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  trial_conversion_alerted BOOLEAN DEFAULT false,
  notes TEXT;

-- 2. Create user_preferences table for budget alerts and notification settings
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  monthly_budget_limit DECIMAL(10, 2),
  budget_alert_enabled BOOLEAN DEFAULT true,
  budget_alert_threshold INTEGER DEFAULT 80, -- Percentage of budget
  trial_ending_days_notice INTEGER DEFAULT 3,
  payment_upcoming_days_notice INTEGER DEFAULT 2,
  cancellation_reminder_days INTEGER DEFAULT 30, -- Days after last use
  email_notifications_enabled BOOLEAN DEFAULT true,
  push_notifications_enabled BOOLEAN DEFAULT false,
  weekly_summary_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create subscription_usage table to track engagement
CREATE TABLE IF NOT EXISTS subscription_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  usage_type VARCHAR(50) DEFAULT 'manual', -- manual, detected, imported
  notes TEXT
);

-- 4. Create price_alerts table for tracking price changes
CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_cost DECIMAL(10, 2) NOT NULL,
  new_cost DECIMAL(10, 2) NOT NULL,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT false,
  alert_sent BOOLEAN DEFAULT false
);

-- 5. Create budget_alerts table
CREATE TABLE IF NOT EXISTS budget_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  total_spending DECIMAL(10, 2) NOT NULL,
  budget_limit DECIMAL(10, 2) NOT NULL,
  percentage_used INTEGER NOT NULL,
  alert_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT false
);

-- 6. Update notifications table to include more types (manually since we can't easily alter enums)
-- We'll modify the check constraint instead
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN ('trial_ending', 'payment_upcoming', 'price_change', 'cancellation_reminder', 
                  'budget_exceeded', 'unused_subscription', 'price_increase', 'weekly_summary'));

-- 7. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_last_used_at ON subscriptions(last_used_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_end_date ON subscriptions(trial_end_date);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_subscription_id ON subscription_usage(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_logged_at ON subscription_usage(logged_at);
CREATE INDEX IF NOT EXISTS idx_price_alerts_subscription_id ON price_alerts(subscription_id);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_user_month ON budget_alerts(user_id, month);

-- 8. Enable RLS on new tables
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_alerts ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS policies for new tables
-- User preferences policies
CREATE POLICY "Users can view their own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Subscription usage policies
CREATE POLICY "Users can view their own usage"
  ON subscription_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage"
  ON subscription_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own usage"
  ON subscription_usage FOR DELETE
  USING (auth.uid() = user_id);

-- Price alerts policies
CREATE POLICY "Users can view their own price alerts"
  ON price_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own price alerts"
  ON price_alerts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Budget alerts policies
CREATE POLICY "Users can view their own budget alerts"
  ON budget_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own budget alerts"
  ON budget_alerts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 10. Create function to calculate unused subscriptions
CREATE OR REPLACE FUNCTION get_unused_subscriptions(user_uuid UUID, days_threshold INTEGER DEFAULT 30)
RETURNS TABLE (
  subscription_id UUID,
  service_name VARCHAR(255),
  cost DECIMAL(10, 2),
  billing_cycle VARCHAR(20),
  last_used_at TIMESTAMP WITH TIME ZONE,
  days_unused INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.service_name,
    s.cost,
    s.billing_cycle,
    s.last_used_at,
    EXTRACT(DAY FROM NOW() - COALESCE(s.last_used_at, s.created_at))::INTEGER as days_unused
  FROM subscriptions s
  WHERE s.user_id = user_uuid
    AND s.status = 'active'
    AND (s.last_used_at IS NULL OR s.last_used_at < NOW() - INTERVAL '1 day' * days_threshold)
  ORDER BY days_unused DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Create function to get upcoming trials ending
CREATE OR REPLACE FUNCTION get_trials_ending_soon(user_uuid UUID, days_ahead INTEGER DEFAULT 7)
RETURNS TABLE (
  subscription_id UUID,
  service_name VARCHAR(255),
  trial_end_date DATE,
  days_until_conversion INTEGER,
  cost DECIMAL(10, 2),
  billing_cycle VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.service_name,
    s.trial_end_date,
    EXTRACT(DAY FROM s.trial_end_date - CURRENT_DATE)::INTEGER as days_until_conversion,
    s.cost,
    s.billing_cycle
  FROM subscriptions s
  WHERE s.user_id = user_uuid
    AND s.status = 'trial'
    AND s.trial_end_date IS NOT NULL
    AND s.trial_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '1 day' * days_ahead
    AND s.trial_conversion_alerted = false
  ORDER BY s.trial_end_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Create view for enhanced subscription stats
CREATE OR REPLACE VIEW subscription_stats_enhanced AS
SELECT 
  s.user_id,
  COUNT(*) as total_subscriptions,
  COUNT(*) FILTER (WHERE s.status = 'active') as active_subscriptions,
  COUNT(*) FILTER (WHERE s.status = 'trial') as trial_subscriptions,
  COUNT(*) FILTER (WHERE s.status = 'active' AND (s.last_used_at IS NULL OR s.last_used_at < NOW() - INTERVAL '30 days')) as unused_subscriptions,
  COUNT(*) FILTER (WHERE s.status = 'trial' AND s.trial_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days') as trials_ending_soon,
  -- Monthly total
  SUM(CASE 
    WHEN s.status = 'active' AND s.billing_cycle = 'monthly' THEN s.cost
    WHEN s.status = 'active' AND s.billing_cycle = 'quarterly' THEN s.cost / 3
    WHEN s.status = 'active' AND s.billing_cycle = 'semi-annually' THEN s.cost / 6
    WHEN s.status = 'active' AND s.billing_cycle = 'annually' THEN s.cost / 12
    WHEN s.status = 'active' AND s.billing_cycle = 'weekly' THEN s.cost * 4.33
    ELSE 0
  END) as monthly_total,
  -- Previous month total for comparison
  SUM(CASE 
    WHEN sh.old_data->>'status' = 'active' 
    AND sh.created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
    AND sh.created_at < DATE_TRUNC('month', CURRENT_DATE)
    THEN (
      CASE sh.old_data->>'billing_cycle'
        WHEN 'monthly' THEN (sh.old_data->>'cost')::DECIMAL
        WHEN 'quarterly' THEN (sh.old_data->>'cost')::DECIMAL / 3
        WHEN 'semi-annually' THEN (sh.old_data->>'cost')::DECIMAL / 6
        WHEN 'annually' THEN (sh.old_data->>'cost')::DECIMAL / 12
        WHEN 'weekly' THEN (sh.old_data->>'cost')::DECIMAL * 4.33
        ELSE 0
      END
    )
    ELSE 0
  END) as previous_month_total,
  -- Yearly total
  SUM(CASE 
    WHEN s.status = 'active' AND s.billing_cycle = 'monthly' THEN s.cost * 12
    WHEN s.status = 'active' AND s.billing_cycle = 'quarterly' THEN s.cost * 4
    WHEN s.status = 'active' AND s.billing_cycle = 'semi-annually' THEN s.cost * 2
    WHEN s.status = 'active' AND s.billing_cycle = 'annually' THEN s.cost
    WHEN s.status = 'active' AND s.billing_cycle = 'weekly' THEN s.cost * 52
    ELSE 0
  END) as yearly_total,
  -- Most expensive subscription
  MAX(CASE 
    WHEN s.status = 'active' THEN s.cost
    ELSE NULL
  END) as highest_subscription_cost,
  -- Cheapest subscription
  MIN(CASE 
    WHEN s.status = 'active' AND s.cost > 0 THEN s.cost
    ELSE NULL
  END) as lowest_subscription_cost,
  up.monthly_budget_limit,
  up.currency as preferred_currency
FROM subscriptions s
LEFT JOIN subscription_history sh ON s.id = sh.subscription_id
LEFT JOIN user_preferences up ON s.user_id = up.user_id
GROUP BY s.user_id, up.monthly_budget_limit, up.currency;

-- 13. Trigger to update updated_at for user_preferences
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();