-- v5: target_value becomes a real counter.
--
-- Up to v4 a single habit_logs row per (habit, user, day) meant logging
-- a habit was a binary thing. v5 lets users accumulate SUM(value) toward
-- the habit's target_value within a single day, so the unique constraint
-- on (habit_id, user_id, logged_date) has to go.
--
-- The new completion rule lives in code: a habit is "done today" when
-- SUM(value) >= target_value. XP / coins are awarded only on the log
-- that crosses the threshold.

ALTER TABLE habit_logs
  DROP CONSTRAINT IF EXISTS habit_logs_habit_id_user_id_logged_date_key;

-- Keep the supporting index for fast same-day sum lookups even though
-- the uniqueness is gone.
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_user_date
  ON habit_logs (habit_id, user_id, logged_date);

-- Streak idempotency: remember the date on which we last bumped a user's
-- streak so a second "all daily habits done" call later the same day
-- doesn't double-count.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_streak_date DATE;
