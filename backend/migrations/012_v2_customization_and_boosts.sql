-- v2: theme/frame customization + consumable boosts
-- Idempotent (uses IF NOT EXISTS); safe to re-run.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_theme_id        UUID REFERENCES reward_shop(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_avatar_frame_id UUID REFERENCES reward_shop(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS xp_boost_expires_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS coin_boost_expires_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS streak_shields_count   INTEGER NOT NULL DEFAULT 0;

-- Track the timestamp of every habit log precisely so "undo within 60s" works.
ALTER TABLE habit_logs
  ADD COLUMN IF NOT EXISTS coins_earned INTEGER NOT NULL DEFAULT 0;
