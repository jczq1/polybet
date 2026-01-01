-- CMU Predictions Platform Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE market_status AS ENUM ('open', 'closed', 'resolved');
CREATE TYPE transaction_type AS ENUM ('signup_bonus', 'monthly_bonus', 'bet_placed', 'bet_won', 'bet_refund');

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 1000,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_credit_bonus_at TIMESTAMPTZ DEFAULT NULL
);

-- Markets table
CREATE TABLE markets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status market_status NOT NULL DEFAULT 'open',
  closes_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Market options table
CREATE TABLE market_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_winner BOOLEAN DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bets table
CREATE TABLE bets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES market_options(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  potential_payout INTEGER NOT NULL CHECK (potential_payout > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transactions table (for credit history)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type transaction_type NOT NULL,
  reference_id UUID DEFAULT NULL,
  description TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_markets_status ON markets(status);
CREATE INDEX idx_markets_category ON markets(category);
CREATE INDEX idx_markets_closes_at ON markets(closes_at);
CREATE INDEX idx_market_options_market_id ON market_options(market_id);
CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_market_id ON bets(market_id);
CREATE INDEX idx_bets_created_at ON bets(created_at);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Markets policies
CREATE POLICY "Anyone can view markets" ON markets
  FOR SELECT USING (true);

CREATE POLICY "Admins can create markets" ON markets
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update markets" ON markets
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Market options policies
CREATE POLICY "Anyone can view market options" ON market_options
  FOR SELECT USING (true);

CREATE POLICY "Admins can create market options" ON market_options
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update market options" ON market_options
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Bets policies
CREATE POLICY "Users can view own bets" ON bets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view bets for betting pool calculation" ON bets
  FOR SELECT USING (true);

CREATE POLICY "Users can place bets" ON bets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name, credits)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1)),
    1000
  );

  -- Create signup bonus transaction
  INSERT INTO transactions (user_id, amount, type, description)
  VALUES (NEW.id, 1000, 'signup_bonus', 'Welcome bonus credits');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to claim monthly bonus
