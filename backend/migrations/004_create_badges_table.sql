-- 004_create_badges_table.sql
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  criteria_type VARCHAR(50) NOT NULL CHECK (criteria_type IN ('streak', 'total_xp', 'completions')),
  criteria_value INT NOT NULL,
  image_url VARCHAR(500),
  bonus_xp INT DEFAULT 0,
  bonus_coins INT DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_badges_criteria_type ON badges(criteria_type);

INSERT INTO badges (name, description, criteria_type, criteria_value, bonus_xp, bonus_coins) VALUES
('7-Day Warrior', 'Maintain a 7-day streak', 'streak', 7, 50, 50),
('30-Day Champion', 'Maintain a 30-day streak', 'streak', 30, 200, 100),
('100-Day Legend', 'Maintain a 100-day streak', 'streak', 100, 500, 250),
('365-Day Master', 'Maintain a 365-day streak', 'streak', 365, 1000, 500),
('First 100 XP', 'Earn 100 total XP', 'total_xp', 100, 25, 25),
('1K XP Club', 'Earn 1000 total XP', 'total_xp', 1000, 100, 50),
('10K XP Elite', 'Earn 10000 total XP', 'total_xp', 10000, 500, 250),
('First Steps', 'Complete your first habit', 'completions', 1, 10, 10),
('Habit Builder', 'Complete 50 habit logs', 'completions', 50, 100, 50),
('Unstoppable', 'Complete 500 habit logs', 'completions', 500, 500, 250)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE badges IS 'System-defined achievement definitions';
COMMENT ON COLUMN badges.criteria_type IS 'Type of achievement: streak, total_xp, or completions';
COMMENT ON COLUMN badges.criteria_value IS 'Threshold to unlock this badge';
