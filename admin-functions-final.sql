-- =====================================================
-- Apex Quant - Admin RPC Functions
-- Run this in Supabase SQL Editor
-- =====================================================

-- Function to get all users (admin only)
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE(id uuid, balance numeric, status text, is_admin boolean, created_at timestamptz, email text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (SELECT is_admin FROM profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
  SELECT p.id, p.balance, p.status, p.is_admin, p.created_at, u.email::text
  FROM profiles p
  JOIN auth.users u ON p.id = u.id
  ORDER BY p.created_at DESC;
END;
$$;

-- Function to get all deposits
CREATE OR REPLACE FUNCTION get_all_deposits()
RETURNS TABLE(id bigint, user_id uuid, amount numeric, transaction_hash text, status text, chain text, created_at timestamptz, email text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (SELECT is_admin FROM profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
  SELECT d.id, d.user_id, d.amount, d.transaction_hash, d.status, d.chain, d.created_at, u.email::text
  FROM deposits d
  JOIN auth.users u ON d.user_id = u.id
  ORDER BY d.created_at DESC;
END;
$$;

-- Function to get all withdrawals
CREATE OR REPLACE FUNCTION get_all_withdrawals()
RETURNS TABLE(id bigint, user_id uuid, amount numeric, method text, details jsonb, status text, created_at timestamptz, email text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (SELECT is_admin FROM profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
  SELECT w.id, w.user_id, w.amount, w.method, w.details, w.status, w.created_at, u.email::text
  FROM withdrawals w
  JOIN auth.users u ON w.user_id = u.id
  ORDER BY w.created_at DESC;
END;
$$;

-- Function to get all investments
CREATE OR REPLACE FUNCTION get_all_investments()
RETURNS TABLE(id bigint, user_id uuid, tier integer, amount numeric, roi_percentage numeric, profit numeric, start_date timestamptz, end_date timestamptz, status text, email text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (SELECT is_admin FROM profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
  SELECT i.id, i.user_id, i.tier, i.amount, i.roi_percentage, i.profit, i.start_date, i.end_date, i.status, u.email::text
  FROM investments i
  JOIN auth.users u ON i.user_id = u.id
  ORDER BY i.start_date DESC;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_deposits() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_withdrawals() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_investments() TO authenticated;

-- Also grant to anon for testing
GRANT EXECUTE ON FUNCTION get_all_users() TO anon;
GRANT EXECUTE ON FUNCTION get_all_deposits() TO anon;
GRANT EXECUTE ON FUNCTION get_all_withdrawals() TO anon;
GRANT EXECUTE ON FUNCTION get_all_investments() TO anon;
