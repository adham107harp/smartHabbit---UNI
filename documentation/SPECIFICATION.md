# SmartHabbit Specification Document

## Executive Summary

SmartHabbit is a comprehensive gamification platform designed to motivate users to build and maintain positive habits. The application combines social features, achievement systems, challenge mechanics, and reward economies to create an engaging habit-tracking experience.

**Target Users**: Anyone looking to develop consistent daily/weekly habits (fitness, learning, self-care, productivity)

**Core Motivation**: Make habit-building fun and rewarding through game mechanics

---

## Part 1: Database Architecture

### 1.1 Core Tables (11 tables)

#### Users Table
- Tracks: Account, XP, level, coins, streaks
- Features: Soft delete, email verification
- Constraints: Email regex, username regex (3-50 chars)
- Indexes: For leaderboards and authentication

#### Habits Table
- Stores: User-created daily/weekly habits
- Difficulty levels: easy (10 XP), medium (25 XP), hard (50 XP)
- Features: Soft delete, target tracking

#### Habit_Logs Table
- Records: Daily completions, source of truth for XP and streaks
- Unique constraint: One log per habit per user per day
- Auto-updates: Same day re-log updates instead of inserts

#### Badges Table (System-defined)
- 10 pre-defined achievements
- Types: Streak milestones (7/30/100/365 days), XP thresholds, completions
- Features: Bonus XP/coins on unlock

#### User_Badges Table
- Many-to-many junction
- Tracks: When each user earned each badge

#### Challenges Table
- Limited-time events (start/end dates)
- Rewards: XP, coins, optional badge
- Target: Number of habit completions

#### User_Challenges Table
- Many-to-many with progress tracking
- Status: joined, completed, failed
- Auto-closes: After end_date

#### Reward_Shop Table
- Item types: avatars, themes, badges, consumables
- Meta-data: Flexible JSONB for item-specific attributes
- Prices: In coins

#### Purchases Table
- Transaction log with historical pricing
- User's purchase history

#### Friends Table (Self-referential)
- Status: pending, accepted, blocked
- Constraint: No self-friendships
- Purpose: For leaderboards and challenges

#### Notifications Table
- Types: streak_alert, badge_earned, challenge_complete, friend_request, level_up, general
- Read/unread tracking

### 1.2 Performance Features
- **10+ strategic indexes** for common queries
- **Soft deletes** for data recovery via deleted_at
- **Table partitioning** for habit_logs (by month)
- **Materialized views** for leaderboards (optional)
- **Unique constraints** to prevent duplicates
- **Check constraints** for data validation

---

## Part 2: Backend Architecture

### 2.1 Technology Stack

**Recommended (Selected)**: Node.js + Express + TypeScript
- **Alternatives**: Python + FastAPI, Laravel (PHP)
- **Why TypeScript**: Type safety, better IDE support, catches errors early

### 2.2 Service-Oriented Architecture

#### Service 1: GamificationEngine
**Purpose**: Calculate and award XP, level up users

**Key Logic**:
- Base XP by difficulty: easy=10, medium=25, hard=50
- Streak multipliers: 7+ days = 1.5x, 30+ days = 2x
- Coins awarded: XP / 10
- Level formula: Level = floor(sqrt(total_xp / 100)) + 1

**Methods**:
- `calculateXPReward(difficulty, streak)` → {baseXP, multiplier, totalXP, coins}
- `calculateLevel(totalXP)` → number
- `processHabitCompletion(userId, habitId, value)` → {xpEarned, coinsEarned, newLevel, leveledUp}
- `getUserStats(userId)` → full user stats with progress to next level

**Database Ops**:
- Begin transaction
- UPDATE habit_logs (insert or update)
- UPDATE users (XP, coins, level)
- Commit/rollback

#### Service 2: BadgeService
**Purpose**: Award badges when criteria are met

**Criteria Types**:
- `streak`: Check current_streak >= criteria_value
- `total_xp`: Check xp >= criteria_value
- `completions`: COUNT(habit_logs) >= criteria_value

