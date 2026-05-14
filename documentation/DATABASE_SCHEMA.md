# SmartHabbit Database Schema
## Complete Documentation

### Overview

SmartHabbit uses PostgreSQL with a carefully designed schema to support gamification features. The database is optimized for performance with strategic indexes, constraints, and soft-delete patterns.

---

## Tables & Relationships

### 1. USERS Table
Stores user accounts and gamification progression.

**Columns:**
- `id` (UUID) - Primary key
- `username` (VARCHAR 50) - Unique username, 3-50 alphanumeric chars
- `email` (VARCHAR 255) - Unique email
- `password_hash` (VARCHAR 255) - Bcrypt hashed password
- `xp` (INT) - Total experience points (default: 0)
- `level` (INT) - Calculated from XP (default: 1)
- `coins` (INT) - Virtual currency (default: 0)
- `current_streak` (INT) - Active streak count
- `max_streak` (INT) - Highest streak achieved
- `avatar_url` (VARCHAR 500) - Profile picture URL
- `is_active` (BOOLEAN) - Account active status
- `deleted_at` (TIMESTAMP) - Soft delete timestamp
- `created_at`, `updated_at` (TIMESTAMP)

**Indexes:**
- `idx_users_username` - For login/profile lookup
- `idx_users_email` - For auth verification
- `idx_users_xp` - For leaderboards (DESC)
- `idx_users_level` - For level-based rankings

**Constraints:**
- XP, level, coins, streaks ≥ 0
- Check: Email format validation
- Check: Username regex (^[a-zA-Z0-9_]{3,50}$)

---

### 2. HABITS Table
User-created habits to track daily/weekly.

**Columns:**
- `id` (UUID) - Primary key
- `user_id` (FK) - References users.id (CASCADE delete)
- `name` (VARCHAR 100) - Habit name
- `description` (TEXT) - Optional description
- `goal_type` (VARCHAR 20) - 'daily' or 'weekly'
- `difficulty` (VARCHAR 20) - 'easy', 'medium', 'hard'
  - Affects XP rewards: easy=10, medium=25, hard=50
- `target_value` (DECIMAL 10,2) - Daily/weekly goal amount
- `target_unit` (VARCHAR 50) - Unit (km, minutes, cups, etc.)
- `is_active` (BOOLEAN) - Enabled/disabled
- `deleted_at` (TIMESTAMP)
- `created_at`, `updated_at` (TIMESTAMP)

**Indexes:**
- `idx_habits_user_id` - For fetching user's habits
- `idx_habits_is_active` - For listing active habits

**Relationships:**
- One user → Many habits
- One habit → Many habit logs

---

### 3. HABIT_LOGS Table
Daily check-ins; source of truth for streaks and XP.

**Columns:**
- `id` (UUID) - Primary key
- `habit_id` (FK) - References habits.id
- `user_id` (FK) - References users.id
- `logged_date` (DATE) - Date of the log
- `value` (DECIMAL 10,2) - Progress amount (5km run, 8 glasses water, etc.)
- `xp_earned` (INT) - XP awarded (includes streak bonus)
- `created_at` (TIMESTAMP)

**Unique Constraint:**
- `UNIQUE(habit_id, user_id, logged_date)` - One log per habit per day

**Indexes:**
- `idx_habit_logs_user_id` - For fetching user logs
- `idx_habit_logs_habit_id` - For habit history
- `idx_habit_logs_logged_date` - For date-range queries
- `idx_habit_logs_user_date` - For streak calculations

**Notes:**
- Partitioned by month for large datasets
- Updated (not inserted) on duplicate logs
- Streak calculation uses MAX(logged_date)

---

### 4. BADGES Table
System-defined achievements.

**Columns:**
- `id` (UUID) - Primary key
- `name` (VARCHAR 100) - Badge name (unique)
- `description` (TEXT)
- `criteria_type` (VARCHAR 50) - 'streak', 'total_xp', 'completions'
- `criteria_value` (INT) - Threshold (e.g., 7 for 7-day streak)
- `image_url` (VARCHAR 500) - Badge image
- `bonus_xp` (INT) - XP awarded on unlock (optional)
- `bonus_coins` (INT) - Coins awarded on unlock (optional)
- `created_at` (TIMESTAMP)

**Pre-populated Badges:**
- 7-Day Warrior (streak=7)
- 30-Day Champion (streak=30)
- 100-Day Legend (streak=100)
- 365-Day Master (streak=365)
- First 100 XP (xp=100)
- 1K XP Club (xp=1000)
- 10K XP Elite (xp=10000)
- First Steps (completions=1)
- Habit Builder (completions=50)
- Unstoppable (completions=500)

