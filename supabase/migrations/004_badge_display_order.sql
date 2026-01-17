-- =============================================
-- ADD DISPLAY ORDER TO USER BADGES
-- =============================================

-- Add display_order column to user_badges
-- NULL = not displayed, 1-3 = display position
ALTER TABLE user_badges ADD COLUMN IF NOT EXISTS display_order integer DEFAULT NULL;

-- Add constraint to limit display_order to 1-3
ALTER TABLE user_badges DROP CONSTRAINT IF EXISTS user_badges_display_order_check;
ALTER TABLE user_badges ADD CONSTRAINT user_badges_display_order_check
  CHECK (display_order IS NULL OR (display_order >= 1 AND display_order <= 3));

-- Create index for faster queries on displayed badges
CREATE INDEX IF NOT EXISTS idx_user_badges_display_order ON user_badges(user_id, display_order)
  WHERE display_order IS NOT NULL;

-- Function to get displayed badges for a user (returns up to 3 badges in order)
CREATE OR REPLACE FUNCTION get_displayed_badges(p_user_id uuid)
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
      'icon', b.icon,
      'display_order', ub.display_order
    ) ORDER BY ub.display_order
  )
  INTO v_badges
  FROM user_badges ub
  JOIN badges b ON b.id = ub.badge_id
  WHERE ub.user_id = p_user_id
    AND ub.display_order IS NOT NULL
  ORDER BY ub.display_order;

  RETURN COALESCE(v_badges, '[]'::jsonb);
END;
$$;

-- Function to update badge display order
CREATE OR REPLACE FUNCTION update_badge_display_order(
  p_user_id uuid,
  p_badge_id uuid,
  p_display_order integer -- NULL to remove, 1-3 to set position
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_badge_at_position uuid;
BEGIN
  -- Verify user owns this badge
  IF NOT EXISTS (
    SELECT 1 FROM user_badges WHERE user_id = p_user_id AND badge_id = p_badge_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Badge not owned by user');
  END IF;

  -- If setting a position, clear any existing badge at that position
  IF p_display_order IS NOT NULL THEN
    UPDATE user_badges
    SET display_order = NULL
    WHERE user_id = p_user_id
      AND display_order = p_display_order
      AND badge_id != p_badge_id;
  END IF;

  -- Update the badge's display order
  UPDATE user_badges
  SET display_order = p_display_order
  WHERE user_id = p_user_id AND badge_id = p_badge_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to set all displayed badges at once (array of badge_ids in order)
CREATE OR REPLACE FUNCTION set_displayed_badges(
  p_user_id uuid,
  p_badge_ids uuid[] -- Array of up to 3 badge IDs in display order
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_badge_id uuid;
  v_position integer := 1;
BEGIN
  -- Clear all existing display orders for this user
  UPDATE user_badges
  SET display_order = NULL
  WHERE user_id = p_user_id;

  -- Set new display orders
  FOREACH v_badge_id IN ARRAY p_badge_ids
  LOOP
    IF v_position <= 3 THEN
      UPDATE user_badges
      SET display_order = v_position
      WHERE user_id = p_user_id AND badge_id = v_badge_id;

      v_position := v_position + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'badges_set', v_position - 1);
END;
$$;