**Methods**:
- `checkAndAwardBadges(userId)` → [awarded badges]
- `getAllBadges()` → system badge definitions
- `getUserBadges(userId)` → user's earned badges
- `getUserNextBadges(userId)` → upcoming badges with progress

**Automations**:
- Triggered after habit completion
- Awards bonus XP/coins if defined
- Creates notification

#### Service 3: StreakService
**Purpose**: Maintain streak count and detect breaks

**Logic**:
- Check last_logged_date:
  - If yesterday → increment streak
  - If today → no change
  - If older → reset to 1
- Milestone badges at 7, 30, 100, 365 days
- Daily cron: Reset streaks for users who missed yesterday

**Methods**:
- `updateStreak(userId)` → {newStreak, maxStreak, streakBroken}
- `sendStreakWarning(userId)` → notification
- `resetBrokenStreaks()` → cron job
- `getStreakStats(userId)` → full streak data

#### Service 4: ChallengeService
**Purpose**: Track challenge progress, auto-complete on target

**Logic**:
- Monitor all active challenges for user
- Increment progress on habit completion
- Auto-complete when progress >= target_value
- Award XP, coins, optional badge

**Methods**:
- `updateChallengeProgress(userId, habitId)` → [completed challenges]
- `joinChallenge(userId, challengeId)`
- `getUserActiveChallenges(userId)` → list with progress
- `getChallengeLeaderboard(challengeId)` → ranked participants
- `failExpiredChallenges()` → cron job auto-failure

#### Service 5: SocialService
**Purpose**: Manage friendships and leaderboards

**Friend States**:
- pending: Request sent, awaiting response
- accepted: Confirmed friends
- blocked: Blocked user (cannot interact)

**Methods**:
- `sendFriendRequest(fromId, toId)` + notification
- `acceptFriendRequest(userId, friendId)`
- `removeFriend(userId, friendId)`
- `blockUser(userId, blockedId)`
- `getGlobalLeaderboard(limit=100)` → Top users by XP
- `getFriendsLeaderboard(userId)` → User's friends ranked
- `getWeeklyLeaderboard(limit=100)` → This week's XP earners (caches)

#### Service 6: ShopService
**Purpose**: Handle coin purchases and inventory

**Item Types**:
- `avatar_item`: Cosmetic avatar customization
- `theme`: UI theme/appearance
- `badge`: Purchasable badge
- `consumable`: Temporary boost (2x XP for 7 days, etc.)

**Methods**:
- `purchaseItem(userId, itemId)` → atomic transaction
  - Check coins balance
  - Deduct coins
  - Record purchase
  - Apply item effect
- `getAvailableItems()`, `getItemsByType(type)`
- `getUserInventory(userId)` → owned items
- `getUserPurchases(userId)` → purchase history

**Safety**:
- Transactions ensure atomicity
- Check balance before deducting
- Historical price logging

#### Service 7: NotificationService
**Purpose**: Create and manage user notifications

**Types**:
- `streak_alert`: X hours remaining to maintain streak
- `badge_earned`: New badge unlocked (with name)
- `challenge_complete`: Challenge won (with rewards)
- `friend_request`: Incoming friend request
- `level_up`: New level reached
- `general`: Other alerts

**Methods**:
- `createNotification(userId, title, message, type, ...refs)`
- `sendStreakWarning(userId, currentStreak)` → auto-generate message
- `sendBadgeUnlock(userId, badgeName, badgeId)`
- `getUserNotifications(userId, limit, unreadOnly)`
- `markAsRead(notificationId)`, `markAllAsRead(userId)`
- `getUnreadCount(userId)`

### 2.3 API Layer (RESTful Design)

#### Authentication Endpoints
- `POST /api/auth/register` → Create account
- `POST /api/auth/login` → Issue tokens
- `POST /api/auth/refresh` → Refresh access token

#### User Endpoints
- `GET /api/users/me` → Current user profile
- `PUT /api/users/me` → Update profile (username, avatar)
- `GET /api/users/:id/stats` → Public user stats
- `DELETE /api/users/me` → Soft delete account