**Indexes:**
- `idx_badges_criteria_type` - For filtering badges by type

---

### 5. USER_BADGES Table
Many-to-many junction for earned badges.

**Columns:**
- `id` (UUID) - Primary key
- `user_id` (FK) - References users.id
- `badge_id` (FK) - References badges.id
- `earned_at` (TIMESTAMP) - When unlocked

**Unique Constraint:**
- `UNIQUE(user_id, badge_id)` - User can't earn same badge twice

**Indexes:**
- `idx_user_badges_user_id` - For user's badges
- `idx_user_badges_badge_id` - For badge's users

---

### 6. CHALLENGES Table
Limited-time events to boost engagement.

**Columns:**
- `id` (UUID) - Primary key
- `name` (VARCHAR 100) - Challenge name
- `description` (TEXT)
- `start_date` (TIMESTAMP)
- `end_date` (TIMESTAMP)
- `target_value` (INT) - Habit completions needed to win
- `reward_xp` (INT) - XP for completion (default: 100)
- `reward_coins` (INT) - Coins for completion (default: 50)
- `badge_id` (FK, optional) - Badge awarded on completion
- `is_active` (BOOLEAN) - Can join if true
- `created_at` (TIMESTAMP)

**Check Constraint:**
- `end_date > start_date`

**Indexes:**
- `idx_challenges_is_active`
- `idx_challenges_start_date` - For active challenges
- `idx_challenges_end_date` - For expiry detection

---

### 7. USER_CHALLENGES Table
Tracks user participation in challenges.

**Columns:**
- `id` (UUID) - Primary key
- `user_id` (FK) - References users.id
- `challenge_id` (FK) - References challenges.id
- `status` (VARCHAR 50) - 'joined', 'completed', 'failed'
- `progress` (INT) - Current completions toward target
- `joined_at` (TIMESTAMP)
- `completed_at` (TIMESTAMP, nullable)

**Unique Constraint:**
- `UNIQUE(user_id, challenge_id)` - User joins each challenge once

**Indexes:**
- `idx_user_challenges_user_id` - For user's challenges
- `idx_user_challenges_challenge_id` - For challenge participants
- `idx_user_challenges_status` - For filtering by status

---

### 8. REWARD_SHOP Table
Available items for purchase with coins.

**Columns:**
- `id` (UUID) - Primary key
- `name` (VARCHAR 100) - Item name
- `description` (TEXT)
- `cost` (INT) - Coin cost (≥ 0)
- `item_type` (VARCHAR 50) - 'avatar_item', 'theme', 'badge', 'consumable'
- `meta_data` (JSONB) - Flexible attributes per item type
- `is_available` (BOOLEAN) - Purchasable
- `created_at`, `updated_at` (TIMESTAMP)

**Indexes:**
- `idx_reward_shop_item_type` - For browsing by type
- `idx_reward_shop_is_available` - For availability filter
- `idx_reward_shop_cost` - For price-based sorting

**Example meta_data:**
```json
{
  "avatar_item": { "color": "blue", "size": "medium" },
  "theme": { "background": "dark", "accent_color": "#FF00FF" },
  "consumable": { "duration": 7, "effect": "2x_xp" }
}
```

---

### 9. PURCHASES Table
Transaction log for all item purchases.

**Columns:**
- `id` (UUID) - Primary key
- `user_id` (FK) - References users.id
- `item_id` (FK) - References reward_shop.id
- `cost_paid` (INT) - Historical price at purchase time
- `purchased_at` (TIMESTAMP)

**Indexes:**
- `idx_purchases_user_id` - For user's purchase history
- `idx_purchases_item_id` - For item sales count
- `idx_purchases_purchased_at` - For recent purchases

---

### 10. FRIENDS Table (Self-referential)
Social graph for leaderboards and challenges.

**Columns:**
- `id` (UUID) - Primary key
- `user_id` (FK) - References users.id
- `friend_id` (FK) - References users.id
- `status` (VARCHAR 50) - 'pending', 'accepted', 'blocked'
- `created_at` (TIMESTAMP)

**Unique Constraint:**
- `UNIQUE(user_id, friend_id)`

**Check Constraint:**
- `user_id != friend_id` - No self-friendships

**Indexes:**
- `idx_friends_user_id` - For user's friends list
- `idx_friends_friend_id` - For incoming requests
- `idx_friends_status` - For active friends (WHERE status != 'blocked')

**Notes:**
- Directional: A→B and B→A are separate entries
- Statuses: pending (request sent), accepted (confirmed), blocked (user is blocked)

