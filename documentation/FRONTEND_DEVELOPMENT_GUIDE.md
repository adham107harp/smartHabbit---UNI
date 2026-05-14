# SmartHabbit Frontend Development Guide

## Overview

This guide describes everything the frontend developer needs to build for the SmartHabbit platform. The backend API is complete with 38 endpoints ready to consume. This document outlines the pages, components, features, and integration points needed.

---

## 1. Technology Stack

### Required Technologies
- **Framework**: Next.js 14.x (React 18.x)
- **Language**: TypeScript 5.3+
- **Styling**: Tailwind CSS 3.x
- **State Management**: Zustand or Redux Toolkit
- **HTTP Client**: Axios or Fetch API
- **Real-Time**: Socket.io Client
- **Charts/Gamification**: Chart.js, Recharts, or Victory
- **Authentication**: JWT Token Storage (localStorage/sessionStorage)
- **Form Validation**: React Hook Form + Zod
- **UI Components**: shadcn/ui or Chakra UI
- **Testing**: Jest, React Testing Library
- **Deployment**: Vercel or Docker

### Project Structure
```
frontend/
├── app/                          # Next.js 14 app directory
│   ├── layout.tsx               # Root layout with providers
│   ├── page.tsx                 # Landing page
│   ├── (auth)/                  # Auth routes (group)
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── forgot-password/page.tsx
│   ├── (dashboard)/             # Protected routes
│   │   ├── dashboard/page.tsx   # Main dashboard
│   │   ├── habits/              # Habit management
│   │   ├── leaderboard/         # Global, friends, weekly
│   │   ├── shop/                # Item shop
│   │   ├── challenges/          # Challenges
│   │   ├── badges/              # Badge showcase
│   │   ├── profile/             # User profile
│   │   └── settings/            # User settings
│   └── api/                     # API route handlers (if needed)
├── components/
│   ├── auth/                    # Auth-related components
│   ├── common/                  # Reusable components (navbar, sidebar, footer)
│   ├── gamification/            # XP bars, level displays, badges, streaks
│   ├── habits/                  # Habit cards, habit forms, logging
│   ├── leaderboard/             # Leaderboard tables
│   ├── shop/                    # Shop items, purchase UI
│   └── notifications/           # Notification bell, notification list
├── lib/
│   ├── api/                     # API service functions
│   ├── auth.ts                  # JWT token management
│   ├── types.ts                 # TypeScript interfaces/types
│   └── utils.ts                 # Utility functions
├── hooks/                       # Custom React hooks
│   ├── useAuth.ts              # Auth state hook
│   ├── useUser.ts              # User data hook
│   └── useHabits.ts            # Habits data hook
├── store/                       # Zustand/Redux store
│   ├── authStore.ts
│   ├── userStore.ts
│   ├── habitsStore.ts
│   └── notificationStore.ts
├── styles/                      # Global styles, Tailwind config
├── middleware.ts                # Next.js middleware for auth protection
├── package.json
├── tsconfig.json
├── next.config.js
└── README.md
```

---

## 2. Authentication Pages

### 2.1 Register Page (`/register`)
**Purpose**: New user account creation

**Required Fields**:
- Username (text input, min 3 chars, max 20 chars, alphanumeric)
- Email (email input, unique validation via API)
- Password (password input, min 8 chars, 1 uppercase, 1 number, 1 special char)
- Confirm Password (password input, match validation)
- Terms & Conditions (checkbox)

**Actions**:
- POST `/api/auth/register` endpoint call
- Display validation errors from API
- Store JWT tokens (access + refresh)
- Redirect to `/dashboard` on success
- Display error toast on failure

**UX Elements**:
- Show password strength indicator
- Real-time username/email availability check
- "Already have account?" link to login page
- Loading state during submission

### 2.2 Login Page (`/login`)
**Purpose**: User authentication

**Required Fields**:
- Email or Username (text input)
- Password (password input)
- Remember Me (checkbox, optional)

**Actions**:
- POST `/api/auth/login` endpoint call
- Store access token (24h) + refresh token (7d)
- Redirect to `/dashboard` on success
- Display "Invalid credentials" error
- Support auto-login if remember me checked

**UX Elements**:
- "Forgot Password?" link
- "Don't have account?" link to register
- Loading state with spinner
- Show/hide password toggle
- Toast notifications for errors

### 2.3 Forgot Password Page (`/forgot-password`)
**Purpose**: Password recovery flow

