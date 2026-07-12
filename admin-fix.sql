-- =====================================================
-- Apex Quant - Admin Panel Data Loading Fix
-- Run this in Supabase SQL Editor AFTER admin-setup.sql
-- =====================================================

-- =====================================================
-- 1. RLS Policies for Profiles (Admin can view all users)
-- =====================================================

-- First, ensure profiles table has RLS enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile (except is_admin and status)
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles AS p
            WHERE p.id = auth.uid()
            AND p.is_admin = true
        )
    );

-- Admins can update any profile
CREATE POLICY "Admins can update any profile" ON profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles AS p
            WHERE p.id = auth.uid()
            AND p.is_admin = true
        )
    );

-- =====================================================
-- 2. RLS Policies for Investments (Admin can view all)
-- =====================================================

-- Drop existing policy
DROP POLICY IF EXISTS "users_own_investments" ON investments;
DROP POLICY IF EXISTS "Admins can view all investments" ON investments;

-- Users can view their own investments
CREATE POLICY "Users can view own investments" ON investments
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own investments (via invest function)
CREATE POLICY "Users can insert own investments" ON investments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can view all investments
CREATE POLICY "Admins can view all investments" ON investments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles AS p
            WHERE p.id = auth.uid()
            AND p.is_admin = true
        )
    );

-- =====================================================
-- 3. SECURITY DEFINER Functions for Admin Data Access
-- These bypass RLS and directly query tables
-- Only callable by authenticated admin users
-- =====================================================

-- Get all users with their email (admin only)
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
    -- Verify caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND is_admin = true
        AND status != 'frozen'
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    RETURN QUERY
    SELECT 
        p.id,
        u.email::TEXT,
        COALESCE(p.balance, 0)::NUMERIC,
        COALESCE(p.status, 'active')::TEXT,
        COALESCE(p.is_admin, false)::BOOLEAN,
        p.created_at,
        p.updated_at
    FROM profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_users() TO anon;

-- Get all deposits with user email (admin only)
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
    -- Verify caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND is_admin = true
        AND status != 'frozen'
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    RETURN QUERY
    SELECT 
        d.id,
        d.user_id,
        u.email::TEXT,
        d.amount,
        d.transaction_hash,
        d.status,
        d.created_at
    FROM deposits d
    LEFT JOIN auth.users u ON u.id = d.user_id
    ORDER BY d.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_deposits() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_deposits() TO anon;

-- Get all withdrawals with user email (admin only)
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
    -- Verify caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND is_admin = true
        AND status != 'frozen'
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    RETURN QUERY
    SELECT 
        w.id,
        w.user_id,
        u.email::TEXT,
        w.amount,
        w.method,
        w.details,
        w.status,
        w.created_at
    FROM withdrawals w
    LEFT JOIN auth.users u ON u.id = w.user_id
    ORDER BY w.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_withdrawals() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_withdrawals() TO anon;

-- Get all investments with user email (admin only)
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
    -- Verify caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND is_admin = true
        AND status != 'frozen'
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    RETURN QUERY
    SELECT 
        i.id,
        i.user_id,
        u.email::TEXT,
        i.tier,
        i.amount,
        i.roi_percentage,
        i.profit,
        i.start_date,
        i.end_date,
        i.status,
        i.created_at
    FROM investments i
    LEFT JOIN auth.users u ON u.id = i.user_id
    ORDER BY i.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_investments() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_investments() TO anon;

-- =====================================================
-- 4. Admin Overview Stats Functions
-- =====================================================

-- Get admin dashboard overview stats
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
    -- Verify caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND is_admin = true
        AND status != 'frozen'
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM profiles)::BIGINT,
        (SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE status = 'approved')::NUMERIC,
        (SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE status = 'approved')::NUMERIC,
        (SELECT COALESCE(SUM(amount), 0) FROM investments WHERE status = 'active')::NUMERIC,
        (SELECT COUNT(*) FROM deposits WHERE status = 'pending')::BIGINT,
        (SELECT COUNT(*) FROM withdrawals WHERE status = 'pending')::BIGINT,
        (SELECT COUNT(*) FROM investments WHERE status = 'active')::BIGINT;
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_overview_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_overview_stats() TO anon;

-- =====================================================
-- 5. Get Recent Activity for Dashboard
-- =====================================================

-- Get recent deposits (admin only)
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
    -- Verify caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND is_admin = true
        AND status != 'frozen'
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    RETURN QUERY
    SELECT 
        d.id,
        d.user_id,
        u.email::TEXT,
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

-- Get recent withdrawals (admin only)
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
    -- Verify caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND is_admin = true
        AND status != 'frozen'
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    RETURN QUERY
    SELECT 
        w.id,
        w.user_id,
        u.email::TEXT,
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
-- 6. Grant Additional Permissions (safety net)
-- =====================================================

-- Ensure anon role can also call these (for testing)
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON profiles TO anon;
GRANT SELECT ON deposits TO anon;
GRANT SELECT ON withdrawals TO anon;
GRANT SELECT ON investments TO anon;
