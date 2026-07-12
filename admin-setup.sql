-- =====================================================
-- Apex Quant Investment Platform - Admin Setup
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. Add admin and status columns to profiles table
-- =====================================================

-- Add is_admin column (default false)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Add status column (active or frozen)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Ensure status only contains valid values (PostgreSQL doesn't support ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'valid_status' 
        AND conrelid = 'profiles'::regclass
    ) THEN
        ALTER TABLE profiles
        ADD CONSTRAINT valid_status CHECK (status IN ('active', 'frozen'));
    END IF;
END $$;

-- =====================================================
-- 2. Create deposits table
-- =====================================================

CREATE TABLE IF NOT EXISTS deposits (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    transaction_hash TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. Create withdrawals table
-- =====================================================

CREATE TABLE IF NOT EXISTS withdrawals (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    method TEXT NOT NULL CHECK (method IN ('paypal', 'bank', 'usdt', 'cashapp')),
    details JSONB, -- stores method-specific info (email, iban, address, etc.)
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. Create balance_adjustments table
-- =====================================================

CREATE TABLE IF NOT EXISTS balance_adjustments (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    amount NUMERIC NOT NULL, -- positive to add, negative to deduct
    reason TEXT NOT NULL,
    admin_id UUID REFERENCES auth.users,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. Enable Row Level Security on new tables
-- =====================================================

-- Deposits RLS
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;

-- Users can see and insert their own deposits
-- Admins can see all deposits
CREATE POLICY "Users can view own deposits" ON deposits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own deposits" ON deposits
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all deposits" ON deposits
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

CREATE POLICY "Admins can update deposits" ON deposits
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Withdrawals RLS
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own withdrawals" ON withdrawals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own withdrawals" ON withdrawals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all withdrawals" ON withdrawals
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

CREATE POLICY "Admins can update withdrawals" ON withdrawals
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Balance Adjustments RLS
ALTER TABLE balance_adjustments ENABLE ROW LEVEL SECURITY;

-- Users can view their own adjustments
-- Admins can view and create all adjustments
CREATE POLICY "Users can view own adjustments" ON balance_adjustments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all adjustments" ON balance_adjustments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

CREATE POLICY "Admins can insert adjustments" ON balance_adjustments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- =====================================================
-- 6. RPC Functions for User Management
-- =====================================================

-- Freeze user (admin only)
CREATE OR REPLACE FUNCTION freeze_user(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND is_admin = true
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    -- Freeze the user
    UPDATE profiles
    SET status = 'frozen'
    WHERE id = target_user_id;
END;
$$;

-- Unfreeze user (admin only)
CREATE OR REPLACE FUNCTION unfreeze_user(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND is_admin = true
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    -- Unfreeze the user
    UPDATE profiles
    SET status = 'active'
    WHERE id = target_user_id;
END;
$$;

-- Adjust user balance (admin only)
CREATE OR REPLACE FUNCTION adjust_balance(target_user_id UUID, amount NUMERIC, reason TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND is_admin = true
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    -- Verify target user exists
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_user_id) THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Update user balance
    UPDATE profiles
    SET balance = COALESCE(balance, 0) + amount
    WHERE id = target_user_id;

    -- Ensure balance doesn't go negative
    IF (SELECT balance FROM profiles WHERE id = target_user_id) < 0 THEN
        -- Rollback by reversing the change
        UPDATE profiles
        SET balance = COALESCE(balance, 0) - amount
        WHERE id = target_user_id;
        RAISE EXCEPTION 'Adjustment would result in negative balance';
    END IF;

    -- Log the adjustment
    INSERT INTO balance_adjustments (user_id, amount, reason, admin_id)
    VALUES (target_user_id, amount, reason, auth.uid());
END;
$$;

-- =====================================================
-- 7. RPC Functions for Deposit Management
-- =====================================================

-- Request deposit (user)
CREATE OR REPLACE FUNCTION request_deposit(amount NUMERIC, tx_hash TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deposit_id BIGINT;
BEGIN
    -- Validate inputs
    IF amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be positive';
    END IF;

    IF tx_hash IS NULL OR tx_hash = '' THEN
        RAISE EXCEPTION 'Transaction hash is required';
    END IF;

    -- Insert deposit request
    INSERT INTO deposits (user_id, amount, transaction_hash, status)
    VALUES (auth.uid(), amount, tx_hash, 'pending')
    RETURNING id INTO v_deposit_id;

    RETURN v_deposit_id;
END;
$$;

-- Approve deposit (admin only)
CREATE OR REPLACE FUNCTION approve_deposit(deposit_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deposit RECORD;
BEGIN
    -- Verify caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND is_admin = true
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    -- Get deposit details
    SELECT * INTO v_deposit
    FROM deposits
    WHERE id = deposit_id;

    IF v_deposit IS NULL THEN
        RAISE EXCEPTION 'Deposit not found';
    END IF;

    IF v_deposit.status != 'pending' THEN
        RAISE EXCEPTION 'Deposit is not pending';
    END IF;

    -- Approve deposit and add to balance
    UPDATE deposits
    SET status = 'approved'
    WHERE id = deposit_id;

    -- Add amount to user balance
    UPDATE profiles
    SET balance = COALESCE(balance, 0) + v_deposit.amount
    WHERE id = v_deposit.user_id;
END;
$$;

-- Reject deposit (admin only)
CREATE OR REPLACE FUNCTION reject_deposit(deposit_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deposit RECORD;
BEGIN
    -- Verify caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND is_admin = true
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    -- Get deposit details
    SELECT * INTO v_deposit
    FROM deposits
    WHERE id = deposit_id;

    IF v_deposit IS NULL THEN
        RAISE EXCEPTION 'Deposit not found';
    END IF;

    IF v_deposit.status != 'pending' THEN
        RAISE EXCEPTION 'Deposit is not pending';
    END IF;

    -- Reject deposit
    UPDATE deposits
    SET status = 'rejected'
    WHERE id = deposit_id;
END;
$$;

-- =====================================================
-- 8. RPC Functions for Withdrawal Management
-- =====================================================

-- Request withdrawal (user)
CREATE OR REPLACE FUNCTION request_withdrawal(
    amount NUMERIC,
    method TEXT,
    details_json JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_withdrawal_id BIGINT;
    v_balance NUMERIC;
BEGIN
    -- Validate inputs
    IF amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be positive';
    END IF;

    IF method NOT IN ('paypal', 'bank', 'usdt', 'cashapp') THEN
        RAISE EXCEPTION 'Invalid withdrawal method';
    END IF;

    -- Check user balance (put amount on hold)
    SELECT COALESCE(balance, 0) INTO v_balance
    FROM profiles
    WHERE id = auth.uid();

    IF v_balance < amount THEN
        RAISE EXCEPTION 'Insufficient balance. Available: %', v_balance;
    END IF;

    -- Deduct from balance immediately (on hold)
    UPDATE profiles
    SET balance = balance - amount
    WHERE id = auth.uid();

    -- Insert withdrawal request
    INSERT INTO withdrawals (user_id, amount, method, details, status)
    VALUES (auth.uid(), amount, method, details_json, 'pending')
    RETURNING id INTO v_withdrawal_id;

    RETURN v_withdrawal_id;
END;
$$;

-- Approve withdrawal (admin only)
CREATE OR REPLACE FUNCTION approve_withdrawal(withdrawal_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_withdrawal RECORD;
BEGIN
    -- Verify caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND is_admin = true
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    -- Get withdrawal details
    SELECT * INTO v_withdrawal
    FROM withdrawals
    WHERE id = withdrawal_id;

    IF v_withdrawal IS NULL THEN
        RAISE EXCEPTION 'Withdrawal not found';
    END IF;

    IF v_withdrawal.status != 'pending' THEN
        RAISE EXCEPTION 'Withdrawal is not pending';
    END IF;

    -- Approve withdrawal (balance already deducted when requested)
    UPDATE withdrawals
    SET status = 'approved'
    WHERE id = withdrawal_id;
END;
$$;

-- Reject withdrawal (admin only)
CREATE OR REPLACE FUNCTION reject_withdrawal(withdrawal_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_withdrawal RECORD;
BEGIN
    -- Verify caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND is_admin = true
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    -- Get withdrawal details
    SELECT * INTO v_withdrawal
    FROM withdrawals
    WHERE id = withdrawal_id;

    IF v_withdrawal IS NULL THEN
        RAISE EXCEPTION 'Withdrawal not found';
    END IF;

    IF v_withdrawal.status != 'pending' THEN
        RAISE EXCEPTION 'Withdrawal is not pending';
    END IF;

    -- Reject withdrawal and return funds
    UPDATE withdrawals
    SET status = 'rejected'
    WHERE id = withdrawal_id;

    -- Return the held amount to user balance
    UPDATE profiles
    SET balance = COALESCE(balance, 0) + v_withdrawal.amount
    WHERE id = v_withdrawal.user_id;
END;
$$;

-- =====================================================
-- 9. Grant Execute Permissions
-- =====================================================

-- User management functions
GRANT EXECUTE ON FUNCTION freeze_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION freeze_user(UUID) TO anon;
GRANT EXECUTE ON FUNCTION unfreeze_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unfreeze_user(UUID) TO anon;
GRANT EXECUTE ON FUNCTION adjust_balance(UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION adjust_balance(UUID, NUMERIC, TEXT) TO anon;

-- Deposit functions
GRANT EXECUTE ON FUNCTION request_deposit(NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION request_deposit(NUMERIC, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION approve_deposit(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_deposit(BIGINT) TO anon;
GRANT EXECUTE ON FUNCTION reject_deposit(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_deposit(BIGINT) TO anon;

-- Withdrawal functions
GRANT EXECUTE ON FUNCTION request_withdrawal(NUMERIC, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION request_withdrawal(NUMERIC, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION approve_withdrawal(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_withdrawal(BIGINT) TO anon;
GRANT EXECUTE ON FUNCTION reject_withdrawal(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_withdrawal(BIGINT) TO anon;

-- =====================================================
-- 10. Helper function to check if user is admin
-- =====================================================

CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND is_admin = true
    );
END;
$$;

GRANT EXECUTE ON FUNCTION is_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_admin() TO anon;

-- =====================================================
-- 11. Set a user as admin (run this after creating a user)
-- Example: UPDATE profiles SET is_admin = true WHERE id = 'user-uuid-here';
-- =====================================================
