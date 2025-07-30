-- Add Cloudflare-specific fields to user_emails table
ALTER TABLE user_emails ADD COLUMN IF NOT EXISTS cloudflare_route_id VARCHAR(255);
ALTER TABLE user_emails ADD COLUMN IF NOT EXISTS cloudflare_enabled BOOLEAN DEFAULT true;

-- Create index for Cloudflare route ID
CREATE INDEX IF NOT EXISTS idx_user_emails_cloudflare_route_id ON user_emails(cloudflare_route_id);

-- Add Cloudflare webhook tracking
CREATE TABLE IF NOT EXISTS cloudflare_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  last_delivery_at TIMESTAMP WITH TIME ZONE,
  delivery_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  config JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add trigger for updated_at on cloudflare_webhooks
CREATE TRIGGER update_cloudflare_webhooks_updated_at BEFORE UPDATE ON cloudflare_webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create email routing configuration table
CREATE TABLE IF NOT EXISTS email_routing_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain VARCHAR(255) NOT NULL UNIQUE,
  cloudflare_zone_id VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  dns_configured BOOLEAN DEFAULT false,
  email_routing_enabled BOOLEAN DEFAULT false,
  catch_all_enabled BOOLEAN DEFAULT false,
  webhook_url TEXT,
  verification_status JSONB,
  last_verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add trigger for updated_at on email_routing_config
CREATE TRIGGER update_email_routing_config_updated_at BEFORE UPDATE ON email_routing_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create DNS records tracking table
CREATE TABLE IF NOT EXISTS dns_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain VARCHAR(255) NOT NULL,
  record_type VARCHAR(10) NOT NULL CHECK (record_type IN ('MX', 'TXT', 'CNAME', 'A', 'AAAA')),
  name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  priority INTEGER,
  ttl INTEGER,
  cloudflare_record_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  purpose VARCHAR(100), -- 'email_routing_mx', 'spf', 'dmarc', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for DNS records
CREATE INDEX IF NOT EXISTS idx_dns_records_domain ON dns_records(domain);
CREATE INDEX IF NOT EXISTS idx_dns_records_type ON dns_records(record_type);
CREATE INDEX IF NOT EXISTS idx_dns_records_cloudflare_id ON dns_records(cloudflare_record_id);

-- Add trigger for updated_at on dns_records
CREATE TRIGGER update_dns_records_updated_at BEFORE UPDATE ON dns_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create email delivery tracking
CREATE TABLE IF NOT EXISTS email_delivery_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_log_id UUID REFERENCES email_logs(id) ON DELETE CASCADE,
  delivery_status VARCHAR(50) NOT NULL CHECK (delivery_status IN ('pending', 'delivered', 'failed', 'bounced', 'spam')),
  delivery_provider VARCHAR(50) DEFAULT 'cloudflare',
  webhook_data JSONB,
  error_message TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for email delivery logs
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_email_log_id ON email_delivery_logs(email_log_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_status ON email_delivery_logs(delivery_status);

-- Function to sync user email with Cloudflare
CREATE OR REPLACE FUNCTION sync_user_email_with_cloudflare()
RETURNS TRIGGER AS $$
BEGIN
  -- When a user email is created, we'll need to create a Cloudflare route
  -- This will be handled by the application, but we can log the event
  
  IF TG_OP = 'INSERT' THEN
    -- Log that a new email address needs Cloudflare route creation
    INSERT INTO email_logs (
      user_email_id,
      user_id,
      sender_email,
      subject,
      body_text,
      status,
      raw_email
    ) VALUES (
      NEW.id,
      NEW.user_id,
      'system',
      'Cloudflare Route Creation Required',
      'New email address created: ' || NEW.email_address,
      'pending',
      jsonb_build_object(
        'event', 'email_address_created',
        'email_address', NEW.email_address,
        'alias', NEW.alias,
        'timestamp', NOW()
      )
    );
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for Cloudflare sync
CREATE TRIGGER sync_cloudflare_on_email_create
  AFTER INSERT ON user_emails
  FOR EACH ROW EXECUTE FUNCTION sync_user_email_with_cloudflare();

-- Function to cleanup Cloudflare routes when user emails are deleted
CREATE OR REPLACE FUNCTION cleanup_cloudflare_routes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log that a Cloudflare route needs to be deleted
  IF OLD.cloudflare_route_id IS NOT NULL THEN
    INSERT INTO email_logs (
      user_email_id,
      user_id,
      sender_email,
      subject,
      body_text,
      status,
      raw_email
    ) VALUES (
      OLD.id,
      OLD.user_id,
      'system',
      'Cloudflare Route Deletion Required',
      'Email address deleted: ' || OLD.email_address,
      'pending',
      jsonb_build_object(
        'event', 'email_address_deleted',
        'email_address', OLD.email_address,
        'cloudflare_route_id', OLD.cloudflare_route_id,
        'timestamp', NOW()
      )
    );
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for Cloudflare cleanup
CREATE TRIGGER cleanup_cloudflare_on_email_delete
  BEFORE DELETE ON user_emails
  FOR EACH ROW EXECUTE FUNCTION cleanup_cloudflare_routes();

-- Insert default email routing configuration
INSERT INTO email_routing_config (domain, cloudflare_zone_id, webhook_url)
VALUES (
  COALESCE(current_setting('app.email_domain', true), 'subtracker.tech'),
  COALESCE(current_setting('app.cloudflare_zone_id', true), 'placeholder-zone-id'),
  COALESCE(current_setting('app.webhook_url', true), 'https://subtracker.app/api/webhooks/cloudflare')
) ON CONFLICT (domain) DO NOTHING;

-- View for email routing status
CREATE OR REPLACE VIEW email_routing_status AS
SELECT 
  erc.domain,
  erc.is_active,
  erc.dns_configured,
  erc.email_routing_enabled,
  erc.catch_all_enabled,
  COUNT(ue.id) as total_email_addresses,
  COUNT(ue.id) FILTER (WHERE ue.is_active = true) as active_email_addresses,
  COUNT(ue.id) FILTER (WHERE ue.cloudflare_route_id IS NOT NULL) as cloudflare_configured_addresses,
  erc.last_verified_at,
  erc.verification_status
FROM email_routing_config erc
LEFT JOIN user_emails ue ON ue.email_address LIKE '%@' || erc.domain
GROUP BY erc.id, erc.domain, erc.is_active, erc.dns_configured, 
         erc.email_routing_enabled, erc.catch_all_enabled, 
         erc.last_verified_at, erc.verification_status;

-- RLS Policies for new tables

-- Cloudflare webhooks (admin only)
ALTER TABLE cloudflare_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage cloudflare webhooks"
  ON cloudflare_webhooks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_preferences 
    WHERE user_id = auth.uid() 
    AND user_id IN (SELECT id FROM auth.users WHERE email = 'admin@subtracker.app')
  ));

-- Email routing config (admin only)
ALTER TABLE email_routing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email routing config"
  ON email_routing_config FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_preferences 
    WHERE user_id = auth.uid() 
    AND user_id IN (SELECT id FROM auth.users WHERE email = 'admin@subtracker.app')
  ));

-- DNS records (admin only)
ALTER TABLE dns_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage DNS records"
  ON dns_records FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_preferences 
    WHERE user_id = auth.uid() 
    AND user_id IN (SELECT id FROM auth.users WHERE email = 'admin@subtracker.app')
  ));

-- Email delivery logs (users can view their own)
ALTER TABLE email_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own delivery logs"
  ON email_delivery_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM email_logs el
    WHERE el.id = email_delivery_logs.email_log_id
    AND el.user_id = auth.uid()
  ));