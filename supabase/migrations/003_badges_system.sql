-- =============================================
-- BADGE SYSTEM FOR PREDICTION MARKET PLATFORM
-- =============================================

-- 1. BADGES TABLE - Stores badge definitions (admin configurable)
-- =============================================
CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  icon text NOT NULL DEFAULT '🏆',
  condition_type text NOT NULL,
  threshold numeric DEFAULT 1,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Valid condition types:
-- win_streak: consecutive wins >= threshold
-- lose_streak: consecutive losses >= threshold
-- total_bets: lifetime bets >= threshold
-- all_in_win: bet 100% of balance and won (threshold ignored)
-- all_in_lose: bet 100% of balance and lost (threshold ignored)
-- leaderboard_rank: achieved rank <= threshold on 30-day ROI leaderboard
-- hold_duration_win: held position for >= threshold days and won
-- low_probability_win: won with odds < threshold% probability
-- minority_win: won with < threshold% of total pool
-- single_bet_amount: made a single bet >= threshold credits
-- first_bettor_count: was first to bet on >= threshold different markets

-- 2. USER_BADGES TABLE - Tracks earned badges
-- =============================================
CREATE TABLE IF NOT EXISTS user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at timestamptz DEFAULT now(),
  -- Metadata about how badge was earned (for display purposes)
  metadata jsonb DEFAULT '{}',
  UNIQUE(user_id, badge_id)
);