**Required Steps**:
1. Enter email → Send reset link (implement backend endpoint if needed)
2. Check email inbox for reset token
3. Click link → Enter new password form
4. Submit and redirect to login

**Note**: Backend doesn't currently have this endpoint. Implement backend support first.

---

## 3. Dashboard Pages

### 3.1 Main Dashboard (`/dashboard`)
**Purpose**: Overview of user's habit progress and gamification status

**Display Sections**:

#### User Header Card
- Avatar image with upload option
- Username display
- Current level (large, prominent)
- Total XP with XP bar to next level
- Current coin balance (with icon)
- Streak counter (days)

#### Quick Stats Grid (4 columns)
- Total Habits Created
- Habits Completed Today
- Total Badges Earned (X/10)
- Weekly Completion Rate (%)

#### Today's Habits Section
- List of habits with today's status (completed/pending)
- Quick "Log" button for each habit
- Shows target value vs progress (e.g., "Drank 6/8 glasses")
- Color-coded by difficulty (green=easy, blue=medium, red=hard)

#### Recent Achievements
- Last 3 badges earned (small cards with icons)
- XP/coin rewards from today
- Notification feed (last 5 notifications)

#### Active Challenges Section
- 2-3 active challenges cards
- Progress bar showing completion %
- Days remaining countdown
- Join button if no active challenges

#### Gamification Summary
- XP earned this week (mini chart)
- Habits completed trend (line chart, last 7 days)
- Streak statistics

**Real-Time Updates**:
- WebSocket connection for live notifications
- Auto-refresh challenges leaderboard data every 30s
- Update XP/level when habit completed

### 3.2 Habits Pages (`/habits`)

#### 3.2.1 Habits List Page (`/habits`)
**Purpose**: View and manage all habits

**Display Elements**:
- Add New Habit button (opens modal)
- Filter tabs: All / Active / Completed / Archived
- Search bar for habit name
- Habit cards showing:
  - Habit name + description
  - Goal type (daily/weekly) badge
  - Difficulty color indicator
  - Completion percentage this week
  - Last logged date
  - Edit / Delete buttons
  - Log Entry button (prominent)

**Habit Card Details**:
- Progress bar if numeric goal (e.g., "20/30 minutes")
- Streak indicator (e.g., "7 day streak 🔥")
- Next badge progress (e.g., "2 completions to unlock [badge name]")

**Sorting Options**:
- Recently updated
- Difficulty (easy → hard)
- Completion rate (highest → lowest)
- Habit name (A → Z)

#### 3.2.2 Create/Edit Habit Modal
**Purpose**: Habit creation and modification

**Required Fields**:
- Habit Name (text input, required, max 100 chars)
- Description (textarea, optional, max 500 chars)
- Goal Type (radio buttons): Daily / Weekly
- Difficulty (radio buttons): Easy / Medium / Hard
- Target Value (number input, optional, e.g., "30" minutes)
- Target Unit (select dropdown): minutes / miles / reps / glasses / pages / etc.
- Color Tag (select from palette)

**Form Actions**:
- Create Habit: POST `/api/habits`
- Update Habit: PUT `/api/habits/:id`
- Show validation errors
- Success toast notification

#### 3.2.3 Habit Detail Page (`/habits/:id`)
**Purpose**: View single habit with history and stats

**Display Elements**:
- Habit header (name, description, difficulty, goal)
- Habit statistics:
  - Total completions
  - Current streak
  - Best streak
  - Week completion %
  - Next badge (with progress)
- Log History Table:
  - Columns: Date, Value Logged, XP Earned, Notes
  - Pagination (50 per page)
  - Export to CSV button
- Log Entry Button (prominent, primary action)
- Edit / Delete buttons

**Chart**:
- Last 30 days completion rate (calendar heat map)
- Progress trend (line chart)

#### 3.2.4 Habit Log Modal
**Purpose**: Record a habit completion

**Form Fields**:
- Date Selector (default: today, can select past dates)
- Value Input (number, if numeric goal)
- Notes (textarea, optional)
- Log button

**On Submit**:
- POST `/api/habits/:id/log` endpoint
- Display reward message:
  - XP earned (with streak multiplier if applicable)
  - Coins earned
  - New level (if leveled up) → Show celebration animation
  - New badge (if earned) → Show badge unlock modal
  - Challenge progress update
- Auto-update habit card
- Close modal and refresh dashboard

---

