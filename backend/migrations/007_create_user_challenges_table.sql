-- 007_create_user_challenges_table.sql
CREATE TABLE IF NOT EXISTS user_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'joined' CHECK (status IN ('joined', 'completed', 'failed')),
  progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0),
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  
  UNIQUE(user_id, challenge_id)
);

CREATE INDEX idx_user_challenges_user_id ON user_challenges(user_id);
CREATE INDEX idx_user_challenges_challenge_id ON user_challenges(challenge_id);
CREATE INDEX idx_user_challenges_status ON user_challenges(status);

COMMENT ON TABLE user_challenges IS 'User participation and progress tracking in challenges';
COMMENT ON COLUMN user_challenges.progress IS 'Number of habit completions towards target';
