# SmartHabbit Backend

A comprehensive gamification platform backend for habit tracking with XP, streaks, badges, challenges, and social features.

## Technology Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT
- **Caching**: Redis (optional)
- **Security**: Helmet, CORS, Rate Limiting, bcrypt

## Project Structure

```
backend/
├── src/
│   ├── config/              # Configuration & Database
│   ├── middleware/          # Auth, validation, error handling
│   ├── routes/              # API endpoints
│   ├── services/            # Business logic
│   ├── utils/               # Helper functions
│   └── index.ts             # Application entry point
├── migrations/              # Database migrations
├── package.json
├── tsconfig.json
└── .env.example
```

## Features

### 🎯 Gamification Engine
- Dynamic XP/Level calculation with multipliers
- Streak tracking with bonuses
- Coin rewards system
- Performance-optimized leaderboards

### 🏆 Achievement System
- 10+ pre-defined badges (streaks, XP milestones, completions)
- Automatic badge awarding
- Badge notifications

### ⚔️ Challenges
- Limited-time challenges
- Challenge leaderboards
- Progress tracking
- Automatic rewards on completion

### 👥 Social Features
- Friend management (requests, blocks)
- Global & friends leaderboards
- Weekly rankings

### 🛒 Reward Shop
- Purchasable items (avatars, themes, consumables)
- Flexible JSONB configuration
- Transaction logging

### 🔔 Notifications
- Real-time alerts (streaks, badges, challenges)
- Read/unread tracking
- Notification management

## Setup & Installation

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+
- Redis (optional, for caching)

### Steps

1. **Install dependencies**
```bash
cd backend
npm install
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your database credentials and JWT secret
```

3. **Run migrations**
```bash
npm run migrate
```

4. **Seed sample data (optional)**
```bash
npm run seed
```

5. **Start development server**
```bash
npm run dev
```

Server will run at `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token

### Users
- `GET /api/users/me` - Get profile
- `PUT /api/users/me` - Update profile
- `GET /api/users/:id/stats` - Get user stats

### Habits
- `GET /api/habits` - List habits
- `POST /api/habits` - Create habit
- `PUT /api/habits/:id` - Update habit
- `DELETE /api/habits/:id` - Delete habit
- `POST /api/habits/:id/log` - Log completion
- `GET /api/habits/:id/history` - Get logs

### Badges
- `GET /api/badges` - List all badges
- `GET /api/badges/user/earned` - Get earned badges
- `GET /api/badges/user/next` - Get next badges

### Challenges
- `GET /api/challenges` - List active challenges
- `POST /api/challenges/:id/join` - Join challenge
- `GET /api/challenges/user/active` - Get active challenges
- `GET /api/challenges/:id/leaderboard` - Challenge leaderboard

### Social
- `GET /api/friends` - List friends
- `POST /api/friends/request/:id` - Send request
- `PUT /api/friends/:id/accept` - Accept request
- `GET /api/leaderboards/global` - Global leaderboard
- `GET /api/leaderboards/friends` - Friends leaderboard

### Shop
- `GET /api/shop/items` - List shop items
- `POST /api/shop/purchase` - Buy item
- `GET /api/shop/user/inventory` - Get inventory

### Notifications
- `GET /api/notifications` - Get notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `DELETE /api/notifications/:id` - Delete notification

## Database Schema

The application uses 11 core tables:

1. **users** - User accounts, gamification stats
2. **habits** - User-created habits
3. **habit_logs** - Daily habit completions
4. **badges** - Achievement definitions
5. **user_badges** - User's earned badges
6. **challenges** - Limited-time challenges
7. **user_challenges** - User challenge participation
8. **reward_shop** - Shop items
9. **purchases** - Purchase history
10. **friends** - Social graph
11. **notifications** - User alerts

All tables include proper indexes, constraints, and soft-delete support.

## Performance Features

- **Indexes** on frequently queried columns (user_id, created_at, logged_date)
- **Composite indexes** for complex queries
- **Materialized views** for leaderboards
- **Table partitioning** for habit_logs (by month)
- **Redis caching** for leaderboards and sessions
- **Connection pooling** with pg module

## Security

- Password hashing with bcrypt (10 rounds)
- JWT token authentication (24h expiry)
- Rate limiting (100 req/min per user)
- Input validation and sanitization
- SQL injection prevention (parameterized queries)
- CORS configuration
- Helmet security headers
- Soft deletes for data recovery

## Testing

```bash
npm test              # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

## Deployment

### Production Build
```bash
npm run build
npm start
```

### Environment Variables (Production)
Set these in your deployment:
- `NODE_ENV=production`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET` (strong random string)
- `API_URL`
- `CORS_ORIGIN`

### Docker (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## Caching Strategy (Redis)

Configure in `.env`:
```
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

Common cache keys:
- `user:{userId}:profile` - User info (1 hour)
- `user:{userId}:streak` - Current streak (24 hours)
- `leaderboard:global:weekly` - Weekly leaderboard (1 week)
- `leaderboard:friends:{userId}` - Friends rankings (1 hour)

## Background Jobs

Recommended cron jobs (implement with node-cron or external job queue):
- Daily 00:00 - Reset broken streaks
- Daily 20:00 - Send streak reminders
- Hourly - Expire challenges
- Weekly - Recalculate leaderboards
- Monthly - Archive old logs

## Monitoring & Logging

The application uses Morgan for HTTP logging. Configure `LOG_LEVEL` in `.env`:
- `debug` - Development
- `info` - Production
- `error` - Errors only

## Troubleshooting

### Database Connection Failed
- Verify PostgreSQL is running
- Check DB credentials in `.env`
- Ensure database exists: `createdb smarthabbit_dev`

### Authentication Errors
- Verify JWT_SECRET is set and strong
- Check token expiry: `JWT_EXPIRY=24h`
- Ensure Authorization header format: `Bearer <token>`

### Race Conditions in Gamification
- Uses database transactions for atomic operations
- Habit logs use UNIQUE constraint on (habit_id, user_id, logged_date)
- Idempotent design - same log updates, not inserts

## License

MIT

## Support

For issues or questions, create a GitHub issue or contact the development team.