## 4. Gamification Pages

### 4.1 Badges Page (`/badges`)
**Purpose**: View all badges and earned achievements

**Display Layout**:
- Badge Grid (3-4 columns)
- Each badge card shows:
  - Badge icon/image (large)
  - Badge name
  - Badge description
  - Earned badge: ✓ icon + earned date
  - Locked badge: Lock icon + progress toward unlock (e.g., "5/7 streaks")
  - XP/coin reward value
- "Earned" filter tab
- "Next Badges" tab (showing unlockable badges with progress)

**Locked Badge Display**:
- Show criteria: "Earn a 7-day streak"
- Progress bar: "3/7 days"
- Estimated days to earn

### 4.2 Leaderboard Pages (`/leaderboard`)

#### 4.2.1 Global Leaderboard (`/leaderboard/global`)
**Purpose**: View top 100 players worldwide

**Table Columns**:
- Rank (1-100 with medal icons for top 3)
- Username (clickable to view profile)
- Level
- Total XP
- Coins
- Status badge (e.g., "Online", "Last seen 2h ago")

**Features**:
- Highlight current user's position
- "View Profile" button on each row
- Tab to view yourself in context (show ±5 positions)
- Refresh button (manual refresh, 5s auto-refresh for real-time)

#### 4.2.2 Friends Leaderboard (`/leaderboard/friends`)
**Purpose**: View ranking among friends

**Display**:
- Same table format as global
- Only show accepted friends
- If <3 friends: Show "Add Friends" prompt with search
- Friend status indicator

#### 4.2.3 Weekly Leaderboard (`/leaderboard/weekly`)
**Purpose**: View XP earned this week (Sun-Sat)

**Table Columns**:
- Rank
- Username
- XP Earned This Week
- Habits Completed This Week
- Streak Status

**Features**:
- Live updates via WebSocket
- Highlight current user
- "Week Duration" display showing reset time

### 4.3 Profile/Social Pages

#### 4.3.1 User Profile Page (`/profile/:userId`)
**Purpose**: View user profile and social info

**Display**:
- Avatar (with upload if viewing own profile)
- Username
- Join date
- Level + Total XP
- Badges (small grid of earned badges)
- Current Streak
- Total Habits Completed
- Stats graphs:
  - Last 30 days completion rate
  - XP progression (line chart)
- Friend Action Button:
  - Own profile: Edit Profile / Logout buttons
  - Other user: Add Friend / Message / Block buttons
  - Already friends: Remove Friend button

#### 4.3.2 Social/Friends Page (`/profile/friends`)
**Purpose**: Manage friend list and friend requests

**Display Areas**:

**Friend Requests Tab**:
- Incoming requests (with Accept/Decline buttons)
- Outgoing requests (with Cancel button)

**Friends List Tab**:
- All accepted friends in grid or list
- Each friend card shows:
  - Avatar
  - Username
  - Level
  - Current streak
  - Last activity time
  - Remove button
- Search/filter friends

**Find Friends Tab**:
- Search bar for username
- Browse suggested friends (top players)
- Send friend request button

---

## 5. Shop/Rewards Pages

### 5.1 Shop Page (`/shop`)
**Purpose**: Browse and purchase cosmetic and reward items

**Display Layout**:
- Coin Balance display (top right, prominent)
- Item Filter Tabs: All / Avatars / Themes / Badges / Consumables

**Item Grid (3-4 columns)**:
- Item image/icon (large, clickable)
- Item name
- Cost in coins
- Item type badge
- "Purchase" button (disabled if insufficient coins)
- "Already Owned" label (if purchased)

**Purchase Flow**:
1. Click "Purchase" button
2. Confirmation modal: "Spend X coins for Y?"
3. POST `/api/shop/purchase` endpoint
4. Success message + animation
5. Update coin balance
6. Mark item as owned

**Item Categories**:
- **Avatar Items**: Profile picture frames, accessories
- **Themes**: Dark mode, light mode, custom color schemes
- **Badges**: Cosmetic badge frames, animations
- **Consumables**: Temporary boosts, streak savers, XP multipliers

### 5.2 Inventory Page (`/shop/inventory`)
**Purpose**: View purchased items and apply them

**Display**:
- Section for each item type
- Owned items grid
- "Apply" button for themeable items (themes)
- "Use" button for consumables
- Sort by: Recently Purchased / Item Name

