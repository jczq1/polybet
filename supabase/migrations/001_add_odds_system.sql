-- Migration: Add Odds System
-- This migration adds support for the hybrid AMM odds algorithm
-- Run this in your Supabase SQL Editor after the initial schema

-- =====================================================
-- Step 1: Add new columns to markets table
-- =====================================================

ALTER TABLE markets
ADD COLUMN IF NOT EXISTS total_bets INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS unique_bettors INTEGER NOT NULL DEFAULT 0;

-- =====================================================
-- Step 2: Add new columns to market_options table
-- =====================================================

ALTER TABLE market_options
ADD COLUMN IF NOT EXISTS initial_probability DECIMAL(5,4) NOT NULL DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS current_probability DECIMAL(5,4) NOT NULL DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS total_pool INTEGER NOT NULL DEFAULT 0;

-- =====================================================
-- Step 3: Add new columns to bets table
-- =====================================================

ALTER TABLE bets
ADD COLUMN IF NOT EXISTS odds_at_purchase DECIMAL(5,4) NOT NULL DEFAULT 0.5,
DROP COLUMN IF EXISTS potential_payout;

ALTER TABLE bets
ADD COLUMN IF NOT EXISTS potential_payout INTEGER NOT NULL DEFAULT 0;

-- =====================================================
-- Step 4: Create updated place_bet function with odds
-- =====================================================

CREATE OR REPLACE FUNCTION place_bet_with_odds(
  p_user_id UUID,
  p_market_id UUID,
  p_option_id UUID,
  p_amount INTEGER
)
RETURNS TABLE (
  bet_id UUID,
  odds_at_purchase DECIMAL,
  potential_payout INTEGER,
  new_probability DECIMAL
) AS $$
DECLARE
  v_market_status market_status;
  v_market_closes_at TIMESTAMPTZ;
  v_user_credits INTEGER;
  v_current_probability DECIMAL(5,4);
  v_outcome_pool INTEGER;
  v_total_pool INTEGER;
  v_total_bets INTEGER;
  v_unique_bettors INTEGER;
  v_new_probability DECIMAL(5,4);
  v_potential_payout INTEGER;
  v_bet_id UUID;
  v_virtual_liquidity DECIMAL;
  v_diversity_factor DECIMAL;
  v_effective_decay_rate DECIMAL;
  v_virtual_outcome_pool DECIMAL;
  v_virtual_other_pool DECIMAL;
  v_total_outcome_pool DECIMAL;
  v_total_other_pool DECIMAL;
  v_new_outcome_pool DECIMAL;
  v_new_total_pool DECIMAL;
  -- Algorithm constants
  c_max_virtual_liquidity CONSTANT DECIMAL := 5000;
  c_base_decay_rate CONSTANT DECIMAL := 15;
  c_diversity_threshold CONSTANT DECIMAL := 20;
  c_diversity_decay_bonus CONSTANT DECIMAL := 10;
  c_min_probability CONSTANT DECIMAL := 0.05;
  c_max_probability CONSTANT DECIMAL := 0.95;