-- 3. USER_STATS TABLE - Efficiently track ongoing stats
-- =============================================
CREATE TABLE IF NOT EXISTS user_stats (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  -- Streak tracking
  current_win_streak integer DEFAULT 0,
  current_lose_streak integer DEFAULT 0,
  max_win_streak integer DEFAULT 0,
  max_lose_streak integer DEFAULT 0,
  -- Bet counts
  lifetime_bets integer DEFAULT 0,
  total_wins integer DEFAULT 0,
  total_losses integer DEFAULT 0,
  -- Special achievements tracking
  all_in_wins integer DEFAULT 0,
  all_in_losses integer DEFAULT 0,
  first_bets_count integer DEFAULT 0, -- times user was first to bet on a market
  largest_single_bet numeric DEFAULT 0,
  -- Leaderboard tracking
  best_leaderboard_rank integer DEFAULT 999999,
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_badges_condition_type ON badges(condition_type);
CREATE INDEX IF NOT EXISTS idx_badges_is_active ON badges(is_active);

-- 4. FUNCTION: Initialize user stats when profile is created
-- =============================================
CREATE OR REPLACE FUNCTION initialize_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create user_stats
DROP TRIGGER IF EXISTS trigger_initialize_user_stats ON profiles;
CREATE TRIGGER trigger_initialize_user_stats
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION initialize_user_stats();

-- Initialize stats for existing users
INSERT INTO user_stats (user_id)
SELECT id FROM profiles
WHERE id NOT IN (SELECT user_id FROM user_stats)
ON CONFLICT (user_id) DO NOTHING;

-- 5. FUNCTION: Check and award badges for a user
-- =============================================
CREATE OR REPLACE FUNCTION check_and_award_badges(
  p_user_id uuid,
  p_bet_id uuid DEFAULT NULL,
  p_context jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats user_stats%ROWTYPE;
  v_badge RECORD;
  v_earned_badges jsonb := '[]'::jsonb;
  v_should_award boolean;
  v_metadata jsonb;
BEGIN
  -- Get user stats
  SELECT * INTO v_stats FROM user_stats WHERE user_id = p_user_id;

  IF v_stats IS NULL THEN
    -- Initialize stats if missing
    INSERT INTO user_stats (user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO v_stats FROM user_stats WHERE user_id = p_user_id;
  END IF;

  -- Loop through all active badges
  FOR v_badge IN
    SELECT b.* FROM badges b
    WHERE b.is_active = true
    AND b.id NOT IN (
      SELECT badge_id FROM user_badges WHERE user_id = p_user_id
    )
  LOOP
    v_should_award := false;
    v_metadata := '{}';

    -- Check each condition type
    CASE v_badge.condition_type
      WHEN 'win_streak' THEN
        v_should_award := v_stats.current_win_streak >= v_badge.threshold;
        v_metadata := jsonb_build_object('streak', v_stats.current_win_streak);

      WHEN 'lose_streak' THEN
        v_should_award := v_stats.current_lose_streak >= v_badge.threshold;
        v_metadata := jsonb_build_object('streak', v_stats.current_lose_streak);

      WHEN 'total_bets' THEN
        v_should_award := v_stats.lifetime_bets >= v_badge.threshold;
        v_metadata := jsonb_build_object('total_bets', v_stats.lifetime_bets);

      WHEN 'all_in_win' THEN
        -- This is checked via context when bet resolves
        v_should_award := (p_context->>'all_in_win')::boolean IS TRUE;
        v_metadata := p_context;

      WHEN 'all_in_lose' THEN
        -- This is checked via context when bet resolves
        v_should_award := (p_context->>'all_in_lose')::boolean IS TRUE;
        v_metadata := p_context;

      WHEN 'leaderboard_rank' THEN
        v_should_award := v_stats.best_leaderboard_rank <= v_badge.threshold;
        v_metadata := jsonb_build_object('best_rank', v_stats.best_leaderboard_rank);

      WHEN 'hold_duration_win' THEN
        -- Checked via context when bet resolves
        v_should_award := (p_context->>'hold_duration_days')::numeric >= v_badge.threshold
                          AND (p_context->>'won')::boolean IS TRUE;
        v_metadata := p_context;

      WHEN 'low_probability_win' THEN
        -- Checked via context - probability at purchase was < threshold%
        v_should_award := (p_context->>'probability_at_purchase')::numeric < (v_badge.threshold / 100.0)
                          AND (p_context->>'won')::boolean IS TRUE;
        v_metadata := p_context;

      WHEN 'minority_win' THEN
        -- Checked via context - user's side had < threshold% of pool
        v_should_award := (p_context->>'pool_percentage')::numeric < v_badge.threshold
                          AND (p_context->>'won')::boolean IS TRUE;
        v_metadata := p_context;

      WHEN 'single_bet_amount' THEN
        v_should_award := v_stats.largest_single_bet >= v_badge.threshold;
        v_metadata := jsonb_build_object('bet_amount', v_stats.largest_single_bet);

      WHEN 'first_bettor_count' THEN
        v_should_award := v_stats.first_bets_count >= v_badge.threshold;
        v_metadata := jsonb_build_object('first_bets', v_stats.first_bets_count);

      ELSE
        -- Unknown condition type, skip
        CONTINUE;
    END CASE;

    -- Award badge if condition met
    IF v_should_award THEN
      INSERT INTO user_badges (user_id, badge_id, metadata)
      VALUES (p_user_id, v_badge.id, v_metadata)
      ON CONFLICT (user_id, badge_id) DO NOTHING;

      -- Add to earned badges list
      v_earned_badges := v_earned_badges || jsonb_build_object(
        'id', v_badge.id,
        'name', v_badge.name,
        'icon', v_badge.icon,
        'description', v_badge.description
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'newly_earned', v_earned_badges,
    'count', jsonb_array_length(v_earned_badges)
  );
END;
$$;

-- 6. FUNCTION: Update user stats after bet resolution
-- =============================================
CREATE OR REPLACE FUNCTION update_user_stats_on_resolution(
  p_user_id uuid,
  p_won boolean,
  p_bet_amount numeric,
  p_was_all_in boolean DEFAULT false,
  p_was_first_bettor boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update stats
  UPDATE user_stats
  SET
    -- Update streaks
    current_win_streak = CASE WHEN p_won THEN current_win_streak + 1 ELSE 0 END,
    current_lose_streak = CASE WHEN p_won THEN 0 ELSE current_lose_streak + 1 END,
    max_win_streak = GREATEST(max_win_streak, CASE WHEN p_won THEN current_win_streak + 1 ELSE current_win_streak END),
    max_lose_streak = GREATEST(max_lose_streak, CASE WHEN p_won THEN current_lose_streak ELSE current_lose_streak + 1 END),
    -- Update counts
    total_wins = CASE WHEN p_won THEN total_wins + 1 ELSE total_wins END,
    total_losses = CASE WHEN NOT p_won THEN total_losses + 1 ELSE total_losses END,
    -- Update special achievements
    all_in_wins = CASE WHEN p_was_all_in AND p_won THEN all_in_wins + 1 ELSE all_in_wins END,
    all_in_losses = CASE WHEN p_was_all_in AND NOT p_won THEN all_in_losses + 1 ELSE all_in_losses END,
    -- Timestamp
    updated_at = now()
  WHERE user_id = p_user_id;

  -- Insert if not exists
  IF NOT FOUND THEN
    INSERT INTO user_stats (
      user_id,
      current_win_streak, current_lose_streak,
      max_win_streak, max_lose_streak,
      lifetime_bets, total_wins, total_losses,
      all_in_wins, all_in_losses
    ) VALUES (
      p_user_id,
      CASE WHEN p_won THEN 1 ELSE 0 END,
      CASE WHEN p_won THEN 0 ELSE 1 END,
      CASE WHEN p_won THEN 1 ELSE 0 END,
      CASE WHEN p_won THEN 0 ELSE 1 END,
      1,
      CASE WHEN p_won THEN 1 ELSE 0 END,
      CASE WHEN NOT p_won THEN 1 ELSE 0 END,
      CASE WHEN p_was_all_in AND p_won THEN 1 ELSE 0 END,
      CASE WHEN p_was_all_in AND NOT p_won THEN 1 ELSE 0 END
    );
  END IF;
END;
$$;

-- 7. FUNCTION: Update stats when bet is placed
-- =============================================
CREATE OR REPLACE FUNCTION update_user_stats_on_bet_placed(
  p_user_id uuid,
  p_bet_amount numeric,
  p_is_first_bettor boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_stats
  SET
    lifetime_bets = lifetime_bets + 1,
    largest_single_bet = GREATEST(largest_single_bet, p_bet_amount),
    first_bets_count = CASE WHEN p_is_first_bettor THEN first_bets_count + 1 ELSE first_bets_count END,
    updated_at = now()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO user_stats (user_id, lifetime_bets, largest_single_bet, first_bets_count)
    VALUES (p_user_id, 1, p_bet_amount, CASE WHEN p_is_first_bettor THEN 1 ELSE 0 END);
  END IF;
END;
$$;

-- 8. FUNCTION: Update leaderboard rank tracking
-- =============================================
CREATE OR REPLACE FUNCTION update_leaderboard_rank(
  p_user_id uuid,
  p_rank integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_stats
  SET
    best_leaderboard_rank = LEAST(best_leaderboard_rank, p_rank),
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- 9. FUNCTION: Get user's badges
-- =============================================
CREATE OR REPLACE FUNCTION get_user_badges(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_badges jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'description', b.description,
      'icon', b.icon,
      'earned_at', ub.earned_at,
      'metadata', ub.metadata
    ) ORDER BY ub.earned_at DESC
  )
  INTO v_badges
  FROM user_badges ub
  JOIN badges b ON b.id = ub.badge_id
  WHERE ub.user_id = p_user_id;

  RETURN COALESCE(v_badges, '[]'::jsonb);
END;
$$;

-- 10. SEED INITIAL BADGES
-- =============================================
INSERT INTO badges (name, description, icon, condition_type, threshold, sort_order) VALUES
  -- Win streak badges
  ('Insider Trader I', 'Make 5 correct bets in a row', '📈', 'win_streak', 5, 10),
  ('Insider Trader II', 'Make 10 correct bets in a row', '📈', 'win_streak', 10, 11),
  ('Insider Trader III', 'Make 20 correct bets in a row', '📈', 'win_streak', 20, 12),

  -- All-in badges
  ('Togi', 'Go all in (bet 100% of balance) and win', '🎰', 'all_in_win', 1, 20),
  ('Degen', 'Go all in and lose', '💸', 'all_in_lose', 1, 21),

  -- Lifetime bets badges
  ('Paper Hands', 'Make 5 lifetime bets', '📄', 'total_bets', 5, 30),
  ('Active Trader', 'Make 10 lifetime bets', '📊', 'total_bets', 10, 31),
  ('Market Addict', 'Make 100 lifetime bets', '🤑', 'total_bets', 100, 32),

  -- Leaderboard badge
  ('#1', 'Been #1 on the trailing 30 day ROI leaderboard', '👑', 'leaderboard_rank', 1, 40),

  -- Special condition badges
  ('Diamond Hands', 'Hold a position for 30+ days and win', '💎', 'hold_duration_win', 30, 50),
  ('Time Traveler', 'Correctly predict an outcome with <5% probability', '⏰', 'low_probability_win', 5, 51),
  ('Contra Gang', 'Win a bet where you were on the minority side (<30% of pool)', '🔄', 'minority_win', 30, 52),

  -- Lose streak badge
  ('Bag Holder', 'Lose 5 bets in a row', '💼', 'lose_streak', 5, 60),

  -- Single bet amount badge
  ('Whale Watcher', 'Make a single bet of 1000+ credits', '🐋', 'single_bet_amount', 1000, 70),

  -- First bettor badges
  ('Arbitrager I', 'Be the first to bet on a market', '🥇', 'first_bettor_count', 1, 80),
  ('Arbitrager II', 'Be the first to bet on 5 different markets', '🥈', 'first_bettor_count', 5, 81),
  ('Arbitrager III', 'Be the first to bet on 10 different markets', '🥉', 'first_bettor_count', 10, 82)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  condition_type = EXCLUDED.condition_type,
  threshold = EXCLUDED.threshold,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- 11. RLS POLICIES
-- =============================================
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- Badges are readable by everyone
CREATE POLICY "Badges are viewable by everyone" ON badges
  FOR SELECT USING (true);

-- Only admins can modify badges
CREATE POLICY "Only admins can modify badges" ON badges
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Users can view their own badges
CREATE POLICY "Users can view their own badges" ON user_badges
  FOR SELECT USING (user_id = auth.uid());

-- Users can view all badges (for leaderboard display)
CREATE POLICY "All badges are viewable" ON user_badges
  FOR SELECT USING (true);

-- Users can view their own stats
CREATE POLICY "Users can view their own stats" ON user_stats
  FOR SELECT USING (user_id = auth.uid());

-- Allow service role to manage all
CREATE POLICY "Service role full access badges" ON badges
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access user_badges" ON user_badges
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access user_stats" ON user_stats
  FOR ALL USING (auth.role() = 'service_role');