**Consumable Use Flow**:
- Click "Use"
- Confirmation modal
- POST endpoint to apply effect
- Notification showing effect (e.g., "+50% XP for 24 hours")
- Item removed from inventory

---

## 6. Challenges Pages

### 6.1 Challenges List Page (`/challenges`)
**Purpose**: Browse and join challenges

**Display Elements**:
- Active Challenges Tabs: All / My Challenges / Completed
- Challenge Cards (2-3 columns):
  - Challenge name
  - Description
  - Duration (e.g., "7 days remaining")
  - Participant count
  - Progress bar (for joined challenges)
  - Reward badge preview
  - XP/Coin rewards
  - Join/Leave buttons

**Filter Options**:
- by Difficulty
- by Duration
- by Reward size

**Sorting**:
- Most popular (most participants)
- Ending soon
- Recently created

### 6.2 Challenge Detail Page (`/challenges/:id`)
**Purpose**: View challenge details and leaderboard

**Display**:
- Challenge Header: Name, description, dates, rewards
- Challenge Progress (if joined):
  - Your progress bar
  - Current progress value
  - Target value
- Leaderboard Table:
  - Rank / Username / Progress / Status
  - Highlight your position
  - Top 10 shown, pagination for more

**Actions**:
- Join Challenge button (if not joined)
- Leave Challenge button (if joined)
- Share Challenge link

**Real-Time Updates**:
- Live leaderboard updates via WebSocket
- Refresh every 10s

---

## 7. Notifications

### 7.1 Notification Bell (Header)
**Purpose**: Quick notification access

**Display**:
- Bell icon with unread count badge
- Dropdown on click showing last 5 notifications
- Each notification shows:
  - Icon (by type)
  - Message
  - Timestamp
  - Mark as read button
  - Delete button
- "View All" link to notifications page
- Mark all as read button

### 7.2 Notifications Page (`/notifications`)
**Purpose**: Full notification history

**Display**:
- Notification list (20 per page)
- Filter tabs: All / Unread / Streaks / Badges / Challenges / Social
- Sort by: Newest / Oldest
- Each notification row shows:
  - Type icon (colored)
  - Message
  - Timestamp
  - Mark as read checkbox
  - Delete button

**Actions**:
- Bulk mark as read
- Bulk delete
- Auto-delete old notifications (>30 days)

**Notification Types to Display**:
1. **Streak Alert**: "⏰ Your 5-day streak ends in 2 hours. Complete [Habit Name]"
2. **Badge Earned**: "🏆 You unlocked [Badge Name] badge! +50 XP, +30 coins"
3. **Level Up**: "⬆️ You reached Level 5! +100 coins bonus"
4. **Challenge Complete**: "✅ You completed [Challenge Name]! +200 XP"
5. **Friend Request**: "👋 [User] sent you a friend request"
6. **General**: Custom notifications from system

---

## 8. Settings Pages

### 8.1 Profile Settings (`/settings/profile`)
**Purpose**: Manage user profile information

**Fields**:
- Avatar Upload (image preview)
- Username (editable, check availability)
- Email (display, change email option)
- Bio (textarea)
- Theme preference (dropdown)
- Save button

### 8.2 Security Settings (`/settings/security`)
**Purpose**: Security and authentication management

**Options**:
- Change Password form
- Two-Factor Authentication (if implementing)
- Active Sessions list (device, location, last used)
- Logout All Sessions button
- Account Deletion warning button

### 8.3 Notification Settings (`/settings/notifications`)
**Purpose**: Control notification preferences

**Toggle Options**:
- Streak Warnings (on/off)
- Badge Unlocks (on/off)
- Challenge Updates (on/off)
- Friend Requests (on/off)
- Leaderboard Changes (on/off)
- Email Notifications (on/off)

---

## 9. Authentication & Token Management

### 9.1 JWT Token Handling
**Required Implementation**:
- Store access token (24h expiry) in localStorage/sessionStorage
- Store refresh token (7d expiry) in HTTP-only cookie (if possible)
- Implement token refresh logic:
  - Automatic refresh before expiry
  - Refresh on 401 responses
  - Retry failed requests after refresh

### 9.2 Protected Routes
**Required**:
- Create middleware to check auth status
- Redirect unauthenticated users to /login
- Redirect authenticated users away from /register and /login
- Attach authorization header to all API requests