---

### 11. NOTIFICATIONS Table
In-app alerts and notifications.

**Columns:**
- `id` (UUID) - Primary key
- `user_id` (FK) - References users.id
- `title` (VARCHAR 100) - Notification title
- `message` (TEXT) - Notification text
- `type` (VARCHAR 50) - 'streak_alert', 'badge_earned', 'challenge_complete', 'friend_request', 'level_up', 'general'
- `is_read` (BOOLEAN) - Read status
- `related_badge_id` (FK, nullable) - For badge notifications
- `related_challenge_id` (FK, nullable) - For challenge notifications
- `created_at` (TIMESTAMP)

**Indexes:**
- `idx_notifications_user_id` - For user's notifications
- `idx_notifications_is_read` - For unread count badges
- `idx_notifications_created_at` - For latest notifications
- `idx_notifications_type` - For filtering by type

---

## Performance Optimizations

### 1. Partitioning
```sql
-- habit_logs partitioned by month for large datasets
CREATE TABLE habit_logs_2024_01 PARTITION OF habit_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### 2. Materialized Views (Optional)
```sql
CREATE MATERIALIZED VIEW leaderboard_weekly AS
SELECT 
  u.id, u.username, u.xp, u.level,
  COALESCE(SUM(hl.xp_earned), 0) as weekly_xp
FROM users u
LEFT JOIN habit_logs hl ON u.id = hl.user_id 
  AND hl.logged_date > NOW() - INTERVAL '7 days'
GROUP BY u.id
ORDER BY weekly_xp DESC;

-- Refresh every Monday
REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_weekly;
```

### 3. Caching with Redis
- `user:{id}:profile` (1 hour)
- `user:{id}:streak` (24 hours)
- `leaderboard:global:weekly` (1 week)
- `leaderboard:friends:{id}` (1 hour)

---

## Data Integrity

### Soft Deletes
- Users and habits use `deleted_at` instead of hard delete
- Queries filter WHERE `deleted_at IS NULL`
- Preserves referential integrity

### Atomic Operations
- Habit completion uses transactions for:
  - Insert habit log
  - Update user XP/coins/level
  - Award badges
  - Update streams
  
### Idempotency
- Habit logs: Same habit + same date → UPDATE, no duplicate issues
- Purchases: User balance check before deduction
- Streaks: Reset based on is MAX(logged_date), idempotent

---

## Database Constraints

| Table | Constraint | Purpose |
|-------|-----------|---------|
| users | xp >= 0 | Data integrity |
| users | level >= 1 | Level must start at 1 |
| habits | goal_type IN (...) | Whitelist values |
| challenges | end_date > start_date | Valid date range |
| friends | user_id != friend_id | No self-friendships |
| habit_logs | UNIQUE(habit, user, date) | Prevent duplicates |
| user_badges | UNIQUE(user, badge) | One badge per user |
| user_challenges | UNIQUE(user, challenge) | Join once per challenge |

---

## Sample Queries

### Get User's Weekly XP
```sql
SELECT 
  u.username, 
  COALESCE(SUM(hl.xp_earned), 0) as weekly_xp
FROM users u
LEFT JOIN habit_logs hl ON u.id = hl.user_id 
  AND hl.logged_date >= CURRENT_DATE - INTERVAL '7 days'
WHERE u.id = '...'
GROUP BY u.id, u.username;
```

### Get User's Next Badges
```sql
SELECT b.*, 
  CASE 
    WHEN b.criteria_type = 'streak' THEN (SELECT current_streak FROM users WHERE id = '...')
    WHEN b.criteria_type = 'total_xp' THEN (SELECT xp FROM users WHERE id = '...')
    WHEN b.criteria_type = 'completions' THEN (SELECT COUNT(*) FROM habit_logs WHERE user_id = '...')
  END as current_progress
FROM badges b
WHERE b.id NOT IN (SELECT badge_id FROM user_badges WHERE user_id = '...')
ORDER BY b.criteria_value ASC LIMIT 5;
```

### Get Friends Leaderboard
```sql
SELECT 
  ROW_NUMBER() OVER (ORDER BY u.xp DESC) as rank,
  u.id, u.username, u.level, u.xp, u.current_streak
FROM users u
INNER JOIN friends f ON f.friend_id = u.id AND f.user_id = '...' AND f.status = 'accepted'
WHERE u.deleted_at IS NULL
ORDER BY u.xp DESC, u.level DESC;
```

---

This schema provides a solid foundation for SmartHabbit's gamification features while maintaining data integrity, performance, and scalability.
