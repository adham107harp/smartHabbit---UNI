-- 001_create_users_table.sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  xp INT NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level INT NOT NULL DEFAULT 1 CHECK (level >= 1),
  coins INT NOT NULL DEFAULT 0 CHECK (coins >= 0),
  current_streak INT NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  max_streak INT NOT NULL DEFAULT 0 CHECK (max_streak >= 0),
  avatar_url VARCHAR(500),
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CHECK (username ~ '^[a-zA-Z0-9_]{3,50}$'),
  CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_xp ON users(xp DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_level ON users(level DESC) WHERE deleted_at IS NULL;

COMMENT ON TABLE users IS 'Core users table - tracks player progression across entire platform';
COMMENT ON COLUMN users.xp IS 'Total experience points earned';
COMMENT ON COLUMN users.level IS 'User level calculated from XP';
COMMENT ON COLUMN users.current_streak IS 'Current active streak count';
COMMENT ON COLUMN users.deleted_at IS 'Soft delete timestamp';