CREATE OR REPLACE FUNCTION claim_monthly_bonus(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  last_bonus TIMESTAMPTZ;
  current_month_start TIMESTAMPTZ;
BEGIN
  -- Get the start of current month
  current_month_start := DATE_TRUNC('month', NOW());

  -- Get user's last bonus date
  SELECT last_credit_bonus_at INTO last_bonus
  FROM profiles WHERE id = user_uuid;

  -- Check if bonus already claimed this month
  IF last_bonus IS NOT NULL AND last_bonus >= current_month_start THEN
    RETURN FALSE;
  END IF;

  -- Award the bonus
  UPDATE profiles
  SET credits = credits + 200,
      last_credit_bonus_at = NOW()
  WHERE id = user_uuid;

  -- Record the transaction
  INSERT INTO transactions (user_id, amount, type, description)
  VALUES (user_uuid, 200, 'monthly_bonus', 'Monthly bonus credits');

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to place a bet
CREATE OR REPLACE FUNCTION place_bet(
  p_user_id UUID,
  p_market_id UUID,
  p_option_id UUID,
  p_amount INTEGER
)
RETURNS UUID AS $$
DECLARE
  v_market_status market_status;
  v_market_closes_at TIMESTAMPTZ;
  v_user_credits INTEGER;
  v_total_pool INTEGER;
  v_option_pool INTEGER;
  v_potential_payout INTEGER;
  v_bet_id UUID;
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

  -- Calculate potential payout using parimutuel system
  SELECT COALESCE(SUM(amount), 0) INTO v_total_pool
  FROM bets WHERE market_id = p_market_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_option_pool
  FROM bets WHERE market_id = p_market_id AND option_id = p_option_id;

  -- New total pool after this bet
  v_total_pool := v_total_pool + p_amount;
  v_option_pool := v_option_pool + p_amount;

  -- Calculate potential payout (proportional share of total pool)
  IF v_option_pool > 0 THEN
    v_potential_payout := (p_amount * v_total_pool) / v_option_pool;
  ELSE
    v_potential_payout := v_total_pool;
  END IF;

  -- Ensure minimum payout is the bet amount
  IF v_potential_payout < p_amount THEN
    v_potential_payout := p_amount;
  END IF;

  -- Deduct credits from user
  UPDATE profiles SET credits = credits - p_amount
  WHERE id = p_user_id;

  -- Create the bet
  INSERT INTO bets (user_id, market_id, option_id, amount, potential_payout)
  VALUES (p_user_id, p_market_id, p_option_id, p_amount, v_potential_payout)
  RETURNING id INTO v_bet_id;

  -- Record the transaction
  INSERT INTO transactions (user_id, amount, type, reference_id, description)
  VALUES (p_user_id, -p_amount, 'bet_placed', v_bet_id, 'Bet placed');

  RETURN v_bet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to resolve a market
CREATE OR REPLACE FUNCTION resolve_market(
  p_market_id UUID,
  p_winning_option_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_total_pool INTEGER;
  v_winning_pool INTEGER;
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

  -- Calculate pools
  SELECT COALESCE(SUM(amount), 0) INTO v_total_pool
  FROM bets WHERE market_id = p_market_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_winning_pool
  FROM bets WHERE market_id = p_market_id AND option_id = p_winning_option_id;

  -- Distribute winnings
  IF v_winning_pool > 0 THEN
    FOR v_bet IN
      SELECT * FROM bets
      WHERE market_id = p_market_id AND option_id = p_winning_option_id
    LOOP
      DECLARE
        v_payout INTEGER;
      BEGIN
        -- Calculate proportional payout
        v_payout := (v_bet.amount * v_total_pool) / v_winning_pool;

        -- Credit the winner
        UPDATE profiles SET credits = credits + v_payout
        WHERE id = v_bet.user_id;

        -- Record the winning transaction
        INSERT INTO transactions (user_id, amount, type, reference_id, description)
        VALUES (v_bet.user_id, v_payout, 'bet_won', v_bet.id, 'Winning bet payout');
      END;
    END LOOP;
  ELSE
    -- No winners - refund all bets
    FOR v_bet IN SELECT * FROM bets WHERE market_id = p_market_id
    LOOP
      UPDATE profiles SET credits = credits + v_bet.amount
      WHERE id = v_bet.user_id;

      INSERT INTO transactions (user_id, amount, type, reference_id, description)
      VALUES (v_bet.user_id, v_bet.amount, 'bet_refund', v_bet.id, 'Market resolved with no winners - refund');
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for leaderboard (30-day trailing ROI)
CREATE OR REPLACE VIEW leaderboard_30d AS
WITH user_bets AS (
  SELECT
    b.user_id,
    SUM(b.amount) as total_wagered,
    SUM(CASE WHEN mo.is_winner = true THEN
      (b.amount * (SELECT COALESCE(SUM(amount), 0) FROM bets WHERE market_id = b.market_id)) /
      NULLIF((SELECT COALESCE(SUM(amount), 0) FROM bets WHERE market_id = b.market_id AND option_id = b.option_id), 0)
    ELSE 0 END) as total_won
  FROM bets b
  JOIN market_options mo ON mo.id = b.option_id
  JOIN markets m ON m.id = b.market_id
  WHERE b.created_at >= NOW() - INTERVAL '30 days'
    AND m.status = 'resolved'
  GROUP BY b.user_id
)
SELECT
  p.id,
  p.display_name,
  p.credits,
  COALESCE(ub.total_wagered, 0) as total_wagered,
  COALESCE(ub.total_won, 0) as total_won,
  CASE
    WHEN COALESCE(ub.total_wagered, 0) = 0 THEN 0
    ELSE ROUND(((COALESCE(ub.total_won, 0) - COALESCE(ub.total_wagered, 0))::NUMERIC / ub.total_wagered) * 100, 2)
  END as roi_percentage
FROM profiles p
LEFT JOIN user_bets ub ON ub.user_id = p.id
ORDER BY roi_percentage DESC, total_won DESC;
