# SmartHabbit Purchase System - Detailed Explanation

## Overview

The Purchase System is the economy mechanism in SmartHabbit that allows users to earn **coins** through gamification activities and spend them on cosmetic items and power-ups in the shop. This document explains how the entire system works.

---

## 1. Core Concepts

### 1.1 What are Coins?

**Coins** are the in-game currency earned by:
- Completing habits (base amount: 5 coins per completion)
- Earning badges (bonus coins, typically 10-50 coins per badge)
- Leveling up (100 coins bonus when reaching new level)
- Winning challenges (varies by challenge, typically 50-200 coins)

**Coins CANNOT be purchased with real money** - They must be earned through gameplay. This ensures fair play and keeps the game non-pay-to-win.

### 1.2 What are Items?

**Items** exist in the shop and can be purchased with coins. There are 4 types:

1. **Avatar Items** (Cosmetic)
   - Profile picture frames, accessories, emotes
   - Cost: 100-500 coins
   - Purpose: Customize your profile appearance
   - Status: Once purchased, applied to profile

2. **Themes** (Cosmetic)
   - Dark mode, light mode, custom color schemes
   - Cost: 200-300 coins
   - Purpose: Change app appearance for the user
   - Status: Once purchased, can be toggled on/off

3. **Badges** (Cosmetic/Progression)
   - Special badge frames, animations, effects
   - Cost: 150-400 coins
   - Purpose: Decorate earned badges with visual enhancements
   - Status: Once purchased, applied to badges display

4. **Consumables** (Functional)
   - Streak Saver: Prevents loss of streak on missed day (cost: 250 coins)
   - XP Booster: Double XP for 24 hours (cost: 300 coins)
   - Mystery Box: Random coin reward 50-500 (cost: 100 coins)
   - Purpose: Provide temporary gameplay advantage
   - Status: Consumed (removed from inventory) when used

---

## 2. Purchase System Architecture

### 2.1 Database Tables Involved

#### `reward_shop` Table
Stores all available items in the shop:

```
id (UUID)                  - Unique item identifier
name (string)              - Item display name, e.g., "Dark Mode Theme"
description (string)       - Item description, e.g., "Apply a dark theme"
cost (integer)             - Cost in coins (100-500 typical range)
item_type (enum)           - One of: avatar_item, theme, badge, consumable
meta_data (JSON)           - Extra data per item type
is_available (boolean)     - Whether item can be purchased (soft delete)
created_at (timestamp)     - When item was added to shop
updated_at (timestamp)     - Last update
```

**Example `meta_data` JSON structures**:

Avatar Item:
```json
{
  "image_url": "https://cdn.smarthabbit.com/avatars/frame_gold.png",
  "category": "frames",
  "rarity": "rare"
}
```

Theme:
```json
{
  "color_scheme": "dark",
  "primary_color": "#1a1a1a",
  "secondary_color": "#ffffff",
  "accent_color": "#4f46e5"
}
```

Badge:
```json
{
  "animation_type": "glow",
  "effect_color": "#fbbf24"
}
```

Consumable:
```json
{
  "effect_type": "xp_multiplier",
  "multiplier": 2,
  "duration_hours": 24
}
```

#### `purchases` Table
Complete record of every transaction:

```
id (UUID)                  - Unique purchase record
user_id (UUID, FK)         - Which user made the purchase
item_id (UUID, FK)         - Which item was purchased
cost_paid (integer)        - Coins spent (historical record, may differ from current item cost)
quantity (integer)         - How many purchased (1 for cosmetics, 1 for consumables)
purchase_date (timestamp)  - When purchase occurred
status (enum)              - purchased, consumed, refunded
metadata (JSON)            - Additional info (discount code, promotion, etc.)
created_at (timestamp)
```

**Why `cost_paid`?** This is important for record-keeping. If an item's cost changes in the future, we still know what the user originally paid.

### 2.2 User Inventory System

The inventory is calculated dynamically:
- **Owned Items**: User purchased cosmetic items (theme, avatar, badge) that are not consumed
- **Inventory**: All non-consumed items + consumables ready to use
- **Purchase History**: All past transactions

