-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create initial notification preferences
  INSERT INTO public.user_preferences (user_id, email_notifications, notification_days_before)
  VALUES (NEW.id, true, 7);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- User preferences table
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email_notifications BOOLEAN DEFAULT true,
  notification_days_before INTEGER DEFAULT 7,
  currency VARCHAR(3) DEFAULT 'USD',
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on user preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- User preferences policies
CREATE POLICY "Users can view their own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add trigger for updated_at on user_preferences
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check upcoming renewals
CREATE OR REPLACE FUNCTION check_upcoming_renewals()
RETURNS void AS $$
DECLARE
  sub RECORD;
  pref RECORD;
BEGIN
  -- Loop through active subscriptions
  FOR sub IN 
    SELECT s.*, p.notification_days_before, p.email_notifications
    FROM subscriptions s
    JOIN user_preferences p ON s.user_id = p.user_id
    WHERE s.status = 'active' 
    AND s.auto_renew = true
    AND s.next_billing_date <= CURRENT_DATE + INTERVAL '30 days'
  LOOP
    -- Check if notification should be sent
    IF sub.next_billing_date = CURRENT_DATE + (sub.notification_days_before || ' days')::INTERVAL THEN
      -- Insert notification
      INSERT INTO notifications (user_id, subscription_id, type, title, message)
      VALUES (
        sub.user_id,
        sub.id,
        'payment_upcoming',
        'Upcoming renewal for ' || sub.service_name,
        'Your ' || sub.service_name || ' subscription will renew on ' || 
        TO_CHAR(sub.next_billing_date, 'Month DD, YYYY') || ' for ' || 
        sub.currency || ' ' || sub.cost
      );
    END IF;
  END LOOP;
  
  -- Check for expiring trials
  FOR sub IN 
    SELECT s.*, p.notification_days_before
    FROM subscriptions s
    JOIN user_preferences p ON s.user_id = p.user_id
    WHERE s.status = 'trial' 
    AND s.trial_end_date IS NOT NULL
    AND s.trial_end_date <= CURRENT_DATE + INTERVAL '7 days'
  LOOP
    IF sub.trial_end_date = CURRENT_DATE + (sub.notification_days_before || ' days')::INTERVAL THEN
      INSERT INTO notifications (user_id, subscription_id, type, title, message)
      VALUES (
        sub.user_id,
        sub.id,
        'trial_ending',
        'Trial ending for ' || sub.service_name,
        'Your free trial for ' || sub.service_name || ' will end on ' || 
        TO_CHAR(sub.trial_end_date, 'Month DD, YYYY')
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate next billing date
CREATE OR REPLACE FUNCTION calculate_next_billing_date(
  current_date DATE,
  billing_cycle VARCHAR(20)
)
RETURNS DATE AS $$
BEGIN
  CASE billing_cycle
    WHEN 'monthly' THEN
      RETURN current_date + INTERVAL '1 month';
    WHEN 'quarterly' THEN
      RETURN current_date + INTERVAL '3 months';
    WHEN 'semi-annually' THEN
      RETURN current_date + INTERVAL '6 months';
    WHEN 'annually' THEN
      RETURN current_date + INTERVAL '1 year';
    WHEN 'weekly' THEN
      RETURN current_date + INTERVAL '1 week';
    ELSE
      RETURN current_date + INTERVAL '1 month';
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;