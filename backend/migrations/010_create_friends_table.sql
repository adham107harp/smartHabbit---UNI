-- 010_create_friends_table.sql
CREATE TABLE IF NOT EXISTS friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CHECK (user_id != friend_id),
  UNIQUE(user_id, friend_id)
);

CREATE INDEX idx_friends_user_id ON friends(user_id);
CREATE INDEX idx_friends_friend_id ON friends(friend_id);
CREATE INDEX idx_friends_status ON friends(status) WHERE status != 'blocked';

COMMENT ON TABLE friends IS 'Self-referential social graph for leaderboards & challenges';
COMMENT ON COLUMN friends.status IS 'pending=request sent, accepted=confirmed, blocked=user blocked';
