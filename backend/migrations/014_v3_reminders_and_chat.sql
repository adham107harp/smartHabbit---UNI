-- v3: habit reminders, real-time chat, punishment tracking.
-- Idempotent — safe to re-run.

------------------------------------------------------------------
-- Habit reminders
------------------------------------------------------------------
ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS remind_at        TIME,
  ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN NOT NULL DEFAULT false;

------------------------------------------------------------------
-- Punishment tracking
------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS warn_count     INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_last_active_at ON users (last_active_at);

------------------------------------------------------------------
-- Chat
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chat_body_length CHECK (length(body) BETWEEN 1 AND 1000)
);

CREATE INDEX IF NOT EXISTS idx_chat_pair_time
  ON chat_messages (sender_id, receiver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_receiver_unread
  ON chat_messages (receiver_id, is_read);

------------------------------------------------------------------
-- Punishment job state (single-row table so the worker can record its last
-- run and avoid double-firing within the same UTC day).
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS punishment_job_state (
  id           INTEGER PRIMARY KEY DEFAULT 1,
  last_run_at  TIMESTAMPTZ,
  CONSTRAINT punishment_job_singleton CHECK (id = 1)
);
INSERT INTO punishment_job_state (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

------------------------------------------------------------------
-- Badges: allow new criteria types (level, challenges_completed)
-- The original constraint only allowed streak/total_xp/completions.
------------------------------------------------------------------
ALTER TABLE badges
  DROP CONSTRAINT IF EXISTS badges_criteria_type_check;
ALTER TABLE badges
  ADD CONSTRAINT badges_criteria_type_check
  CHECK (criteria_type IN ('streak', 'total_xp', 'completions', 'level', 'challenges_completed'));
