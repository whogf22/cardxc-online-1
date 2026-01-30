-- ============================================
-- CardXC Database Setup Script
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Update profiles table with role and status
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'blocked'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- Create ledger_entries table (immutable transaction log)
CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('credit', 'debit')),
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  provider TEXT,
  reference TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique constraint for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_provider_reference ON ledger_entries(provider, reference) WHERE provider IS NOT NULL;

-- Create withdrawal_requests table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create webhook_events table
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  reference TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ledger_user_id ON ledger_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_user_id ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_webhook_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_created_at ON webhook_events(created_at DESC);

-- Create wallet_balances view (derived from ledger)
CREATE OR REPLACE VIEW wallet_balances AS
SELECT 
  user_id,
  currency,
  COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0) as balance
FROM ledger_entries
GROUP BY user_id, currency;

-- Enable RLS
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own ledger entries" ON ledger_entries;
DROP POLICY IF EXISTS "Users can view own withdrawal requests" ON withdrawal_requests;
DROP POLICY IF EXISTS "Users can create withdrawal requests" ON withdrawal_requests;
DROP POLICY IF EXISTS "Only admins can view webhook events" ON webhook_events;

-- RLS Policies for customers (can only see their own data)
CREATE POLICY "Users can view own ledger entries" ON ledger_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own withdrawal requests" ON withdrawal_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create withdrawal requests" ON withdrawal_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Webhook events are admin-only (no customer access)
CREATE POLICY "Only admins can view webhook events" ON webhook_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Create admin user (replace with your actual admin email)
UPDATE profiles 
SET role = 'admin', status = 'active'
WHERE email = 'admin@cardxc.online';

-- If admin doesn't exist yet, you'll need to sign up first, then run:
-- UPDATE profiles SET role = 'admin' WHERE email = 'your-admin-email@cardxc.online';