### 9.3 Auth Store (Zustand/Redux)
**State to Maintain**:
- `isAuthenticated` (boolean)
- `user` (user object with id, username, email, level, xp, coins)
- `accessToken` (string)
- `refreshToken` (string)
- `isLoading` (boolean during auth operations)
- `error` (error message, if any)

---

## 10. Real-Time Features

### 10.1 WebSocket Integration (Socket.io)
**Required Connections**:
- Connect to backend Socket.io server on app load
- Listen to channels:
  - `notifications`: Receive new notifications in real-time
  - `leaderboard:global`: Live leaderboard position changes
  - `leaderboard:weekly`: Weekly XP updates
  - `user:streaks`: Streak status changes
  - `challenges`: Challenge progress updates for joined challenges

### 10.2 Real-Time Updates
**Trigger Updates**:
- Habit completion → Update dashboard immediately
- Leaderboard pages → Auto-refresh positions
- Notifications → Display toast + bell badge
- Challenges → Update progress bars
- Level up → Show celebration animation

### 10.3 Offline Handling
- Queue habit logs if offline
- Sync on reconnection
- Show "offline" indicator when disconnected

---

## 11. API Integration Checklist

### 11.1 API Service Layer
**Create service functions for all 38 endpoints**:

**Auth Service** (3 endpoints):
- [ ] `registerUser(email, username, password)`
- [ ] `loginUser(email, password)`
- [ ] `refreshTokens(refreshToken)`

**Users Service** (3 endpoints):
- [ ] `getCurrentUser()`
- [ ] `updateProfile(username, avatarUrl)`
- [ ] `getUserStats(userId)`

**Habits Service** (6 endpoints):
- [ ] `getHabits()`
- [ ] `createHabit(habitData)`
- [ ] `updateHabit(habitId, updates)`
- [ ] `deleteHabit(habitId)`
- [ ] `logHabitCompletion(habitId, logData)` ⭐ Main gamification trigger
- [ ] `getHabitHistory(habitId, limit)`

**Badges Service** (3 endpoints):
- [ ] `getAllBadges()`
- [ ] `getUserBadges()`
- [ ] `getUserNextBadges()`

**Challenges Service** (5 endpoints):
- [ ] `getActiveChallenges()`
- [ ] `joinChallenge(challengeId)`
- [ ] `getUserActiveChallenges()`
- [ ] `getChallengeLederboard(challengeId)`
- [ ] `leaveChallenge(challengeId)`

**Social Service** (9 endpoints):
- [ ] `getFriendsList()`
- [ ] `getFriendRequests()`
- [ ] `sendFriendRequest(userId)`
- [ ] `acceptFriendRequest(userId)`
- [ ] `declineFriendRequest(userId)`
- [ ] `removeFriend(userId)`
- [ ] `blockUser(userId)`
- [ ] `getGlobalLeaderboard(limit)`
- [ ] `getFriendsLeaderboard()`
- [ ] `getWeeklyLeaderboard()`

**Shop Service** (5 endpoints):
- [ ] `getShopItems(filters)`
- [ ] `getItemsByType(type)`
- [ ] `purchaseItem(itemId)`
- [ ] `getUserInventory()`
- [ ] `getUserPurchases()`

**Notifications Service** (6 endpoints):
- [ ] `getNotifications(unreadOnly, limit)`
- [ ] `getUnreadCount()`
- [ ] `markNotificationAsRead(notificationId)`
- [ ] `markAllAsRead()`
- [ ] `deleteNotification(notificationId)`
- [ ] `deleteAllNotifications()`

---

## 12. UI/UX Components to Build

### 12.1 Reusable Components
- [ ] Navbar (logged-in version with profile, notifications)
- [ ] Sidebar navigation
- [ ] Footer
- [ ] Buttons (primary, secondary, danger variants)
- [ ] Cards (habit card, challenge card, user card)
- [ ] Modals (generic modal wrapper)
- [ ] Forms (input, select, textarea, checkbox)
- [ ] Alerts/Toasts (success, error, warning, info)
- [ ] Loading Spinners
- [ ] Empty State Components
- [ ] Pagination
- [ ] Tabs
- [ ] Dropdowns
- [ ] Search Bar
- [ ] Avatar Image Component

### 12.2 Gamification Components
- [ ] XP Bar (showing progress to next level)
- [ ] Level Badge (large circular display)
- [ ] Streak Counter (with fire icon)
- [ ] Progress Circle (for challenges/habits)
- [ ] Badge Icon (earned/locked state)
- [ ] Reward Toast (showing XP/coins/badge earned)
- [ ] Celebration Animation (confetti on level up or badge)
- [ ] Level Up Modal
- [ ] Badge Unlock Modal
- [ ] Challenge Complete Modal

