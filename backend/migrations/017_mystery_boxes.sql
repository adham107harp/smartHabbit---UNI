-- v5: mystery box every 10 levels.
--
-- A row is INSERTed by GamificationEngine when a user crosses a
-- level%10 boundary. ON CONFLICT (user_id, level_awarded) DO NOTHING
-- keeps that idempotent even if the same level-up happens twice in
-- a race-y log+retry.
--
-- `opened_at` is NULL until the user opens the box; once opened we record
-- what they got in `reward_kind` + `reward_value`.

CREATE TABLE IF NOT EXISTS mystery_boxes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level_awarded INTEGER NOT NULL,
  opened_at     TIMESTAMPTZ,
  reward_kind   TEXT,                          -- 'coins' | 'theme' | 'frame'
  reward_value  JSONB,                         -- e.g. {"coins":300} or {"item_id":"..."}
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT mystery_boxes_user_level_unique UNIQUE (user_id, level_awarded)
);

-- Fast lookup for "what unopened boxes does this user have?"
CREATE INDEX IF NOT EXISTS idx_mystery_user_unopened
  ON mystery_boxes (user_id)
  WHERE opened_at IS NULL;
