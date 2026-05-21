-- v3: widen notifications.type to include punishment + chat + inactivity events.
-- Idempotent: drop-and-recreate the CHECK constraint.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type::text = ANY (ARRAY[
    'streak_alert',
    'streak_milestone',
    'badge_earned',
    'challenge_complete',
    'challenge_completed',
    'friend_request',
    'level_up',
    'purchase',
    'punishment_warning',
    'punishment_applied',
    'account_deleted_inactive',
    'chat_message',
    'general'
  ]::character varying[]::text[]));
