-- Add email features to user preferences
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS email_forwarding BOOLEAN DEFAULT true;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS auto_detection BOOLEAN DEFAULT true;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS forward_to_email VARCHAR(255);

-- User email addresses table
CREATE TABLE user_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address VARCHAR(255) NOT NULL UNIQUE,
  alias VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  total_received INTEGER DEFAULT 0,
  last_email_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_user_emails_user_id ON user_emails(user_id);
CREATE INDEX idx_user_emails_address ON user_emails(email_address);
CREATE INDEX idx_user_emails_active ON user_emails(is_active);

-- Email logs table
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email_id UUID NOT NULL REFERENCES user_emails(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_email VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'error', 'spam', 'ignored')),
  error_message TEXT,
  subscription_detected BOOLEAN DEFAULT false,
  raw_email JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for email logs
CREATE INDEX idx_email_logs_user_email_id ON email_logs(user_email_id);
CREATE INDEX idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_received_at ON email_logs(received_at);
CREATE INDEX idx_email_logs_sender ON email_logs(sender_email);

-- Detected subscriptions table
CREATE TABLE detected_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_log_id UUID NOT NULL REFERENCES email_logs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_name VARCHAR(255) NOT NULL,
  suggested_category_id UUID REFERENCES subscription_categories(id),
  cost DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  billing_cycle VARCHAR(20),
  trial_end_date DATE,
  next_billing_date DATE,
  confidence_score DECIMAL(3, 2),
  detection_type VARCHAR(50) NOT NULL CHECK (detection_type IN ('trial_signup', 'trial_reminder', 'billing_confirmation', 'subscription_start', 'price_change')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'auto_added')),
  approved_at TIMESTAMP WITH TIME ZONE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  extracted_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for detected subscriptions
CREATE INDEX idx_detected_subscriptions_email_log_id ON detected_subscriptions(email_log_id);
CREATE INDEX idx_detected_subscriptions_user_id ON detected_subscriptions(user_id);
CREATE INDEX idx_detected_subscriptions_status ON detected_subscriptions(status);
CREATE INDEX idx_detected_subscriptions_type ON detected_subscriptions(detection_type);

-- Email processing statistics view
CREATE VIEW email_processing_stats AS
SELECT 
  u.id as user_id,
  COUNT(el.*) as total_emails,
  COUNT(el.*) FILTER (WHERE el.status = 'processed') as processed_emails,
  COUNT(el.*) FILTER (WHERE el.status = 'error') as error_emails,
  COUNT(el.*) FILTER (WHERE el.status = 'spam') as spam_emails,
  COUNT(ds.*) as total_detections,
  COUNT(ds.*) FILTER (WHERE ds.status = 'approved') as approved_detections,
  COUNT(ds.*) FILTER (WHERE ds.status = 'pending') as pending_detections,
  MAX(el.received_at) as last_email_received
FROM auth.users u
LEFT JOIN user_emails ue ON u.id = ue.user_id
LEFT JOIN email_logs el ON ue.id = el.user_email_id
LEFT JOIN detected_subscriptions ds ON el.id = ds.email_log_id
GROUP BY u.id;

-- RLS Policies for new tables

-- User emails policies
ALTER TABLE user_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email addresses"
  ON user_emails FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email addresses"
  ON user_emails FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email addresses"
  ON user_emails FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email addresses"
  ON user_emails FOR DELETE
  USING (auth.uid() = user_id);

-- Email logs policies
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email logs"
  ON email_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert email logs"
  ON email_logs FOR INSERT
  WITH CHECK (true); -- Allow system to insert, will be validated by application

CREATE POLICY "Users can update their own email logs"
  ON email_logs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Detected subscriptions policies
ALTER TABLE detected_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own detected subscriptions"
  ON detected_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert detected subscriptions"
  ON detected_subscriptions FOR INSERT
  WITH CHECK (true); -- Allow system to insert, will be validated by application

CREATE POLICY "Users can update their own detected subscriptions"
  ON detected_subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own detected subscriptions"
  ON detected_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_user_emails_updated_at BEFORE UPDATE ON user_emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_detected_subscriptions_updated_at BEFORE UPDATE ON detected_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique email address
CREATE OR REPLACE FUNCTION generate_user_email(user_uuid UUID, domain_suffix TEXT DEFAULT 'subtracker.app')
RETURNS TEXT AS $$
DECLARE
  base_alias TEXT;
  counter INTEGER := 0;
  email_address TEXT;
  alias_exists BOOLEAN;
BEGIN
  -- Generate base alias from user ID (first 8 characters)
  base_alias := LEFT(REPLACE(user_uuid::TEXT, '-', ''), 8);
  
  LOOP
    -- Create email address
    IF counter = 0 THEN
      email_address := base_alias || '@' || domain_suffix;
    ELSE
      email_address := base_alias || counter || '@' || domain_suffix;
    END IF;
    
    -- Check if alias exists
    SELECT EXISTS(SELECT 1 FROM user_emails WHERE email_address = email_address) INTO alias_exists;
    
    -- If doesn't exist, return it
    IF NOT alias_exists THEN
      RETURN email_address;
    END IF;
    
    counter := counter + 1;
    
    -- Safety check to prevent infinite loop
    IF counter > 999 THEN
      RAISE EXCEPTION 'Unable to generate unique email address';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;