#### Habit Endpoints
- `GET /api/habits` → User's habits
- `POST /api/habits` → Create habit
- `PUT /api/habits/:id` → Update habit
- `DELETE /api/habits/:id` → Soft delete
- `POST /api/habits/:id/log` → Log completion (Main endpoint!)
  - Triggers: XP calc, streak update, badge check, challenge update
- `GET /api/habits/:id/history` → Logs (paginated)

#### Badge Endpoints
- `GET /api/badges` → All badges
- `GET /api/badges/user/earned` → User's badges
- `GET /api/badges/user/next` → Upcoming with progress

#### Challenge Endpoints
- `GET /api/challenges` → Active challenges
- `POST /api/challenges/:id/join` → Enroll user
- `GET /api/challenges/user/active` → User's challenges
- `GET /api/challenges/:id/leaderboard` → Rankings

#### Social Endpoints
- `GET /api/friends` → Friends list
- `POST /api/friends/request/:id` → Send request
- `PUT /api/friends/:id/accept` → Accept request
- `DELETE /api/friends/:id` → Remove friend
- `GET /api/leaderboards/global` → Global top 100
- `GET /api/leaderboards/friends` → Friends rankings
- `GET /api/leaderboards/weekly` → Weekly XP leaders

#### Shop Endpoints
- `GET /api/shop/items` → Available items
- `GET /api/shop/items/type/:type` → Filter by type
- `POST /api/shop/purchase` → Buy item
- `GET /api/shop/user/inventory` → Owned items
- `GET /api/shop/user/purchases` → History

#### Notification Endpoints
- `GET /api/notifications` → User's notifications
- `GET /api/notifications?unread=true` → Unread only
- `GET /api/notifications/unread/count` → Badge count
- `PUT /api/notifications/:id/read` → Mark read
- `DELETE /api/notifications/:id` → Delete

### 2.4 Caching Strategy (Redis)

| Pattern | TTL | Purpose |
|---------|-----|---------|
| `user:{id}:profile` | 1 hour | User basic info |
| `user:{id}:streak` | 24 hours | Frequently read |
| `leaderboard:global:weekly` | 1 week | Top 100 users |
| `leaderboard:friends:{id}` | 1 hour | Friends rankings |
| `habit:{id}:today` | 24 hours | Today's completion |
| `challenge:{id}:stats` | 1 hour | Participation |
| `notification:unread:{id}` | 5 min | Unread count |

### 2.5 Background Jobs (Cron)

| Job | Frequency | Purpose |
|-----|-----------|---------|
| `reset_daily_streak_check` | 00:00 daily | Auto-reset missed streaks |
| `calculate_weekly_leaderboard` | Monday 00:00 | Refresh leaderboard view |
| `expire_challenges` | Every hour | Mark failed challenges |
| `send_reminder_notifications` | 20:00 daily | Streak reminders |
| `cleanup_old_logs` | Monthly | Archive logs > 1 year |

### 2.6 Authentication & Security

**JWT Token Flow**:
1. User registers/login
2. Server issues: `accessToken` (24h) + `refreshToken` (7d)
3. Client stores both securely
4. API requests: `Authorization: Bearer {accessToken}`
5. On expiry: POST /api/auth/refresh with refreshToken

**Password Security**:
- Bcrypt hashing (10 rounds)
- Validation: 8+ chars, uppercase, lowercase, number
- Never log or return password_hash

**Rate Limiting**:
- 100 requests/minute per user
- 1000 requests/hour globally
- Exponential backoff on violations

**Input Validation**:
- Sanitize all inputs
- Validate email, username patterns
- Limit string lengths
- Parse numbers carefully

**SQL Injection Prevention**:
- Parameterized queries (pg module)
- No string concatenation in SQL
- ORM-style approach

**CORS Configuration**:
- Whitelist trusted origins
- Credentials enabled
- Preflight allowed

### 2.7 Error Handling

**Status Codes**:
- 200 OK - Success
- 201 Created - Resource created
- 400 Bad Request - Validation error
- 401 Unauthorized - Missing/invalid auth
- 403 Forbidden - Insufficient permissions
- 404 Not Found - Resource not found
- 409 Conflict - Duplicate resource
- 422 Unprocessable - Logic error
- 500 Internal Server Error

