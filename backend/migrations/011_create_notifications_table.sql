-- 011_create_notifications_table.sql
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'streak_alert', 'badge_earned', 'challenge_complete',
    'friend_request', 'level_up', 'general'
  )),
  is_read BOOLEAN NOT NULL DEFAULT false,
  related_badge_id UUID REFERENCES badges(id),
  related_challenge_id UUID REFERENCES challenges(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_badge FOREIGN KEY (related_badge_id) REFERENCES badges(id)
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read) WHERE NOT is_read;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type);

COMMENT ON TABLE notifications IS 'In-app alerts and notifications for users';
COMMENT ON COLUMN notifications.type IS 'Category of notification for filtering and formatting';
