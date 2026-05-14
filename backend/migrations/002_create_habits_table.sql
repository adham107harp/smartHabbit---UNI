-- 002_create_habits_table.sql
CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  goal_type VARCHAR(20) NOT NULL CHECK (goal_type IN ('daily', 'weekly')),
  difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  target_value DECIMAL(10, 2) NOT NULL DEFAULT 1,
  target_unit VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_habits_user_id ON habits(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_habits_is_active ON habits(is_active) WHERE deleted_at IS NULL;

COMMENT ON TABLE habits IS 'User-created habits with gamification configuration';
COMMENT ON COLUMN habits.user_id IS 'References the user who owns this habit';
COMMENT ON COLUMN habits.difficulty IS 'Affects XP awarded: easy=10, medium=25, hard=50';
COMMENT ON COLUMN habits.goal_type IS 'daily or weekly frequency';