### 12.3 Habit-Specific Components
- [ ] Habit Card (with progress, difficulty color)
- [ ] Habit Form (create/edit)
- [ ] Log Entry Modal
- [ ] Habit History Table
- [ ] Completion Calendar Heat Map
- [ ] Habit Stats Chart
- [ ] Streak Indicator
- [ ] Next Badge Progress

### 12.4 Gamification Visualizations
- [ ] Line Chart (XP progression, habit completion trend)
- [ ] Bar Chart (weekly XP breakdown)
- [ ] Calendar Heat Map (last 30/90 days completion)
- [ ] Pie Chart (habits by difficulty)
- [ ] Leaderboard Table (sortable, searchable)

---

## 13. State Management Plan

### 13.1 Auth Store
```
State:
- isAuthenticated: boolean
- user: User object
- accessToken: string
- refreshToken: string
- isLoading: boolean
- error: string | null

Actions:
- register()
- login()
- logout()
- refreshToken()
- updateUser()
- clearError()
```

### 13.2 User Store
```
State:
- currentUser: User object
- stats: UserStats object
- isLoading: boolean

Actions:
- fetchCurrentUser()
- updateProfile()
- fetchStats()
```

### 13.3 Habits Store
```
State:
- habits: Habit[]
- selectedHabit: Habit | null
- isLoading: boolean
- filter: 'all' | 'active' | 'completed'

Actions:
- fetchHabits()
- createHabit()
- updateHabit()
- deleteHabit()
- logCompletion()
- setSelectedHabit()
- setFilter()
```

### 13.4 Notification Store
```
State:
- notifications: Notification[]
- unreadCount: number
- isLoading: boolean

Actions:
- fetchNotifications()
- addNotification()
- markAsRead()
- markAllAsRead()
- deleteNotification()
- deleteAllNotifications()
```

---

## 14. Testing Requirements

### 14.1 Unit Tests
- [ ] Auth utility functions (JWT handling, validation)
- [ ] API service functions
- [ ] Store actions
- [ ] Utility functions

### 14.2 Component Tests
- [ ] Auth components (login, register)
- [ ] Dashboard components
- [ ] Form components
- [ ] Habit components
- [ ] Gamification components

### 14.3 Integration Tests
- [ ] Auth flow (register → login → dashboard)
- [ ] Habit logging flow (log habit → update XP → check badge)
- [ ] Challenge join/complete flow
- [ ] Friend request flow

### 14.4 E2E Tests
- [ ] Complete user journey
- [ ] Habit creation and logging
- [ ] Shopping purchase flow
- [ ] Challenge participation

**Test Coverage Goal**: 70%+ coverage

---

## 15. Performance Optimization

### 15.1 Code Splitting
- [ ] Dynamic imports for pages
- [ ] Lazy load components (images, charts)
- [ ] Separate bundles for different routes

### 15.2 Caching Strategy
- [ ] Cache API responses (SWR or React Query)
- [ ] Cache leaderboard data (revalidate every 30s)
- [ ] Cache user stats (revalidate on habit log)
- [ ] Cache badges data (revalidate less frequently)

### 15.3 Image Optimization
- [ ] Next.js Image component for all images
- [ ] WebP format with fallbacks
- [ ] Responsive image sizes

### 15.4 Database/API Optimization
- [ ] Implement pagination
- [ ] Implement search with debouncing
- [ ] Limit initial leaderboard queries

---

## 16. Deployment Checklist

### 16.1 Pre-Deployment
- [ ] Environment variables configured (.env.local)
- [ ] API endpoint URLs updated for production
- [ ] Removed console logs and debug code
- [ ] All tests passing
- [ ] Lighthouse score > 90 on desktop
- [ ] Mobile responsive (tested on devices)
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)

### 16.2 Build Verification
- [ ] `npm run build` completes without errors
- [ ] `npm run start` works locally
- [ ] All routes accessible
- [ ] Authentication redirects working
- [ ] WebSocket connection established

### 16.3 Post-Deployment
- [ ] Monitor error logs
- [ ] Monitor API response times
- [ ] Monitor Socket.io connections
- [ ] Check real-time features working
- [ ] Verify database connectivity
- [ ] Test push notifications (if implementing)

---

## 17. Development Workflow

