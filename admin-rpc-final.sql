-- =====================================================
-- Apex Quant - Final Admin Panel Data Loading Fix
-- Run this in Supabase SQL Editor AFTER admin-setup.sql and admin-fix.sql
-- This file creates guaranteed-to-work RPC functions for admin data access
-- =====================================================

-- =====================================================
-- 1. Helper function to check admin status (reusable)
-- =====================================================

CREATE OR REPLACE FUNCTION check_is_admin()
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
        AND status = 'active'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION check_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION check_is_admin() TO anon;

-- =====================================================
-- 2. Get All Users (Admin Only) - Uses SECURITY DEFINER
-- =====================================================

DROP FUNCTION IF EXISTS get_admin_users();
CREATE OR REPLACE FUNCTION get_admin_users()
RETURNS TABLE (
    user_id UUID,
    user_email TEXT,
    user_balance NUMERIC,
    user_status TEXT,
    user_is_admin BOOLEAN,
    user_created_at TIMESTAMPTZ,
    user_updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if caller is admin
    IF NOT check_is_admin() THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    RETURN QUERY
    SELECT 
        p.id AS user_id,
        COALESCE(u.email, 'N/A')::TEXT AS user_email,
        COALESCE(p.balance, 0)::NUMERIC AS user_balance,
        COALESCE(p.status, 'active')::TEXT AS user_status,
        COALESCE(p.is_admin, false)::BOOLEAN AS user_is_admin,
        p.created_at AS user_created_at,
        p.updated_at AS user_updated_at
    FROM profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_users() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_users() TO anon;

-- =====================================================
-- 3. Get All Deposits (Admin Only) - Uses SECURITY DEFINER
-- =====================================================

DROP FUNCTION IF EXISTS get_admin_deposits();
CREATE OR REPLACE FUNCTION get_admin_deposits()
RETURNS TABLE (
    deposit_id BIGINT,
    deposit_user_id UUID,
    deposit_user_email TEXT,
    deposit_amount NUMERIC,
    deposit_transaction_hash TEXT,
    deposit_chain TEXT,
    deposit_status TEXT,
    deposit_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if caller is admin
    IF NOT check_is_admin() THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    RETURN QUERY
    SELECT 
        d.id AS deposit_id,
        d.user_id AS deposit_user_id,
        COALESCE(u.email, 'N/A')::TEXT AS deposit_user_email,
        d.amount AS deposit_amount,
        d.transaction_hash AS deposit_transaction_hash,
        COALESCE(d.chain, 'bsc')::TEXT AS deposit_chain,
        COALESCE(d.status, 'pending')::TEXT AS deposit_status,
        d.created_at AS deposit_created_at
    FROM deposits d
    LEFT JOIN auth.users u ON u.id = d.user_id
    ORDER BY d.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_deposits() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_deposits() TO anon;

-- =====================================================
-- 4. Get All Withdrawals (Admin Only) - Uses SECURITY DEFINER
-- =====================================================

DROP FUNCTION IF EXISTS get_admin_withdrawals();
CREATE OR REPLACE FUNCTION get_admin_withdrawals()
RETURNS TABLE (
    withdrawal_id BIGINT,
    withdrawal_user_id UUID,
    withdrawal_user_email TEXT,
    withdrawal_amount NUMERIC,
    withdrawal_method TEXT,
    withdrawal_details JSONB,
    withdrawal_status TEXT,
    withdrawal_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if caller is admin
    IF NOT check_is_admin() THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    RETURN QUERY
    SELECT 
        w.id AS withdrawal_id,
        w.user_id AS withdrawal_user_id,
        COALESCE(u.email, 'N/A')::TEXT AS withdrawal_user_email,
        w.amount AS withdrawal_amount,
        w.method AS withdrawal_method,
        COALESCE(w.details, '{}'::JSONB) AS withdrawal_details,
        COALESCE(w.status, 'pending')::TEXT AS withdrawal_status,
        w.created_at AS withdrawal_created_at
    FROM withdrawals w
    LEFT JOIN auth.users u ON u.id = w.user_id
    ORDER BY w.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_withdrawals() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_withdrawals() TO anon;

-- =====================================================
-- 5. Get All Investments (Admin Only) - Uses SECURITY DEFINER
-- =====================================================

DROP FUNCTION IF EXISTS get_admin_investments();
CREATE OR REPLACE FUNCTION get_admin_investments()
RETURNS TABLE (
    investment_id BIGINT,
    investment_user_id UUID,
    investment_user_email TEXT,
    investment_tier INTEGER,
    investment_amount NUMERIC,
    investment_roi_percentage NUMERIC,
    investment_profit NUMERIC,
    investment_start_date TIMESTAMPTZ,
    investment_end_date TIMESTAMPTZ,
    investment_status TEXT,
    investment_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if caller is admin
    IF NOT check_is_admin() THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    RETURN QUERY
    SELECT 
        i.id AS investment_id,
        i.user_id AS investment_user_id,
        COALESCE(u.email, 'N/A')::TEXT AS investment_user_email,
        i.tier AS investment_tier,
        i.amount AS investment_amount,
        i.roi_percentage AS investment_roi_percentage,
        i.profit AS investment_profit,
        i.start_date AS investment_start_date,
        i.end_date AS investment_end_date,
        COALESCE(i.status, 'active')::TEXT AS investment_status,
        i.created_at AS investment_created_at
    FROM investments i
    LEFT JOIN auth.users u ON u.id = i.user_id
    ORDER BY i.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_investments() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_investments() TO anon;

-- =====================================================
-- 6. Backward Compatibility Aliases (legacy function names)
-- These aliases ensure compatibility with existing code
-- =====================================================

-- Alias for get_all_users -> get_admin_users
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE (
    id UUID,
    email TEXT,
    balance NUMERIC,
    status TEXT,
    is_admin BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.user_id,
        r.user_email,
        r.user_balance,
        r.user_status,
        r.user_is_admin,
        r.user_created_at,
        r.user_updated_at
    FROM get_admin_users() r;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_users() TO anon;

-- Alias for get_all_deposits -> get_admin_deposits
CREATE OR REPLACE FUNCTION get_all_deposits()
RETURNS TABLE (
    id BIGINT,
    user_id UUID,
    user_email TEXT,
    amount NUMERIC,
    transaction_hash TEXT,
    status TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.deposit_id,
        r.deposit_user_id,
        r.deposit_user_email,
        r.deposit_amount,
        r.deposit_transaction_hash,
        r.deposit_status,
        r.deposit_created_at
    FROM get_admin_deposits() r;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_deposits() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_deposits() TO anon;

-- Alias for get_all_withdrawals -> get_admin_withdrawals
CREATE OR REPLACE FUNCTION get_all_withdrawals()
RETURNS TABLE (
    id BIGINT,
    user_id UUID,
    user_email TEXT,
    amount NUMERIC,
    method TEXT,
    details JSONB,
    status TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.withdrawal_id,
        r.withdrawal_user_id,
        r.withdrawal_user_email,
        r.withdrawal_amount,
        r.withdrawal_method,
        r.withdrawal_details,
        r.withdrawal_status,
        r.withdrawal_created_at
    FROM get_admin_withdrawals() r;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_withdrawals() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_withdrawals() TO anon;

-- Alias for get_all_investments -> get_admin_investments
CREATE OR REPLACE FUNCTION get_all_investments()
RETURNS TABLE (
    id BIGINT,
    user_id UUID,
    user_email TEXT,
    tier INTEGER,
    amount NUMERIC,
    roi_percentage NUMERIC,
    profit NUMERIC,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    status TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.investment_id,
        r.investment_user_id,
        r.investment_user_email,
        r.investment_tier,
        r.investment_amount,
        r.investment_roi_percentage,
        r.investment_profit,
        r.investment_start_date,
        r.investment_end_date,
        r.investment_status,
        r.investment_created_at
    FROM get_admin_investments() r;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_investments() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_investments() TO anon;

-- =====================================================
-- 7. Additional Admin Dashboard Functions
-- =====================================================

-- Get admin overview stats
CREATE OR REPLACE FUNCTION get_admin_overview_stats()
RETURNS TABLE (
    total_users BIGINT,
    total_deposits_amount NUMERIC,
    total_withdrawals_amount NUMERIC,
    total_investments_amount NUMERIC,
    pending_deposits_count BIGINT,
    pending_withdrawals_count BIGINT,
    active_investments_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT check_is_admin() THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM profiles)::BIGINT AS total_users,
        (SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE status = 'approved')::NUMERIC AS total_deposits_amount,
        (SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE status = 'approved')::NUMERIC AS total_withdrawals_amount,
        (SELECT COALESCE(SUM(amount), 0) FROM investments WHERE status = 'active')::NUMERIC AS total_investments_amount,
        (SELECT COUNT(*) FROM deposits WHERE status = 'pending')::BIGINT AS pending_deposits_count,
        (SELECT COUNT(*) FROM withdrawals WHERE status = 'pending')::BIGINT AS pending_withdrawals_count,
        (SELECT COUNT(*) FROM investments WHERE status = 'active')::BIGINT AS active_investments_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_overview_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_overview_stats() TO anon;

-- Get recent deposits
CREATE OR REPLACE FUNCTION get_recent_deposits(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    id BIGINT,
    user_id UUID,
    user_email TEXT,
    amount NUMERIC,
    transaction_hash TEXT,
    status TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT check_is_admin() THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    RETURN QUERY
    SELECT 
        d.id,
        d.user_id,
        COALESCE(u.email, 'N/A')::TEXT AS user_email,
        d.amount,
        d.transaction_hash,
        d.status,
        d.created_at
    FROM deposits d
    LEFT JOIN auth.users u ON u.id = d.user_id
    ORDER BY d.created_at DESC
    LIMIT limit_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_recent_deposits(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_deposits(INTEGER) TO anon;

-- Get recent withdrawals
CREATE OR REPLACE FUNCTION get_recent_withdrawals(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    id BIGINT,
    user_id UUID,
    user_email TEXT,
    amount NUMERIC,
    method TEXT,
    details JSONB,
    status TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT check_is_admin() THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    RETURN QUERY
    SELECT 
        w.id,
        w.user_id,
        COALESCE(u.email, 'N/A')::TEXT AS user_email,
        w.amount,
        w.method,
        w.details,
        w.status,
        w.created_at
    FROM withdrawals w
    LEFT JOIN auth.users u ON u.id = w.user_id
    ORDER BY w.created_at DESC
    LIMIT limit_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_recent_withdrawals(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_withdrawals(INTEGER) TO anon;

-- =====================================================
-- 8. Ensure all grants are in place
-- =====================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON profiles TO anon, authenticated;
GRANT ALL ON deposits TO anon, authenticated;
GRANT ALL ON withdrawals TO anon, authenticated;
GRANT ALL ON investments TO anon, authenticated;
GRANT ALL ON balance_adjustments TO anon, authenticated;

-- Grant on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- =====================================================
-- 9. Verification query (run this in SQL Editor to test)
-- =====================================================

-- SELECT 'RPC Functions Created Successfully' AS status;
-- SELECT proname FROM pg_proc WHERE proname LIKE 'get_admin_%' OR proname LIKE 'get_all_%';
