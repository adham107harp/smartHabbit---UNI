-- 003_create_habit_logs_table.sql
CREATE TABLE IF NOT EXISTS habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  value DECIMAL(10, 2) NOT NULL,
  xp_earned INT NOT NULL DEFAULT 0 CHECK (xp_earned >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  UNIQUE(habit_id, user_id, logged_date)
);

CREATE INDEX idx_habit_logs_user_id ON habit_logs(user_id);
CREATE INDEX idx_habit_logs_habit_id ON habit_logs(habit_id);
CREATE INDEX idx_habit_logs_logged_date ON habit_logs(logged_date DESC);
CREATE INDEX idx_habit_logs_user_date ON habit_logs(user_id, logged_date DESC);

COMMENT ON TABLE habit_logs IS 'Daily check-ins and source of truth for streaks & XP';
COMMENT ON COLUMN habit_logs.logged_date IS 'Date of the habit check-in';
COMMENT ON COLUMN habit_logs.value IS 'Progress amount (e.g., 5km run, 8 glasses water)';
