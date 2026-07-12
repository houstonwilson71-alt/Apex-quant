-- =====================================================
-- Apex Quant Investment Platform - Deposit Update
-- Dual Chain USDT Support (BSC & TRC-20)
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Add chain column to deposits table
-- Supports BSC (BEP-20) and Tron (TRC-20) networks
ALTER TABLE deposits 
ADD COLUMN IF NOT EXISTS chain TEXT 
CHECK (chain IN ('bsc', 'tron')) 
DEFAULT 'bsc';

-- 2. Update existing deposits with default chain value
UPDATE deposits SET chain = 'bsc' WHERE chain IS NULL;

-- 3. Create or replace the request_deposit function with chain support
CREATE OR REPLACE FUNCTION request_deposit(amount NUMERIC, tx_hash TEXT, chain TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Validate chain parameter
    IF chain NOT IN ('bsc', 'tron') THEN
        RAISE EXCEPTION 'Invalid chain. Must be bsc or tron';
    END IF;
    
    -- Validate amount
    IF amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be positive';
    END IF;
    
    -- Validate transaction hash
    IF tx_hash IS NULL OR tx_hash = '' THEN
        RAISE EXCEPTION 'Transaction hash is required';
    END IF;
    
    -- Insert deposit with chain information
    INSERT INTO deposits(user_id, amount, transaction_hash, chain)
    VALUES (auth.uid(), amount, tx_hash, chain);
END;
$$;

-- 4. Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION request_deposit(NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION request_deposit(NUMERIC, TEXT, TEXT) TO anon;

-- 5. Update approve_deposit function to handle chain (optional enhancement)
-- The function remains mostly the same but will now work with the chain column
-- No changes needed as it already approves by deposit_id regardless of chain

-- 6. Update reject_deposit function (no changes needed - works with chain column automatically)

-- =====================================================
-- Notes:
-- - BSC (Binance Smart Chain) wallet: 0xbe438a2c7fe9bb534a8b8d06c96e42e9b6620812
-- - Tron wallet: TEmM5aKQTcwQSdnZMGXMeEJMHB6Ko7noqJ
-- =====================================================