The system does NOT have a separate "inventory" table. Instead:
- For cosmetics: Query `purchases WHERE user_id=X AND item_type IN (avatar_item, theme, badge) AND status='purchased'`
- For consumables: Query `purchases WHERE user_id=X AND item_type='consumable' AND status='purchased'`

---

## 3. Purchase Flow - Step by Step

### 3.1 Frontend User Experience

#### Step 1: Browse Shop
```
User opens /shop page
↓
Frontend calls GET /api/shop/items
↓
Backend returns ALL items with:
- id, name, description, cost, item_type, meta_data, is_available
↓
Frontend displays item cards:
  - Item image/icon
  - Name and description
  - Cost in coins
  - "Purchase" button (enabled/disabled based on user's coin balance)
  - "Already Owned" badge (if user already purchased this cosmetic)
```

#### Step 2: Initiate Purchase
```
User clicks "Purchase" button on an item
↓
Frontend shows confirmation modal:
  "Spend 250 coins for Streak Saver?"
  [Cancel] [Confirm]
```

#### Step 3: Submit Purchase Request
```
User clicks "Confirm"
↓
Frontend calls POST /api/shop/purchase
  {
    "item_id": "uuid-of-item"
  }
```

#### Step 4: Backend Processing (ATOMIC TRANSACTION)
```
Backend receives purchase request
↓
Transaction begins:
  1. Get current user's coin balance (SELECT coins FROM users WHERE id=user_id)
  2. Get item details (SELECT cost FROM reward_shop WHERE id=item_id)
  3. Verify user has enough coins
     IF NO: Return error "Insufficient coins"
  4. Deduct coins from user (UPDATE users SET coins = coins - cost)
  5. Record purchase (INSERT INTO purchases) with status='purchased'
  6. IF consumable: No inventory table change (consumable added to purchases)
  7. IF cosmetic: Item automatically "owned" (queried from purchases)
  8. Create notification (Happy purchase!)
Transaction commits
↓
Return success response with:
  - Remaining coin balance
  - New item details
  - Remaining coins for display
```

#### Step 5: Frontend Response
```
Backend returns HTTP 200 with success
↓
Frontend shows success toast:
  "🎉 Purchased! Spent 250 coins"
  "New balance: 750 coins"
↓
Update user's coin display
↓
Add item to owned items list (if cosmetic)
OR
Add to consumables list (if consumable)
↓
Modal closes
```

### 3.2 Backend Transaction Safety

This is **ATOMIC** - all or nothing:

```
If ANY step fails, ROLLBACK everything:
- Coins NOT deducted
- Purchase NOT recorded
- User back to original balance
- Error returned to frontend
```

**Why atomic?** Prevents situations like:
- User gets item but isn't charged
- User is charged but doesn't get item
- Double purchases
- Race conditions with concurrent requests

---

## 4. Item Type-Specific Behavior

### 4.1 Avatar Items & Themes (Cosmetic)

**Purchase Flow**:
1. User buys frame for 300 coins
2. Purchase recorded with status='purchased'
3. When user views `/shop/inventory`, item appears in owned items
4. User can select an avatar theme to "apply" to their profile
5. Applied theme affects how profile appears to other users

**Storage**:
```
- Cosmetic items NOT stored in separate inventory
- "Owned items" = filtering purchases table
  SELECT * FROM purchases 
  WHERE user_id=X AND item_type='avatar_item' AND status='purchased'
- Multiple cosmetics of same type can be owned
  (E.g., user can own 5 different avatar frames)
```

**Application**:
```
When user selects a theme:
- Updated user.avatar_item_id or user.active_theme
- No coins spent again
- Information for profile display
```

### 4.2 Consumables (Functional Items)

**Purchase Flow**:
1. User buys "XP Booster" for 300 coins
2. Purchase recorded with status='purchased'
3. Item appears in inventory ready to use
4. User clicks "Use" button
5. Backend processes:
   - Apply booster effect (2x XP for 24 hours)
   - Update users.xp_multiplier_until = NOW() + 24 hours
   - Update purchase status to 'consumed'
