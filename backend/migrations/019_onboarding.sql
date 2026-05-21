-- v5: onboarding flow.
--
-- New users go through a welcome screen → pick interests → pick recommended
-- habits → land on dashboard. `onboarded_at` is set on completion so the
-- flow never reshows. `interests` is a text array used to bias future
-- recommendations.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS interests    TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_users_onboarded_at ON users (onboarded_at);
