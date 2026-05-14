-- 006_create_challenges_table.sql
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  target_value INT NOT NULL,
  reward_xp INT NOT NULL DEFAULT 100,
  reward_coins INT NOT NULL DEFAULT 50,
  badge_id UUID REFERENCES badges(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CHECK (end_date > start_date)
);

CREATE INDEX idx_challenges_is_active ON challenges(is_active);
CREATE INDEX idx_challenges_start_date ON challenges(start_date);
CREATE INDEX idx_challenges_end_date ON challenges(end_date);

COMMENT ON TABLE challenges IS 'Limited-time events to boost engagement';
COMMENT ON COLUMN challenges.target_value IS 'Number of habit completions needed to finish challenge';
COMMENT ON COLUMN challenges.badge_id IS 'Optional badge awarded on completion';
