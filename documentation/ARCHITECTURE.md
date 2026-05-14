# SmartHabbit Architecture Overview

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER (Frontend)                       │
│  React + Next.js client (separate repo)                              │
│  - Dashboard, Habits, Badges, Challenges, Social, Shop               │
└────────────┬────────────────────────────────────────────────────────┘
             │
             │ HTTPS / WebSocket
             │
┌────────────▼────────────────────────────────────────────────────────┐
│                         API GATEWAY / LOAD BALANCER                   │
│  Express.js on Node.js (Port 3000)                                    │
│  - CORS, Rate Limiting, JWT Auth, Error Handling                      │
└────────────┬────────────────────────────────────────────────────────┘
             │
    ┌────────┼────────┐
    │        │        │
┌───▼──┐ ┌──▼───┐ ┌──▼───┐
│Auth  │ │Users │ │Habits │  ← Route Handlers
│Routes│ │Routes│ │Routes │
└──┬───┘ └──┬───┘ └──┬───┘
   │        │       │
   └────────┼───────┘
            │
    ┌───────▼──────────────────────────┐
    │  SERVICE LAYER (Business Logic)    │
    ├────────────────────────────────────┤
    │ 1. GamificationEngine              │  XP, Level, Coins
    │ 2. BadgeService                    │  Achievement system
    │ 3. StreakService                   │  Streak tracking
    │ 4. ChallengeService                │  Challenges
    │ 5. SocialService                   │  Friends, Leaderboards
    │ 6. ShopService                     │  Purchases
    │ 7. NotificationService             │  Alerts
    └───────┬──────────────────────────┘
            │
    ┌───────▼────────────┐
    │ CACHE LAYER        │
    │ Redis (Optional)   │
    │ - Leaderboards     │
    │ - Sessions         │
    │ - Streaks          │
    └───────┬────────────┘
            │
    ┌───────▼──────────────────────────┐
    │ PRIMARY DATA STORE                 │
    │ PostgreSQL (Port 5432)             │
    │ - 11 tables with indexes           │
    │ - Transactions for atomicity       │
    │ - Soft deletes for recovery        │
    ├────────────────────────────────────┤
    │ Tables:                            │
    │ - users, habits, habit_logs        │
    │ - badges, user_badges              │
    │ - challenges, user_challenges      │
    │ - reward_shop, purchases           │
    │ - friends, notifications           │
    └────────────────────────────────────┘
```

## Request Flow Example: "Log Habit Completion"

```
1. CLIENT REQUEST
   POST /api/habits/{habitId}/log
   { "value": 5.0 }
   Authorization: Bearer {JWT_TOKEN}

         ↓

2. MIDDLEWARE PIPELINE
   ✓ authMiddleware → Verify JWT token
   ✓ validateBody → Check { value: number }
   ✓ errorHandler → Ready to catch errors

         ↓

3. ROUTE HANDLER (/routes/habits.ts)
   - Extract userId from JWT
   - Call gamificationEngine.processHabitCompletion()

         ↓

