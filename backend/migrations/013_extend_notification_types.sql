-- v2: widen notifications.type to include purchase + streak_milestone events.
-- Idempotent: drop-and-recreate the CHECK constraint.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type::text = ANY (ARRAY[
    'streak_alert',
    'streak_milestone',
    'badge_earned',
    'challenge_complete',
    'friend_request',
    'level_up',
    'purchase',
    'general'
  ]::character varying[]::text[]));