6. Item disappears from inventory

**Storage**:
```
Before use:
  SELECT * FROM purchases 
  WHERE user_id=X AND status='purchased' AND item_type='consumable'
  → Item shows in inventory

After use:
  UPDATE purchases SET status='consumed'
  → Item removed from inventory
  → Cannot be used again
```

**Effect Application**:
```
When calculating habit completion reward:

// Get user
SELECT coins, xp, xp_multiplier_until FROM users WHERE id=X

// Calculate XP reward
base_xp = 10 (easy) * streak_multiplier
IF NOW() < xp_multiplier_until:
  base_xp = base_xp * 2  // 2x multiplier
coins_reward = 5

// Save
UPDATE users SET 
  xp = xp + base_xp,
  coins = coins + coins_reward
```

---

## 5. Why Purchases Work This Way

### 5.1 Security Considerations

**Why we use atomic transactions:**
- Prevents exploits where someone intercepts mid-transaction
- Prevents database inconsistencies
- Ensures user experience is reliable

**Why we record `cost_paid`:**
- Item prices might change in future
- We always know what user actually paid
- Useful for auditing and refund scenarios

**Why coins can't be purchased:**
- Keeps game fair and non-pay-to-win
- Prevents rich users from dominating leaderboards
- Encourages actual gameplay engagement

### 5.2 Design Philosophy

**User Empowerment**:
- Cosmetics are optional (no gameplay advantage)
- Consumables are optional (alternate path to progress)
- Can earn everything through diligent gameplay

**Engagement Loop**:
```
Complete Habit → Earn Coins → Save for Item → Buy Item → Feels Rewarded
```

**Economy Balance**:
- Items cost enough to require saving (5-30 habit completions)
- But achievable with consistent gameplay
- Consumables provide shortcut, but aren't required

---

## 6. Key Edge Cases & Error Handling

### 6.1 Insufficient Funds
```
User has 100 coins, tries to buy item for 250 coins

Backend:
  1. Checks: 100 < 250 → TRUE
  2. Returns: HTTP 400 Bad Request
  3. Response: {
       "error": "Insufficient coins",
       "required": 250,
       "available": 100,
       "shortfall": 150
     }

Frontend:
  - Shows error toast
  - Highlights "Need 150 more coins"
  - Suggests: Complete 30 more habits to earn 150 coins
```

### 6.2 Item No Longer Available
```
Admin removes an item from shop (is_available = false)
User tries to purchase it

Backend:
  1. Checks: is_available = false → Item not found
  2. Returns: HTTP 404 Not Found
  3. Response: {
       "error": "Item not available"
     }

Frontend:
  - Shows error
  - Item removed from shop display
```

### 6.3 Concurrent Purchases (Race Condition)
```
Scenario: User gets one coin from habit completion while shopping
Request 1 (Habit log):    Adds 5 coins (balance was 99, now 104)
Request 2 (Purchase):     Deducts 250 coins (expects 104, needs 250)

Safety: Database constraints prevent issues:
  - Coins column: integer NOT NULL DEFAULT 0
  - Constraint: coins >= 0
  - Transaction isolation: READ COMMITTED

Result:
  - Both requests processed sequentially
  - If purchase comes first: Fails (insufficient funds)
  - If habit first: Succeeds (now have 104, need 104+)
```

### 6.4 Double Purchase Prevention
```
Frontend sends purchase request twice (accidental double-click)

Frontend protection:
  - Button disabled during request
  - Request being processed state
  - Only one request sent

Backend protection:
  - Each purchase gets unique transaction
  - If user sends 2 requests:
    Request 1: Success, balance goes 250 → 0
    Request 2: Fails, insufficient funds
```

### 6.5 Consumable Already Used
```
User tries to "use" a consumable twice

Backend stores status='consumed' after first use

Subsequent attempts:
  1. Item not in inventory (only status='purchased' shown)
  2. If user somehow sends request with same purchase_id
  3. Backend checks: status='consumed' → Already used
  4. Returns error: "This item has already been used"
```

---

## 7. Frontend Integration Points

### 7.1 Shop Page Integration