**Response Format**:
```json
{
  "success": boolean,
  "message": "string",
  "data": { ... },
  "errors": [ { "field": "...", "message": "..." } ]
}
```

---

## Part 3: Frontend Architecture (Next.js + React)

### 3.1 Pages & Features

#### Authentication Flow
- `/auth/login` - Login form → JWT token
- `/auth/register` - Registration → Account creation
- Redirect to `/dashboard` on success

#### Main Dashboard
- `/dashboard` - Overview
  - User stats (level, XP, coins, streak)
  - Daily habit tracker
  - Recent notifications
  - Quick actions (log habit, view leaderboard)

#### Habit Management
- `/habits` - List all habits with status
- `/habits/new` - Create habit form
- `/habits/:id/edit` - Edit habit
- `/habits/:id/details` - View history, logs

#### Achievements
- `/achievements` - Browse all badges + earned badges
- `/next-badges` - Progress towards next 5 badges
- Share achievements button

#### Challenges
- `/challenges` - List active challenges
- `/challenges/:id` - Challenge details + leaderboard
- Join/leave buttons

#### Social
- `/friends` - Friends list
- `/leaderboards` - Global, friends, weekly tabs
- `/profile/:userId` - Public profile + stats
- Profile cards with compare button

#### Shop
- `/shop` - Browse all items by category
- `/shop/inventory` - Owned items + equipped
- `/shop/history` - Purchase history

#### Notifications
- `/notifications` - Notification inbox
- Mark individual / mark all read
- Delete functionality
- Toast notifications on real-time events

### 3.2 UI Components

**Habit Card**:
- Habit name + target (w/ unit)
- Completion status (today/weekly)
- Quick log button
- Difficulty badge (color: green/orange/red)
- Streak counter

**Badge Card**:
- Badge image + name
- Criteria + progress bar
- Locked/unlocked state
- Share button

**Leaderboard Row**:
- Rank #
- User avatar + username
- XP or weekly XP
- Level
- Current streak
- Compare/follow buttons

**Notification Toast**:
- Title + message
- Action button (optional)
- Auto-dismiss after 5s
- Stacks vertically

### 3.3 Real-Time Updates

**WebSocket Events**:
- `streak_warning` - 2 hours before midnight
- `badge_earned` - Instant toast
- `challenge_completed` - Congratulations modal
- `friend_request` - Badge on notifications
- `new_challenge` - Banner alert

---

## Part 4: Gamification Details

### 4.1 XP System

**Base XP by Difficulty**:
- Easy: 10 XP
- Medium: 25 XP
- Hard: 50 XP

**Streak Multipliers**:
- Days 1-6: 1x multiplier
- Days 7-29: 1.5x multiplier (50% bonus)
- Days 30+: 2x multiplier (100% bonus)

**Example**:
- Hard habit, no streak: 50 XP, 5 coins
- Hard habit, 7-day streak: 75 XP, 7-8 coins
- Hard habit, 30-day streak: 100 XP, 10 coins

**Level Formula**:
- Level 1: 0-99 XP
- Level 2: 100-399 XP (requires 100)
- Level 3: 400-899 XP (requires 400)
- Level N: (N-1)² × 100 to N² × 100

### 4.2 Coin Economy

**Earning**:
- Daily habits: Coins = XP / 10
- Challenges: 50-100 coins per challenge
- Badges: Optional 10-50 bonus coins

**Spending**:
- Avatar items: 50-200 coins
- Themes: 100-300 coins
- Consumables: 25-100 coins

**Balancing**:
- Avg user earns 20 coins/day (2 medium habits)
- Avatar item (100 coins) = 5 days grinding
- Prevents "pay-to-win", rewards consistency

### 4.3 Streaks

**Definition**:
- Days habit was logged on today or yesterday
- Resets if missed a day

**Milestones**:
- Day 7: 7-Day Warrior badge
- Day 30: 30-Day Champion badge
- Day 100: 100-Day Legend badge
- Day 365: 365-Day Master badge

**Motivation**:
- See streak number prominently
- Warning notification at 20:00 if not logged
- Streak broken message if reset
- Max streak records personal best

### 4.4 Challenges