4. TRANSACTION BEGIN
   await db.transaction(async (client) => {

         ↓

5. SERVICE 1: GamificationEngine
   - Get habit details (difficulty)
   - Get user stats (current XP, streak)
   - Calculate XP: baseXP * streakMultiplier
   - Insert habit_log (or update)
   - Update users table (XP, coins, level)

         ↓

6. SERVICE 2: StreakService (auto-called)
   - Check last_logged_date vs TODAY
   - Increment/reset current_streak
   - Update max_streak if new record
   - Create streak milestone notification if 7/30/100/365

         ↓

7. SERVICE 3: BadgeService (auto-called)
   - Query unearned badges
   - Check if user now qualifies
   - Award badges if criteria met
   - Award bonus XP/coins per badge

         ↓

8. SERVICE 4: ChallengeService (auto-called)
   - Get active challenges for user
   - Increment challenge progress
   - Auto-complete if progress >= target
   - Award challenge rewards (XP, coins, badge)

         ↓

9. TRANSACTION COMMIT
   All changes applied atomically
   OR ROLLBACK if any error

         ↓

10. RESPONSE TO CLIENT
    {
      "success": true,
      "data": {
        "habitCompletion": { xpEarned, coinsEarned, newLevel, leveledUp },
        "streak": { newStreak, maxStreak, streakBroken },
        "badgesEarned": [ { badge_id, name, xpBonus } ],
        "challengesCompleted": [ { challenge_id, rewards } ]
      }
    }

         ↓

11. FRONTEND
    - Update user stats display
    - Show levelup animation if leveledUp
    - Toast notifications for badges/challenges
    - Refresh habit logs
```

## Service Dependency Map

```
┌─────────────────────────────────────────────────────────────┐
│                    Habit Log Endpoint                       │
│              (Main gamification trigger)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐   ┌────▼──────┐  ┌───▼─────────┐
   │Gamif    │   │Streak     │  │Badge        │
   │Engine   │   │Service    │  │Service      │
   └────┬────┘   └────┬──────┘  └───┬─────────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
              ┌───────▼────────┐
              │Challenge       │
              │Service         │
              └───────┬────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
    ┌────▼───┐  ┌────▼───┐  ┌────▼──────┐
    │Notif   │  │Shop    │  │Social     │
    │Service │  │Service │  │Service    │
    └────────┘  └────────┘  └───────────┘
```

## Technology Stack Details

### Backend
```javascript
Express.js 4.18              // HTTP server framework
TypeScript 5.3              // Type-safe language
Node.js 18+                 // Runtime
PostgreSQL 14+              // Relational database
Redis 4 (optional)          // Cache layer
bcrypt 5.1                  // Password hashing
jsonwebtoken 9.1            // JWT auth
```

### Configuration & Utilities
```javascript
dotenv 16.3                 // Environment variables
joi 17.11                   // Data validation
uuid 9.0                    // ID generation
cors 2.8                    // CORS support
morgan 1.10                 // HTTP logging
helmet 7.1                  // Security headers
express-rate-limit 7.1      // Rate limiting
pg 8.11                     // PostgreSQL client
```

## Database Connection Pooling

```
Application layer
       ↓
┌──────────────────┐
│ pg.Pool (max=20) │ ← Connection pool
├──────────────────┤
│ Active Conn: 3   │
│ Idle Conn: 5     │
│ Waiting: 0       │
│ Timeout: 30s     │
└────────┬─────────┘
         │
      ┌──┴──┬───┬──┐
      │     │   │  │ ← PostgreSQL server
```

## Environment Configuration

```env
# App
NODE_ENV=development
PORT=3000
HOST=localhost

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=smarthabbit_dev
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false

# JWT
JWT_SECRET=your-secret-key-change-in-prod
JWT_EXPIRY=24h

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379

# API
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100
```

## API Response Format

**Success Response (200)**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response (4xx/5xx)**
```json
{
  "success": false,
  "message": "Human-readable error",
  "errors": [
    { "field": "email", "message": "Invalid format" }
  ]
}
```

## Database Query Patterns

### 1. Read with Indexing
```sql
SELECT * FROM users 
WHERE username = $1 AND deleted_at IS NULL
-- Index: idx_users_username (fast)
```

### 2. Transaction with Rollback Safety
```javascript
await db.transaction(async (client) => {
  await client.query('BEGIN');
  // ... operations ...
  await client.query('COMMIT');
  // AUTO: ROLLBACK on error
});
```

### 3. Atomic Updates
```sql
UPDATE users 
SET coins = coins - $1 
WHERE id = $2 AND coins >= $1
```

## Security Layers

```
┌─────────────────────────────────────────┐
│ 1. HTTPS/TLS                            │
│    (Encryption in transit)              │
├─────────────────────────────────────────┤
│ 2. Helmet Headers                       │
│    (XSS, Clickjacking protection)       │
├─────────────────────────────────────────┤
│ 3. CORS Whitelist                       │
│    (Prevent CORS attacks)               │
├─────────────────────────────────────────┤
│ 4. Rate Limiting                        │
│    (100 req/min per user)               │
├─────────────────────────────────────────┤
│ 5. JWT Authentication                   │
│    (Token-based auth with expiry)       │
├─────────────────────────────────────────┤
│ 6. Input Validation                     │
│    (Joi schema validation)              │
├─────────────────────────────────────────┤
│ 7. SQL Injection Prevention              │
│    (Parameterized queries, pg module)  │
├─────────────────────────────────────────┤
│ 8. Password Hashing                     │
│    (Bcrypt 10 rounds)                   │
├─────────────────────────────────────────┤
│ 9. API Permissions                      │
│    (Users only modify own data)         │
├─────────────────────────────────────────┤
│ 10. Sensitive Data Filtering             │
│    (password_hash never returned)       │
└─────────────────────────────────────────┘
```

## Caching Strategy

### Cache Keys & TTLs

| Key Pattern | TTL | Invalidation |
|-----------|-----|-------------|
| `user:{userId}:profile` | 1h | On profile update |
| `user:{userId}:streak` | 24h | On habit log |
| `leaderboard:global:weekly` | 1 week | Cron refresh |
| `leaderboard:friends:{userId}` | 1h | On XP update |
| `habit:{habitId}:today` | 24h | On log completion |

## Performance Optimization Techniques

1. **Indexing**: 10+ database indexes on high-query columns
2. **Connection Pooling**: Max 20 simultaneous DB connections
3. **Caching**: Redis for frequently accessed data
4. **Query Optimization**: Efficient JOINs, DISTINCT, GROUP BY
5. **Pagination**: Limit results in API responses
6. **Lazy Loading**: Load related data on demand
7. **Materialized Views**: Pre-calculated leaderboards
8. **Partitioning**: habit_logs split by month

## Testing Strategy

```
Unit Tests
├─ GamificationEngine (XP calculations)
├─ BadgeService (criteria checks)
├─ Auth utils (password hashing)
└─ Validators (input validation)

Integration Tests
├─ Full habit completion flow
├─ Transaction rollback scenarios
├─ Concurrent requests
└─ Database constraints

Load Tests
├─ Leaderboard queries (100 users)
├─ Concurrent habit logs
└─ Rate limiting enforcement
```

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Seed data installed
- [ ] SSL/TLS certificates set up
- [ ] CORS origins whitelisted
- [ ] JWT_SECRET is strong (32+ chars, random)
- [ ] Database backups configured
- [ ] Monitoring enabled
- [ ] Error reporting configured
- [ ] Rate limiting adjusted for production
- [ ] Logs aggregation set up
- [ ] Health check endpoint verified

## Common Issues & Solutions

### Database Connection Timeout
- Check PostgreSQL is running
- Verify credentials in .env
- Increase `connectionTimeoutMillis` if needed

### High Memory Usage
- Check connection pool isn't exhausted
- Monitor Redis memory if used
- Implement pagination for large queries

### Slow Leaderboard Queries
- Enable materialized view caching
- Add indexes on sort columns
- Limit leaderboard size (top 100)

### Race Conditions in Gamification
- All XP/coin updates use transactions
- Habit logs use UNIQUE constraint
- Idempotent design prevents double-rewards

---

This architecture ensures scalability, reliability, and maintainability while supporting SmartHabbit's gamification features.