BEGIN
  -- Check market is open
  SELECT status, closes_at INTO v_market_status, v_market_closes_at
  FROM markets WHERE id = p_market_id;

  IF v_market_status != 'open' THEN
    RAISE EXCEPTION 'Market is not open for betting';
  END IF;

  IF v_market_closes_at <= NOW() THEN
    RAISE EXCEPTION 'Market has closed';
  END IF;

  -- Check user has enough credits
  SELECT credits INTO v_user_credits
  FROM profiles WHERE id = p_user_id;

  IF v_user_credits < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  -- Get current state
  SELECT current_probability, total_pool INTO v_current_probability, v_outcome_pool
  FROM market_options WHERE id = p_option_id;

  SELECT COALESCE(SUM(mo.total_pool), 0) INTO v_total_pool
  FROM market_options mo WHERE mo.market_id = p_market_id;

  SELECT total_bets, unique_bettors INTO v_total_bets, v_unique_bettors
  FROM markets WHERE id = p_market_id;

  -- Store odds at purchase (BEFORE calculating new odds)
  -- Calculate potential payout at current odds
  v_potential_payout := FLOOR(p_amount / v_current_probability);

  -- =====================================================
  -- Calculate new probability using AMM algorithm
  -- =====================================================

  -- Step 1: Calculate diversity factor (0 to 1)
  v_diversity_factor := LEAST(v_unique_bettors::DECIMAL / c_diversity_threshold, 1.0);

  -- Step 2: Calculate effective decay rate
  v_effective_decay_rate := c_base_decay_rate + (c_diversity_decay_bonus * v_diversity_factor);

  -- Step 3: Calculate virtual liquidity (exponential decay)
  v_virtual_liquidity := c_max_virtual_liquidity * EXP(-v_total_bets::DECIMAL / v_effective_decay_rate);

  -- Step 4: Calculate virtual pools based on current probability
  v_virtual_outcome_pool := v_virtual_liquidity * v_current_probability;
  v_virtual_other_pool := v_virtual_liquidity * (1 - v_current_probability);

  -- Step 5: Calculate total pools (real + virtual)
  v_total_outcome_pool := v_outcome_pool + v_virtual_outcome_pool;
  v_total_other_pool := (v_total_pool - v_outcome_pool) + v_virtual_other_pool;

  -- Step 6: Calculate new pools after bet
  v_new_outcome_pool := v_total_outcome_pool + p_amount;
  v_new_total_pool := v_total_outcome_pool + v_total_other_pool + p_amount;

  -- Step 7: Calculate new probability
  v_new_probability := v_new_outcome_pool / v_new_total_pool;

  -- Step 8: Clamp to bounds
  v_new_probability := GREATEST(c_min_probability, LEAST(c_max_probability, v_new_probability));

  -- =====================================================
  -- Update database
  -- =====================================================

  -- Deduct credits from user
  UPDATE profiles SET credits = credits - p_amount
  WHERE id = p_user_id;

  -- Create the bet
  INSERT INTO bets (user_id, market_id, option_id, amount, odds_at_purchase, potential_payout)
  VALUES (p_user_id, p_market_id, p_option_id, p_amount, v_current_probability, v_potential_payout)
  RETURNING id INTO v_bet_id;

  -- Update option's probability and pool
  UPDATE market_options
  SET current_probability = v_new_probability,
      total_pool = total_pool + p_amount
  WHERE id = p_option_id;

  -- Update other options' probabilities proportionally
  UPDATE market_options mo
  SET current_probability = GREATEST(c_min_probability, LEAST(c_max_probability,
    (1 - v_new_probability) * (mo.current_probability / NULLIF(
      (SELECT SUM(current_probability) FROM market_options WHERE market_id = p_market_id AND id != p_option_id), 0
    ))
  ))
  WHERE mo.market_id = p_market_id AND mo.id != p_option_id;

  -- Update market stats
  UPDATE markets
  SET total_bets = total_bets + 1,
      unique_bettors = (
        SELECT COUNT(DISTINCT user_id) FROM bets WHERE market_id = p_market_id
      )
  WHERE id = p_market_id;

  -- Record the transaction
  INSERT INTO transactions (user_id, amount, type, reference_id, description)
  VALUES (p_user_id, -p_amount, 'bet_placed', v_bet_id, 'Bet placed');

  -- Return result
  RETURN QUERY SELECT v_bet_id, v_current_probability, v_potential_payout, v_new_probability;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Step 5: Update resolve_market function for new payout system
-- =====================================================

CREATE OR REPLACE FUNCTION resolve_market_with_odds(
  p_market_id UUID,
  p_winning_option_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_bet RECORD;
BEGIN
  -- Update market status
  UPDATE markets
  SET status = 'resolved', resolved_at = NOW()
  WHERE id = p_market_id;

  -- Mark winning option
  UPDATE market_options
  SET is_winner = (id = p_winning_option_id)
  WHERE market_id = p_market_id;

  -- Distribute winnings based on odds at purchase
  FOR v_bet IN
    SELECT * FROM bets
    WHERE market_id = p_market_id AND option_id = p_winning_option_id
  LOOP
    -- Credit the winner with their potential payout
    UPDATE profiles SET credits = credits + v_bet.potential_payout
    WHERE id = v_bet.user_id;

    -- Record the winning transaction
    INSERT INTO transactions (user_id, amount, type, reference_id, description)
    VALUES (v_bet.user_id, v_bet.potential_payout, 'bet_won', v_bet.id,
      'Winning bet payout at ' || ROUND(v_bet.odds_at_purchase * 100, 1) || '% odds');
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Step 6: Create indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_market_options_market_probability
ON market_options(market_id, current_probability);

CREATE INDEX IF NOT EXISTS idx_bets_market_user
ON bets(market_id, user_id);

-- =====================================================
-- Step 7: Grant permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION place_bet_with_odds TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_market_with_odds TO authenticated;