**Duration**: 1-4 weeks typically
- Start/end dates set by admins
- Auto-expire after end_date

**Examples**:
- "Complete 10 workout logs this week" → 50 XP, 25 coins
- "Maintain all 3 habits for 7 days" → 100 XP, 100 coins + badge
- "Reach level 5" → 75 XP, special badge

**Mechanics**:
- Progress bar shows X/target
- Leaderboard shows who's winning
- Auto-complete on target reach
- Failure if challenge expires

### 4.5 Badge Philosophy

**Two Types**:
1. **Earned Badges**: Automatic unlock when criteria met (no purchase)
2. **Purchased Badges**: Buy with coins (cosmetic, no gameplay effect)

**Design**:
- Achievement = motivation to play more
- Rare achievements (365-day) highly valued
- Social sharing (brag on leaderboard)
- Completionism appeals to power users

---

## Part 5: Implementation Roadmap

### Phase 1: MVP (Weeks 1-2)
- [ ] Database schema + migrations
- [ ] Auth service (register, login, JWT)
- [ ] Habit CRUD + logging
- [ ] Gamification engine (XP, level, coins)
- [ ] Streak service
- [ ] Badge auto-awarding
- [ ] Basic frontend dashboard

### Phase 2: Social (Weeks 3-4)
- [ ] Friend system (requests, blocks)
- [ ] Global leaderboards
- [ ] Friends leaderboard
- [ ] Notifications service
- [ ] Notifications UI

### Phase 3: Challenges & Shop (Weeks 5-6)
- [ ] Challenge system
- [ ] Challenge leaderboards
- [ ] Reward shop
- [ ] Purchases & inventory
- [ ] Item effects

### Phase 4: Polish & Deploy (Week 7)
- [ ] Performance optimization
- [ ] Testing & QA
- [ ] Background job setup
- [ ] Deployment (Docker/K8s)
- [ ] Monitoring & logging
- [ ] Documentation

---

## Key Decisions

### Why PostgreSQL?
- Complex relational data (habits, logs, badges)
- Strong ACID guarantees for finances (coins)
- Great JSON support (flexible shop items)
- Performance for leaderboards

### Why Node.js + Express?
- Fast development velocity
- JavaScript full-stack (shared types with TypeScript)
- Great library ecosystem
- Easy horizontal scaling

### Why JWT over sessions?
- Stateless authentication (easier to scale)
- No session storage needed
- Standard for mobile apps
- Supports refresh tokens

### Why Redis for caching?
- Fast leaderboard queries
- Session caching
- Pub/sub for real-time features
- TTL support

### Soft Deletes?
- User deletion must preserve data (streaks, history)
- Regulatory (GDPR) allows "anonymization" instead of deletion
- Can restore accounts if user changes mind
- Simpler than cascading real deletes

---

## Success Metrics

1. **User Engagement**:
   - Daily active users (DAU)
   - Habit completion rate (% of habits logged daily)
   - Average streak length

2. **Retention**:
   - 7-day retention (% users return after week)
   - 30-day retention
   - Churn rate

3. **Social**:
   - % users with friends
   - Average friend count
   - Challenge participation rate

4. **Monetization** (future):
   - % users making purchases
   - Average revenue per user (ARPU)
   - Lifetime value (LTV)

5. **System Health**:
   - API response time (<200ms)
   - Database query time (<50ms)
   - Error rate (<0.1%)
   - Uptime (>99.9%)

---

## Maintenance & Operations

### Monitoring
- Application metrics (requests, errors, latency)
- Database metrics (query time, connection pool)
- Infrastructure (CPU, memory, disk)

### Backups
- Database: Daily snapshots to S3
- Configuration: Version control
- Retention: 30 days minimum

### Scaling Strategy
- Vertical: Larger server initially
- Horizontal: Load balancer + multiple API servers
- Database: Read replicas for leaderboards
- Cache: Redis cluster for high traffic

### Disaster Recovery
- Backup restore plan
- Failover procedures
- Data integrity checks
- RTO/RPO targets

---

This specification provides a complete blueprint for building SmartHabbit from database to frontend, ensuring consistency and quality throughout the development process.