```
Display Section:
  - Show user's current coin balance (get from /api/users/me)
  - Display item grid from /api/shop/items
  - Each item card shows:
    * Is button enabled? = (user.coins >= item.cost)
    * Item owned? = Check if in user's purchases
    * Item already used (consumable)? = Check purchase status

User Actions:
  Click "Purchase" → POST /api/shop/purchase
  Handle response → Update coin balance
  Update item cards → Recalculate enabled/disabled states
```

### 7.2 Inventory Page Integration

```
Display Section 1 - Owned Cosmetics:
  GET /api/shop/user/inventory → List purchased cosmetics
  Show:
    - Avatar frame currently applied (highlighted)
    - Theme currently applied (highlighted)
    - All other owned cosmetics with "Apply" button

Display Section 2 - Consumables Ready:
  GET /api/shop/user/inventory → Filter for status='purchased' consumables
  Show:
    - Each consumable with "Use" button
    - Expired consumables grayed out
    - Activated consumables show expiry time

User Actions:
  - "Apply Theme" → Update user profile
  - "Use Booster" → POST /api/shop/purchase/{id}/use
```

### 7.3 Profile/Dashboard Integration

**Show Active Effects**:
```
If user has xp_multiplier_until > NOW():
  Display banner: "⚡ 2x XP Active for 18 hours"
  Display timer: Countdown to expiration
```

**Show Applied Cosmetics**:
```
When rendering another user's profile:
  - Fetch user stats
  - Get their applied avatar_item_id and theme_id
  - Render profile with their customizations
```

### 7.4 Habit Logging Integration

```
When user logs habit completion:

Frontend calls POST /api/habits/:id/log
Backend returns:
  {
    xp_earned: 20,
    coins_earned: 5,
    multipliers: {
      streak: 1.5,          // 7+ day streak
      xp_booster: 2,        // Active consumable
      challenge: 1.2        // Challenge active
    },
    new_level: false,
    new_badges: [],
    required_xp: 525
  }

Frontend displays reward:
  "🎉 +20 XP (1.5x streak × 2x booster)"
  "💰 +5 coins"
```

---

## 8. Shop Administration

### 8.1 Adding New Items (Backend Admin)

Admin needs to:
1. Insert row into `reward_shop` table:
   ```
   INSERT INTO reward_shop (name, description, cost, item_type, meta_data, is_available)
   VALUES (
     'Premium Dark Theme',
     'Advanced dark mode with custom colors',
     300,
     'theme',
     '{"color_scheme": "dark", ...}',
     true
   )
   ```

2. Item immediately available in shop
3. All users can see and purchase

### 8.2 Pricing Strategy

**Current Recommended Prices**:
- Avatar Items: 150-500 coins
- Themes: 200-300 coins
- Badge Decorations: 100-400 coins
- Consumables:
  - XP Booster (2x, 24h): 300 coins
  - Streak Saver: 250 coins
  - Mystery Box: 100 coins

**Pricing Logic**:
- Items that provide gameplay advantage cost more
- Cosmetics can be cheaper (no advantage)
- Consumables balance: Cost vs. benefit
  - Example: 2x XP for 24h vs. completing 6 habits manually

### 8.3 Removing Items (Soft Delete)

Instead of deleting from database:
```
UPDATE reward_shop SET is_available = false WHERE id = 'item_id'
```

Benefits:
- Purchase history preserved
- Users who own item can still use it
- No database inconsistencies
- Can re-enable later if needed

---

## 9. Analytics & Monitoring

### 9.1 Key Metrics to Track

**Purchase Analytics**:
- Total purchases per day
- Revenue (coins spent) per day
- Most popular items
- Items that sell vs. don't sell

**User Behavior**:
- % of users who make any purchase
- Average coins spent per user
- Time from earning coins to spending
- Which item types are most purchased

**Coin Drops**:
- Total coins distributed (from habits, badges, challenges)
- Total coins spent (shop purchases)
- Average coin balance per user
- Economy health

### 9.2 Queries for Analysis

