# SmartHabbit Backend - Getting Started Guide

Quick start guide to set up and run the SmartHabbit backend locally.

## Prerequisites

### Required
- **Node.js** 18+ (LTS recommended)
  - [Download](https://nodejs.org/)
  - Verify: `node --version` (should be v18+)
  
- **PostgreSQL** 14+
  - [Download](https://www.postgresql.org/download/)
  - Verify: `psql --version`
  - Start service: 
    - Windows: PostgreSQL service should auto-start
    - Mac: `brew services start postgresql`
    - Linux: `sudo systemctl start postgresql`

- **npm** 8+
  - Usually installed with Node.js
  - Verify: `npm --version`

### Optional
- **Redis** 6+ (for caching)
  - [Download](https://redis.io/download)
  - Only needed for production caching (local development works without)

- **Git** (for cloning)
  - [Download](https://git-scm.com/)

- **VS Code** (recommended IDE)
  - [Download](https://code.visualstudio.com/)

---

## Installation Steps

### 1. Clone/Navigate to Project

```bash
# If cloning:
git clone <repository-url>
cd smartHabbit/backend

# If already in project:
cd backend
```

### 2. Install Dependencies

```bash
npm install
```

This installs all packages listed in `package.json`. **Watch for any errors** - fix them before proceeding.

### 3. Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Inside psql:
CREATE DATABASE smarthabbit_dev;
CREATE DATABASE smarthabbit_test;

# Verify:
\l

# Exit psql:
\q
```

**Windows users**: If psql command not found, add PostgreSQL to PATH or use pgAdmin GUI.

### 4. Configure Environment Variables

```bash
# Copy example to .env
cp .env.example .env

# Edit .env with your local settings
# Windows users: Copy .env.example to .env using File Explorer
```

**Edit `.backend/.env`** with your database credentials:

```env
NODE_ENV=development
PORT=3000
HOST=localhost

# Update these to match your PostgreSQL setup
DB_HOST=localhost
DB_PORT=5432
DB_NAME=smarthabbit_dev
DB_USER=postgres
DB_PASSWORD=postgres  # Change to your PostgreSQL password
DB_SSL=false

# Generate a random JWT secret (for development):
JWT_SECRET=your-random-secret-key-12345

JWT_EXPIRY=24h
REFRESH_TOKEN_EXPIRY=7d

# Keep Redis disabled for local development (optional)
REDIS_HOST=localhost
REDIS_PORT=6379

LOG_LEVEL=debug

API_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```

### 5. Run Database Migrations

```bash
npm run migrate
```

This executes all SQL files in `migrations/` folder to create tables:
- users, habits, habit_logs
- badges, user_badges
- challenges, user_challenges
- reward_shop, purchases
- friends, notifications

**Expected output**:
```
✓ Migrated: 001_create_users_table.sql
✓ Migrated: 002_create_habits_table.sql
... (9 more)
```

### 6. (Optional) Seed Sample Data

```bash
npm run seed
```

Creates sample users, habits, badges for testing. **Skip this if you prefer a blank database.**

### 7. Start Development Server

```bash
npm run dev
```

**Expected output**:
```
✓ SmartHabbit API running at http://localhost:3000
✓ Environment: development
```

The server will **auto-restart** if you modify source files (using ts-node with watch).

---

## Verify Installation

Open a new terminal and test the API:

```bash
# Health check
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","timestamp":"2024-01-15T10:30:00.000Z"}
```

---

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── index.ts          # Configuration loader
│   │   └── database.ts       # Database connection
│   ├── middleware/
│   │   ├── auth.ts           # JWT authentication
│   │   └── validation.ts     # Input validation
│   ├── routes/
│   │   ├── auth.ts           # /api/auth/*
│   │   ├── users.ts          # /api/users/*
│   │   ├── habits.ts         # /api/habits/*
│   │   ├── badges.ts         # /api/badges/*
│   │   ├── challenges.ts     # /api/challenges/*
│   │   ├── social.ts         # /api/friends/*
│   │   ├── shop.ts           # /api/shop/*
│   │   └── notifications.ts  # /api/notifications/*
│   ├── services/
│   │   ├── GamificationEngine.ts
│   │   ├── BadgeService.ts
│   │   ├── StreakService.ts
│   │   ├── ChallengeService.ts
│   │   ├── SocialService.ts
│   │   ├── ShopService.ts
│   │   └── NotificationService.ts
│   ├── utils/
│   │   └── auth.ts           # Auth utilities
│   └── index.ts              # Application entry point
├── migrations/               # SQL migration files
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## Common Commands

```bash
# Development
npm run dev              # Start with hot-reload

# Production
npm run build            # Compile TypeScript → dist/
npm start                # Run compiled code

# Database
npm run migrate          # Run migrations
npm run migrate:rollback # Undo migrations (not implemented)

# Code Quality
npm run lint             # Check code style
npm format               # Auto-format code

# Testing
npm test                 # Run tests
npm test:watch           # Watch mode
npm test:coverage        # Coverage report
```

---

## Testing API Endpoints

### 1. Register User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "TestPassword123"
  }'
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "username": "testuser", ... },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

### 2. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123"
  }'
```

### 3. Get User Profile (Requires Token)

```bash
curl -X GET http://localhost:3000/api/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Create Habit

```bash
curl -X POST http://localhost:3000/api/habits \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Morning Workout",
    "goal_type": "daily",
    "difficulty": "medium",
    "target_value": 30,
    "description": "30 minutes of exercise"
  }'
```

### 5. Log Habit Completion

```bash
curl -X POST http://localhost:3000/api/habits/{HABIT_ID}/log \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "value": 30
  }'
```

---

## Using Postman

1. **Download**: [Postman](https://www.postman.com/downloads/)
2. **Import collection**: (optional, create collection manually)
3. **Environment variables**: Set `baseUrl=http://localhost:3000` and `accessToken`
4. **Example request**:
   - Method: POST
   - URL: `{{baseUrl}}/api/auth/register`
   - Body (raw JSON): Register user data
   - Click `Send`

---

## Troubleshooting

### "Cannot find module 'dotenv'"

**Problem**: npm install didn't complete successfully

**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
```

### "ECONNREFUSED - Database connection failed"

**Problem**: PostgreSQL not running

**Solution** (Windows):
1. Search "Services" → Start "PostgreSQL 14 Server"

**Solution** (Mac):
```bash
brew services start postgresql
```

**Solution** (Linux):
```bash
sudo systemctl start postgresql
```

### "Database 'smarthabbit_dev' does not exist"

**Problem**: Forgot to create database

**Solution**:
```bash
psql -U postgres -c "CREATE DATABASE smarthabbit_dev;"
```

### "jwt malformed" / "jwt expired"

**Problem**: Invalid or expired token

**Solution**:
1. Login again to get new token
2. Copy full token (no "Bearer" prefix)
3. Paste as `Authorization: Bearer {token}` header

### "Validation failed" errors

**Problem**: Invalid input data

**Solution**:
1. Check error message for which field is invalid
2. Verify data types (string, number, enum)
3. Check password requirements (8+ chars, uppercase, number)

### Port 3000 already in use

**Problem**: Another process using port 3000

**Solution**:
```bash
# Find process on port 3000
lsof -i :3000  (Mac/Linux)
netstat -ano | findstr :3000  (Windows)

# Kill process or use different port
PORT=3001 npm run dev
```

---

## Development Workflow

### 1. Make a code change
```typescript
// Example: src/services/GamificationEngine.ts
console.log('Debugging XP calculation');
```

### 2. Hot-reload activates automatically
```
[nodemon] restarting due to changes...
[nodemon] starting `ts-node src/index.ts`
```

### 3. Test your changes
```bash
curl http://localhost:3000/api/habits/123/log -H "Authorization: Bearer ..."
```

### 4. Fix issues and retry
(Repeat 1-3 until working)

---

## Database Inspection

### Using psql CLI

```bash
# Connect to database
psql -U postgres -d smarthabbit_dev

# List tables
\dt

# View schema of a table
\d users

# Query data
SELECT * FROM users LIMIT 10;

# Exit
\q
```

### Using DBeaver (GUI)

1. Download [DBeaver Community](https://dbeaver.io/)
2. Create PostgreSQL connection:
   - Host: localhost
   - Port: 5432
   - Database: smarthabbit_dev
   - User: postgres
   - Password: your_password
3. Browse tables, run queries, edit data visually

---

## Next Steps

1. **Explore API endpoints**: Try different HTTP methods and parameters
2. **Read service code**: Understand game logic in `src/services/`
3. **Modify test data**: Create habits, log completions, trigger badges
4. **Build frontend**: Create React/Next.js client consuming these APIs
5. **Deploy**: Follow deployment guide in README.md

---

## Additional Resources

- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Express.js Guide**: https://expressjs.com/
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **JWT Overview**: https://jwt.io/introduction
- **REST API Best Practices**: https://restfulapi.net/

---

## Getting Help

1. **Check logs**: Output in terminal shows errors with line numbers
2. **Read error messages**: They usually indicate the problem
3. **Inspect database**: Verify data was inserted with psql/DBeaver
4. **Test in Postman**: Isolate API from frontend problems
5. **Review migrations**: Ensure all tables exist with `\dt`

---

## Next: Building Frontend

Once backend is running, you can:
1. Create React/Next.js application
2. Add Tailwind CSS for styling
3. Implement authentication flow (login/register)
4. Build dashboard with habit tracker
5. Connect to backend APIs

See `documentation/SPECIFICATION.md` for frontend blueprint.

---

**Questions?** Check `README.md`, `ARCHITECTURE.md`, or examine source code comments.

Happy coding! 🚀
