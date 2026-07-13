-- Apex Quant Email Setup
-- Run this SQL in your Supabase SQL Editor to create email logging functionality

-- Create a table for email logs (stores sent email records)
CREATE TABLE IF NOT EXISTS email_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'sent'
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);

-- Enable Row Level Security
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own email logs
CREATE POLICY "Users can view own email logs"
  ON email_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Only service role can insert email logs (for edge functions)
CREATE POLICY "Service role can insert email logs"
  ON email_logs FOR INSERT
  WITH CHECK (true);

-- Function to log emails (will be called by Edge Function)
CREATE OR REPLACE FUNCTION log_email(
  p_user_id UUID,
  p_type TEXT,
  p_recipient TEXT,
  p_subject TEXT,
  p_body TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO email_logs (user_id, type, recipient, subject, body)
  VALUES (p_user_id, p_type, p_recipient, p_subject, p_body);
END;
$$;

-- Sample email templates table (optional - for reference)
CREATE TABLE IF NOT EXISTS email_templates (
  id BIGSERIAL PRIMARY KEY,
  type TEXT UNIQUE NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default email templates
INSERT INTO email_templates (type, subject, body)
VALUES
  ('welcome', 'Welcome to Apex Quant!', 'Welcome to Apex Quant! Your account has been created successfully. Start investing today to earn guaranteed returns.'),
  ('deposit_approved', 'Deposit Approved - Funds Added', 'Great news! Your deposit of {amount} has been approved and added to your account balance.'),
  ('deposit_rejected', 'Deposit Rejected', 'Unfortunately, your deposit of {amount} could not be verified. Please contact support for assistance.'),
  ('withdrawal_requested', 'Withdrawal Request Received', 'We have received your withdrawal request of {amount}. It will be processed shortly.'),
  ('withdrawal_approved', 'Withdrawal Approved - Funds Sent', 'Your withdrawal of {amount} has been approved and the funds have been sent.'),
  ('withdrawal_rejected', 'Withdrawal Rejected', 'Unfortunately, your withdrawal request of {amount} could not be processed. Please contact support.'),
  ('investment_created', 'Investment Created Successfully', 'Your investment of {amount} in Tier {tier} has been created. Expected ROI: {roi}%. Maturity date: {end_date}.'),
  ('investment_completed', 'Investment Completed - Profits Added', 'Congratulations! Your investment has completed. Profits of {profit} have been added to your balance.'),
  ('account_frozen', 'Account Status Update', 'Your account has been frozen. Please contact support for more information.')
ON CONFLICT (type) DO NOTHING;

-- Function to get user email by ID (for edge functions)
CREATE OR REPLACE FUNCTION get_user_email(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  RETURN v_email;
END;
$$;