### 17.1 Development Setup
1. Clone repository
2. Install dependencies: `npm install`
3. Create `.env.local` with backend API URL
4. Start dev server: `npm run dev`
5. Access on `http://localhost:3000`

### 17.2 Development Commands
```bash
npm run dev         # Start dev server with hot reload
npm run build       # Build for production
npm run start       # Start production server
npm run lint        # Run ESLint
npm run format      # Format code with Prettier
npm run test        # Run Jest tests
npm run test:watch  # Run tests in watch mode
npm run test:cov    # Generate coverage report
```

### 17.3 Git Workflow
- Create feature branches: `feature/feature-name`
- Commit messages: "feat/fix/refactor: description"
- Create pull requests for code review
- Merge to main only after approval and tests pass

---

## 18. Documentation to Create

### 18.1 Frontend README.md
- Setup instructions
- Development workflow
- Project structure explanation
- API integration guide
- Environment variables

### 18.2 Component Library
- Document all reusable components
- Show usage examples
- Show prop types
- Storybook setup (optional but recommended)

### 18.3 API Integration Guide
- How to use API service layer
- Error handling approach
- Token refresh strategy
- Real-time socket.io guide

---

## 19. Known Backend Endpoints

All endpoints expect JWT token in `Authorization: Bearer <token>` header.

### Authentication
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
```

### Users
```
GET    /api/users/me
PUT    /api/users/me
GET    /api/users/:id/stats
DELETE /api/users/me
```

### Habits
```
GET    /api/habits
POST   /api/habits
PUT    /api/habits/:id
DELETE /api/habits/:id
POST   /api/habits/:id/log          ← Main gamification trigger
GET    /api/habits/:id/history
```

### Badges
```
GET    /api/badges
GET    /api/badges/user/earned
GET    /api/badges/user/next
```

### Challenges
```
GET    /api/challenges
POST   /api/challenges/:id/join
GET    /api/challenges/user/active
GET    /api/challenges/:id/leaderboard
DELETE /api/challenges/:id/leave
```

### Social
```
GET    /api/friends
GET    /api/friends/requests
POST   /api/friends/send
PUT    /api/friends/:id/accept
PUT    /api/friends/:id/decline
DELETE /api/friends/:id
PUT    /api/friends/:id/block
GET    /api/leaderboards/global
GET    /api/leaderboards/friends
GET    /api/leaderboards/weekly
```

### Shop
```
GET    /api/shop/items
GET    /api/shop/items/type/:type
POST   /api/shop/purchase
GET    /api/shop/user/inventory
GET    /api/shop/user/purchases
```

### Notifications
```
GET    /api/notifications
GET    /api/notifications/unread/count
PUT    /api/notifications/:id/read
PUT    /api/notifications/mark-all/read
DELETE /api/notifications/:id
DELETE /api/notifications
```

---

## 20. Getting Started Next Steps

1. **Review this document** - Understand all required pages and features
2. **Set up Next.js project** - `npx create-next-app@latest smarthabbit-frontend --typescript --tailwind`
3. **Create project structure** - Follow the structure outlined in section 1
4. **Implement auth pages** - Start with register, login, forgot password
5. **Build common components** - Navbar, sidebar, button, card, etc.
6. **Implement dashboard** - Main overview page with all widgets
7. **Build habit features** - CRUD operations and logging
8. **Add gamification** - Badges, leaderboards, challenges
9. **Implement shop** - Item browsing and purchase flow
10. **Add real-time features** - Socket.io integration
11. **Write tests** - Unit and integration tests
12. **Deploy** - Vercel or Docker

---

## 21. Notes for Frontend Developer

✅ **Backend is production-ready** with:
- Complete authentication system (JWT tokens)
- 38 REST API endpoints
- All business logic implemented
- Database migrations ready
- Error handling and validation
- Rate limiting for security

✅ **Frontend has these advantages**:
- No backend work needed
- Just consume the APIs
- Detailed responses with all required data
- WebSocket support for real-time features
- Transaction safety from backend

⚠️ **Implementation Tips**:
1. Use TypeScript for type safety
2. Implement proper error handling in API calls
3. Cache leaderboard data to reduce API calls
4. Use optimistic updates for better UX
5. Test all auth flows thoroughly
6. Mock API in tests for faster test execution

---

**Last Updated**: April 5, 2026
**Status**: Ready for frontend development
**Backend API Status**: ✅ Production ready

