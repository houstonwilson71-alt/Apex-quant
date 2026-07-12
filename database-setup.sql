-- =====================================================
-- Apex Quant Investment Platform - Database Setup
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Add balance column to profiles table (if not exists)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0;

-- Ensure balance defaults to 0 for existing rows
UPDATE profiles SET balance = 0 WHERE balance IS NULL;

-- 2. Create investments table
CREATE TABLE IF NOT EXISTS investments (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    tier INTEGER NOT NULL CHECK (tier >= 1 AND tier <= 4),
    amount NUMERIC NOT NULL CHECK (amount > 0),
    roi_percentage NUMERIC NOT NULL,
    profit NUMERIC NOT NULL,
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled'))
);

-- 3. Enable Row Level Security on investments table
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

-- Create policy: users can only see their own investments
DROP POLICY IF EXISTS users_own_investments ON investments;
CREATE POLICY users_own_investments ON investments
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. Create function to process mature investments
CREATE OR REPLACE FUNCTION process_mature_investments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    investment_record RECORD;
BEGIN
    -- Find all active investments that have reached maturity
    FOR investment_record IN
        SELECT id, user_id, amount, profit, status
        FROM investments
        WHERE status = 'active' AND end_date <= NOW()
    LOOP
        -- Update user's balance: add principal + profit
        UPDATE profiles
        SET balance = COALESCE(balance, 0) + investment_record.amount + investment_record.profit
        WHERE id = investment_record.user_id;

        -- Mark investment as completed
        UPDATE investments
        SET status = 'completed'
        WHERE id = investment_record.id;
    END LOOP;
END;
$$;

-- 5. Enable pg_cron extension (run once in Supabase dashboard if not enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule process_mature_investments to run every 5 minutes
-- Note: Adjust the schedule as needed
SELECT cron.schedule(
    'process-mature-investments',
    '*/5 * * * *',
    'SELECT process_mature_investments()'
);

-- 6. Create invest function (SECURITY DEFINER for elevated privileges)
CREATE OR REPLACE FUNCTION invest(
    p_user_id UUID,
    p_amount NUMERIC,
    p_tier INT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_roi_percentage NUMERIC;
    v_profit NUMERIC;
    v_end_date TIMESTAMPTZ;
    v_current_balance NUMERIC;
    v_investment_id BIGINT;
    v_min_amount NUMERIC;
    v_max_amount NUMERIC;
BEGIN
    -- Validate tier
    IF p_tier NOT BETWEEN 1 AND 4 THEN
        RAISE EXCEPTION 'Invalid tier. Must be between 1 and 4.';
    END IF;

    -- Determine ROI based on tier
    CASE p_tier
        WHEN 1 THEN
            v_roi_percentage := 100;
            v_min_amount := 100;
            v_max_amount := 499;
        WHEN 2 THEN
            v_roi_percentage := 150;
            v_min_amount := 500;
            v_max_amount := 3999;
        WHEN 3 THEN
            v_roi_percentage := 200;
            v_min_amount := 4000;
            v_max_amount := 9999;
        WHEN 4 THEN
            v_roi_percentage := 300;
            v_min_amount := 10000;
            v_max_amount := NULL; -- No upper limit
    END CASE;

    -- Validate amount is within tier range
    IF p_amount < v_min_amount THEN
        RAISE EXCEPTION 'Amount must be at least $%.', v_min_amount;
    END IF;

    IF v_max_amount IS NOT NULL AND p_amount > v_max_amount THEN
        RAISE EXCEPTION 'Amount cannot exceed $% for Tier %.', v_max_amount, p_tier;
    END IF;

    -- Lock the user profile row for update to prevent race conditions
    SELECT balance INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

    -- Check if profile exists, create if not
    IF v_current_balance IS NULL THEN
        INSERT INTO profiles (id, balance)
        VALUES (p_user_id, 0)
        ON CONFLICT (id) DO NOTHING;
        
        SELECT COALESCE(balance, 0) INTO v_current_balance
        FROM profiles
        WHERE id = p_user_id;
    END IF;

    -- Check sufficient balance
    IF COALESCE(v_current_balance, 0) < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance. Current balance: $%. Required: $%.', 
            COALESCE(v_current_balance, 0), p_amount;
    END IF;

    -- Calculate profit based on ROI
    v_profit := p_amount * (v_roi_percentage / 100);

    -- Calculate end date (14 days from now)
    v_end_date := NOW() + INTERVAL '14 days';

    -- Deduct amount from balance
    UPDATE profiles
    SET balance = balance - p_amount
    WHERE id = p_user_id;

    -- Insert investment record
    INSERT INTO investments (user_id, tier, amount, roi_percentage, profit, start_date, end_date, status)
    VALUES (p_user_id, p_tier, p_amount, v_roi_percentage, v_profit, NOW(), v_end_date, 'active')
    RETURNING id INTO v_investment_id;

    RETURN v_investment_id;
END;
$$;

-- Grant execute permission on invest function to authenticated users
GRANT EXECUTE ON FUNCTION invest(UUID, NUMERIC, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION invest(UUID, NUMERIC, INT) TO anon;
GRANT EXECUTE ON FUNCTION process_mature_investments() TO authenticated;
GRANT EXECUTE ON FUNCTION process_mature_investments() TO anon;

-- =====================================================
-- Uncomment below to add a trigger for automatic profile creation on user signup
-- =====================================================
/*
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, balance)
    VALUES (NEW.id, 0)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
*/
