-- Apex Quant Database Setup
-- ========================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users,
  balance NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'frozen')),
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();

CREATE TABLE IF NOT EXISTS investments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  tier INTEGER CHECK (tier BETWEEN 1 AND 4),
  amount NUMERIC NOT NULL,
  roi_percentage NUMERIC NOT NULL,
  profit NUMERIC NOT NULL,
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed'))
);

CREATE TABLE IF NOT EXISTS deposits (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  amount NUMERIC NOT NULL,
  transaction_hash TEXT,
  chain TEXT DEFAULT 'bsc' CHECK (chain IN ('bsc', 'tron')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  amount NUMERIC NOT NULL,
  method TEXT,
  details JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS balance_adjustments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  amount NUMERIC NOT NULL,
  reason TEXT,
  admin_id UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_own_profile ON profiles;
CREATE POLICY users_own_profile
ON profiles
FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS users_own_investments ON investments;
CREATE POLICY users_own_investments
ON investments
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS users_own_investments_insert ON investments;
CREATE POLICY users_own_investments_insert
ON investments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS users_own_deposits ON deposits;
CREATE POLICY users_own_deposits
ON deposits
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS users_own_deposits_insert ON deposits;
CREATE POLICY users_own_deposits_insert
ON deposits
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS users_own_withdrawals ON withdrawals;
CREATE POLICY users_own_withdrawals
ON withdrawals
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS users_own_withdrawals_insert ON withdrawals;
CREATE POLICY users_own_withdrawals_insert
ON withdrawals
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION invest(p_user_id UUID, p_amount NUMERIC, p_tier INT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_roi NUMERIC;
  v_profit NUMERIC;
  v_balance NUMERIC;
  v_id BIGINT;
  v_min NUMERIC;
  v_max NUMERIC;
BEGIN
  IF p_tier = 1 THEN
    v_roi := 100; v_min := 100; v_max := 499;
  ELSIF p_tier = 2 THEN
    v_roi := 150; v_min := 500; v_max := 3999;
  ELSIF p_tier = 3 THEN
    v_roi := 200; v_min := 4000; v_max := 9999;
  ELSIF p_tier = 4 THEN
    v_roi := 300; v_min := 10000; v_max := NULL;
  ELSE
    RAISE EXCEPTION 'Invalid tier';
  END IF;

  IF p_amount < v_min THEN
    RAISE EXCEPTION 'Minimum for Tier % is $%', p_tier, v_min;
  END IF;

  IF v_max IS NOT NULL AND p_amount > v_max THEN
    RAISE EXCEPTION 'Maximum for Tier % is $%', p_tier, v_max;
  END IF;

  SELECT balance INTO v_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  v_profit := (p_amount * v_roi) / 100;

  UPDATE profiles
  SET balance = balance - p_amount
  WHERE id = p_user_id;

  INSERT INTO investments (user_id, tier, amount, roi_percentage, profit, end_date)
  VALUES (p_user_id, p_tier, p_amount, v_roi, v_profit, NOW() + INTERVAL '14 days')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION process_mature_investments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT *
    FROM investments
    WHERE status = 'active' AND end_date <= NOW()
  LOOP
    UPDATE profiles
    SET balance = balance + r.amount + r.profit
    WHERE id = r.user_id;

    UPDATE investments
    SET status = 'completed'
    WHERE id = r.id;
  END LOOP;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid
  FROM cron.job
  WHERE jobname = 'process-investments';

  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule('process-investments', '*/5 * * * *', 'SELECT process_mature_investments()');

CREATE OR REPLACE FUNCTION request_deposit(amount NUMERIC, tx_hash TEXT, chain TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO deposits (user_id, amount, transaction_hash, chain)
  VALUES (auth.uid(), amount, tx_hash, chain);
END;
$$;

CREATE OR REPLACE FUNCTION request_withdrawal(amount NUMERIC, method TEXT, details_json JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO withdrawals (user_id, amount, method, details)
  VALUES (auth.uid(), amount, method, details_json);
END;
$$;

CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE(id UUID, balance NUMERIC, status TEXT, is_admin BOOLEAN, created_at TIMESTAMPTZ, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT (SELECT is_admin FROM profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT p.id, p.balance, p.status, p.is_admin, p.created_at, u.email::TEXT
  FROM profiles p
  JOIN auth.users u ON p.id = u.id
  ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_all_deposits()
RETURNS TABLE(id BIGINT, user_id UUID, amount NUMERIC, transaction_hash TEXT, chain TEXT, status TEXT, created_at TIMESTAMPTZ, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT (SELECT is_admin FROM profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT d.id, d.user_id, d.amount, d.transaction_hash, d.chain, d.status, d.created_at, u.email::TEXT
  FROM deposits d
  JOIN auth.users u ON d.user_id = u.id
  ORDER BY d.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_all_withdrawals()
RETURNS TABLE(id BIGINT, user_id UUID, amount NUMERIC, method TEXT, details JSONB, status TEXT, created_at TIMESTAMPTZ, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT (SELECT is_admin FROM profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT w.id, w.user_id, w.amount, w.method, w.details, w.status, w.created_at, u.email::TEXT
  FROM withdrawals w
  JOIN auth.users u ON w.user_id = u.id
  ORDER BY w.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_all_investments()
RETURNS TABLE(id BIGINT, user_id UUID, tier INTEGER, amount NUMERIC, roi_percentage NUMERIC, profit NUMERIC, start_date TIMESTAMPTZ, end_date TIMESTAMPTZ, status TEXT, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT (SELECT is_admin FROM profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT i.id, i.user_id, i.tier, i.amount, i.roi_percentage, i.profit, i.start_date, i.end_date, i.status, u.email::TEXT
  FROM investments i
  JOIN auth.users u ON i.user_id = u.id
  ORDER BY i.start_date DESC;
END;
$$;

CREATE OR REPLACE FUNCTION approve_deposit(deposit_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE r RECORD;
BEGIN
  IF NOT (SELECT is_admin FROM profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO r FROM deposits WHERE id = deposit_id;
  IF r.status != 'pending' THEN
    RAISE EXCEPTION 'Not pending';
  END IF;

  UPDATE profiles
  SET balance = balance + r.amount
  WHERE id = r.user_id;

  UPDATE deposits
  SET status = 'approved'
  WHERE id = deposit_id;
END;
$$;

CREATE OR REPLACE FUNCTION reject_deposit(deposit_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT (SELECT is_admin FROM profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE deposits
  SET status = 'rejected'
  WHERE id = deposit_id;
END;
$$;

CREATE OR REPLACE FUNCTION approve_withdrawal(withdrawal_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE r RECORD;
BEGIN
  IF NOT (SELECT is_admin FROM profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO r FROM withdrawals WHERE id = withdrawal_id;
  IF r.status != 'pending' THEN
    RAISE EXCEPTION 'Not pending';
  END IF;

  UPDATE profiles
  SET balance = balance - r.amount
  WHERE id = r.user_id;

  UPDATE withdrawals
  SET status = 'approved'
  WHERE id = withdrawal_id;
END;
$$;

CREATE OR REPLACE FUNCTION reject_withdrawal(withdrawal_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT (SELECT is_admin FROM profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE withdrawals
  SET status = 'rejected'
  WHERE id = withdrawal_id;
END;
$$;

CREATE OR REPLACE FUNCTION freeze_user(target_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT (SELECT is_admin FROM profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE profiles
  SET status = 'frozen'
  WHERE id = target_id;
END;
$$;

CREATE OR REPLACE FUNCTION unfreeze_user(target_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT (SELECT is_admin FROM profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE profiles
  SET status = 'active'
  WHERE id = target_id;
END;
$$;

CREATE OR REPLACE FUNCTION adjust_balance(target_id UUID, adj_amount NUMERIC, reason TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT (SELECT is_admin FROM profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE profiles
  SET balance = balance + adj_amount
  WHERE id = target_id;

  INSERT INTO balance_adjustments (user_id, amount, reason, admin_id)
  VALUES (target_id, adj_amount, reason, auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION invest(UUID, NUMERIC, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION request_deposit(NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION request_withdrawal(NUMERIC, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_deposits() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_withdrawals() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_investments() TO authenticated;
GRANT EXECUTE ON FUNCTION approve_deposit(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_deposit(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_withdrawal(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_withdrawal(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION freeze_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unfreeze_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION adjust_balance(UUID, NUMERIC, TEXT) TO authenticated;
