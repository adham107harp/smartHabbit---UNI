-- v5: admin role flag.
--
-- One hard-coded super-admin (the project owner). Bootstrap that email
-- with is_admin=true. The middleware also accepts a comma-separated
-- ADMIN_EMAILS env var at runtime, so it's safe to drop/recreate this
-- account during testing — they'll keep their powers via env match.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

UPDATE users
   SET is_admin = true
 WHERE LOWER(email) = LOWER('Adhamharp994@gmail.com');