```sql
-- Total purchases per day
SELECT DATE(purchase_date), COUNT(*), SUM(cost_paid)
FROM purchases
GROUP BY DATE(purchase_date)

-- Most popular items
SELECT item_id, COUNT(*) as purchase_count
FROM purchases
WHERE status='purchased'
GROUP BY item_id
ORDER BY purchase_count DESC

-- User spending patterns
SELECT user_id, COUNT(*) as total_purchases, SUM(cost_paid) as total_spent
FROM purchases
GROUP BY user_id
ORDER BY total_spent DESC
```

---

## 10. Future Enhancement Ideas

### 10.1 Possible Additions

**Rarity Tiers**:
- Common, Rare, Epic, Legendary items
- Legendary items cost more but have special effects
- Drop rates for mystery box based on rarity

**Trading System**:
- Allow users to trade cosmetic items (if both agree)
- Requires escrow/transaction handling

**Seasonal Items**:
- Limited-time shop items
- Holiday-themed cosmetics
- FOMO-driven purchases

**Booster Bundles**:
- Buy 3 XP Boosters at discount
- Seasonal bundles with mixed items

**Gifting System**:
- Buy item as gift for friend
- Friend notification: "X sent you a gift!"
- Use coins to gift other users

**Auction House**:
- Users list owned cosmetics for sale
- Other users can bid coins
- Platform takes small fee (10% of sale)

---

## 11. Technical Summary

### 11.1 Database Design Benefits

| Aspect | Design Choice | Reason |
|--------|---------------|--------|
| Atomic Transactions | USE (Coins + Purchase in same TX) | Prevents data inconsistency |
| Soft Deletes | Items marked is_available=false | Preserve purchase history |
| Purchase Records | Never deleted, just marked consumed | Audit trail, revenue tracking |
| Meta Data as JSON | Flexible, extensible | Easy to add item-type specific data |
| Cost Paid | Always record actual amount | Historical accuracy |

### 11.2 API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/shop/items` | GET | Browse all items |
| `/api/shop/items/type/:type` | GET | Filter by type |
| `/api/shop/purchase` | POST | Buy item (main transaction) |
| `/api/shop/user/inventory` | GET | View owned/consumable items |
| `/api/shop/user/purchases` | GET | Full purchase history |

### 11.3 User Experience Flow

```
Shop Page:
  Browse → See prices → Check balance → Buy → Inventory

Inventory:
  Cosmetics → Apply → Profile updated
  Consumables → Use → Effect active

Habit Logging:
  Complete → See multiplier active → Get bonus XP
  See coins earned → Accumulate → Buy more items
```

---

## 12. Common Questions & Answers

### Q: Can items be refunded?
**A**: Currently no refund system. Could be added as feature if needed. Would require:
- Admin approval
- Reversal transaction
- Update purchase status to 'refunded'
- Return coins to user

### Q: Can user earn coins without spending?
**A**: Yes! Coins are purely optional for cosmetics. Gameplay fully functional without purchases.

### Q: What if admin wants to reset a user's coins?
**A**: Could add admin endpoint:
```
PUT /api/admin/users/:id/coins
{
  "amount": 1000
}
```

### Q: How many cosmetics can user own?
**A**: Unlimited. Just stops showing more in inventory after scrolling,  but all are stored.

### Q: What if item runs out of stock?
**A**: No stock limit. Items are digital. Admin just marks `is_available=false`.

### Q: Can users see other users' inventories?
**A**: Not yet. Could be feature to show off cosmetics. Frontend would call:
```
GET /api/shop/user/:userId/inventory (public view)
→ Show applied cosmetics only, not all owned
```

---

## Conclusion

The purchase system is designed to be:
- **Fair**: No pay-to-win, only through gameplay
- **Safe**: Atomic transactions prevent exploits
- **Extensible**: Easy to add new items and types
- **Transparent**: Clear pricing and costs
- **Rewarding**: Makes earning feel valuable

The system complements the gamification system perfectly:
- Earn coins → Buy cosmetics → Feel rewarded → Stay engaged → Complete more habits → Earn more coins

---

**Last Updated**: April 6, 2026
**System Status**: Production Ready ✅

