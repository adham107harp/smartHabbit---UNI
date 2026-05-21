/**
 * Seed catalog data: shop items and challenges.
 * Badges are seeded by migration 004 + extended by scripts/seed_badges_v3.ts.
 *
 * Idempotent — safe to re-run.
 *
 *   npm run seed
 *
 * v3: now 10 themes, 10 avatar frames, 10 consumables, 1 badge cosmetic.
 */
import { db } from '../src/config/database';

// ----------------------------------------------------------------------------
// AVATAR FRAMES (10) — each has a `color` (CSS color string or gradient)
// ----------------------------------------------------------------------------
const FRAMES = [
  { name: 'Cosmic Frame',   color: 'purple-gold', cost: 200, description: 'A glowing purple-gold ring.' },
  { name: 'Gold Frame',     color: 'gold',        cost: 250, description: 'A solid gold ring for elite habit builders.' },
  { name: 'Silver Frame',   color: 'silver',      cost: 180, description: 'Subtle silver shine.' },
  { name: 'Bronze Frame',   color: 'bronze',      cost: 120, description: 'Warm bronze for steady players.' },
  { name: 'Neon Frame',     color: 'neon',        cost: 280, description: 'Electric pink + cyan double ring.' },
  { name: 'Royal Frame',    color: 'royal',       cost: 320, description: 'Deep royal purple with white edge.' },
  { name: 'Phoenix Frame',  color: 'phoenix',     cost: 400, description: 'Fiery orange to red gradient.' },
  { name: 'Frost Frame',    color: 'frost',       cost: 220, description: 'Icy blue with a cold shimmer.' },
  { name: 'Galaxy Frame',   color: 'galaxy',      cost: 450, description: 'Deep space gradient with starlight.' },
  { name: 'Crown Frame',    color: 'crown',       cost: 500, description: 'A jewelled crown of glory.' }
];

// ----------------------------------------------------------------------------
// THEMES (10)
// ----------------------------------------------------------------------------
const THEMES = [
  { name: 'Midnight Theme',  palette: 'midnight', cost: 350, description: 'A sleek dark theme with neon accents.' },
  { name: 'Sunrise Theme',   palette: 'sunrise',  cost: 350, description: 'A warm gradient theme to start your day right.' },
  { name: 'Ocean Theme',     palette: 'ocean',    cost: 350, description: 'Cool blues and teals for a calming workspace.' },
  { name: 'Forest Theme',    palette: 'forest',   cost: 350, description: 'Deep greens for a quiet, focused mood.' },
  { name: 'Cherry Theme',    palette: 'cherry',   cost: 350, description: 'Soft pinks with a warm energy.' },
  { name: 'Steel Theme',     palette: 'steel',    cost: 350, description: 'Cold metallic greys, all-business.' },
  { name: 'Lavender Theme',  palette: 'lavender', cost: 400, description: 'Calming purple tones.' },
  { name: 'Inferno Theme',   palette: 'inferno',  cost: 400, description: 'Bold reds and orange for the high-intensity.' },
  { name: 'Aurora Theme',    palette: 'aurora',   cost: 450, description: 'Greens and purples like a northern light show.' },
  { name: 'Mono Theme',      palette: 'mono',     cost: 300, description: 'Pure black-and-white, minimal distractions.' }
];

// ----------------------------------------------------------------------------
// CONSUMABLES (10)
// ----------------------------------------------------------------------------
const CONSUMABLES = [
  { name: 'Streak Shield',      cost: 150, effect: 'streak_protection', extra: { uses: 1 },
    description: 'Protects your streak from one missed day.' },
  { name: 'Streak Shield 3-pack', cost: 400, effect: 'streak_protection', extra: { uses: 3 },
    description: 'Three streak shields. Bulk savings for the cautious.' },
  { name: 'Streak Insurance',   cost: 600, effect: 'streak_protection', extra: { uses: 5 },
    description: 'Five shields. Sleep well no matter what life throws at you.' },
  { name: 'Double XP Boost',    cost: 250, effect: 'xp_boost', extra: { multiplier: 2, duration_hours: 24 },
    description: 'Doubles XP earned for 24 hours.' },
  { name: 'Triple XP 6h',       cost: 320, effect: 'xp_boost', extra: { multiplier: 3, duration_hours: 6 },
    description: 'Triple XP for 6 hours — best for a focused day.' },
  { name: 'XP Surge 4h',        cost: 200, effect: 'xp_boost', extra: { multiplier: 2, duration_hours: 4 },
    description: '2× XP for 4 hours. A quick burst.' },
  { name: 'Mega XP 12h',        cost: 500, effect: 'xp_boost', extra: { multiplier: 4, duration_hours: 12 },
    description: '4× XP for 12 hours. Go all-in.' },
  { name: 'Coin Doubler',       cost: 200, effect: 'coin_boost', extra: { multiplier: 2, duration_hours: 24 },
    description: 'Doubles coins earned for 24 hours.' },
  { name: 'Coin Tripler 6h',    cost: 280, effect: 'coin_boost', extra: { multiplier: 3, duration_hours: 6 },
    description: 'Triple coins for 6 hours.' },
  { name: 'Coin Multiplier 24h', cost: 450, effect: 'coin_boost', extra: { multiplier: 4, duration_hours: 24 },
    description: '4× coins for a full day.' }
];

// ----------------------------------------------------------------------------
// BADGE COSMETICS (15) — purely cosmetic profile flair, bought with coins.
// `icon` is a FontAwesome class the frontend renders verbatim.
// ----------------------------------------------------------------------------
const BADGE_ITEMS = [
  { name: 'Crown Badge',     cost: 500, rarity: 'rare',      icon: 'fa-crown',            description: 'Display royalty on your profile.' },
  { name: 'Heart Badge',     cost: 250, rarity: 'common',    icon: 'fa-heart',            description: 'A warm sign of dedication.' },
  { name: 'Star Badge',      cost: 280, rarity: 'common',    icon: 'fa-star',             description: 'You\'re shining.' },
  { name: 'Lightning Badge', cost: 320, rarity: 'rare',      icon: 'fa-bolt',             description: 'Fast and focused.' },
  { name: 'Diamond Badge',   cost: 600, rarity: 'epic',      icon: 'fa-gem',              description: 'Rare and brilliant.' },
  { name: 'Moon Badge',      cost: 300, rarity: 'common',    icon: 'fa-moon',             description: 'Night-owl energy.' },
  { name: 'Sun Badge',       cost: 300, rarity: 'common',    icon: 'fa-sun',              description: 'Early-bird power.' },
  { name: 'Lotus Badge',     cost: 350, rarity: 'rare',      icon: 'fa-spa',              description: 'Calm focus, every day.' },
  { name: 'Compass Badge',   cost: 350, rarity: 'rare',      icon: 'fa-compass',          description: 'Always on the right path.' },
  { name: 'Anchor Badge',    cost: 380, rarity: 'rare',      icon: 'fa-anchor',           description: 'Steady, unmovable.' },
  { name: 'Phoenix Badge',   cost: 700, rarity: 'legendary', icon: 'fa-fire-flame-curved',description: 'Rise again, every time.' },
  { name: 'Wolf Badge',      cost: 450, rarity: 'epic',      icon: 'fa-paw',              description: 'Lead the pack.' },
  { name: 'Dragon Badge',    cost: 700, rarity: 'legendary', icon: 'fa-dragon',           description: 'Mythic discipline.' },
  { name: 'Owl Badge',       cost: 320, rarity: 'rare',      icon: 'fa-feather',          description: 'Wise and deliberate.' },
  { name: 'Fire Badge',      cost: 280, rarity: 'common',    icon: 'fa-fire',             description: 'Pure streak energy.' }
];

// ----------------------------------------------------------------------------
// CHALLENGES (3, regenerated to start today)
// ----------------------------------------------------------------------------
function challengeFromToday(daysFromNow: number, durationDays: number) {
  const start = new Date();
  start.setDate(start.getDate() + daysFromNow);
  const end = new Date(start);
  end.setDate(end.getDate() + durationDays);
  return { start_date: start.toISOString(), end_date: end.toISOString() };
}

const CHALLENGES = [
  { name: 'Week One Warrior',  description: 'Log any habit every day for a full week.',  target_value: 7,   reward_xp: 200,  reward_coins: 100, ...challengeFromToday(0, 7)  },
  { name: 'Daily Devotion',    description: 'Complete 14 habits in 14 days.',             target_value: 14,  reward_xp: 400,  reward_coins: 200, ...challengeFromToday(0, 14) },
  { name: 'Monthly Marathon',  description: 'Complete 30 habits in 30 days.',             target_value: 30,  reward_xp: 1000, reward_coins: 500, ...challengeFromToday(0, 30) },
  // v5: 15 more
  { name: 'Reading Marathon',  description: 'Log a reading habit on 21 days this month.', target_value: 21,  reward_xp: 500,  reward_coins: 250, ...challengeFromToday(0, 30) },
  { name: 'Fitness Sprint',    description: '14 workouts in 14 days. Push hard.',         target_value: 14,  reward_xp: 600,  reward_coins: 300, ...challengeFromToday(0, 14) },
  { name: 'Mindfulness Month', description: 'Meditate every day for a full month.',       target_value: 30,  reward_xp: 800,  reward_coins: 400, ...challengeFromToday(0, 30) },
  { name: 'Hydration Hero',    description: 'Hit your water target on 10 consecutive days.', target_value: 10, reward_xp: 250, reward_coins: 150, ...challengeFromToday(0, 14) },
  { name: 'Early Bird',        description: 'Log at least one habit before 9 AM, 7 days.', target_value: 7,   reward_xp: 300,  reward_coins: 150, ...challengeFromToday(0, 14) },
  { name: 'Night Owl',         description: 'Log at least one habit after 8 PM, 7 days.',  target_value: 7,   reward_xp: 300,  reward_coins: 150, ...challengeFromToday(0, 14) },
  { name: 'Social Saturday',   description: 'Add 3 friends this week.',                    target_value: 3,   reward_xp: 200,  reward_coins: 100, ...challengeFromToday(0, 7)  },
  { name: 'Productive Monday', description: 'Log 5 habits on a single Monday.',            target_value: 5,   reward_xp: 250,  reward_coins: 125, ...challengeFromToday(0, 7)  },
  { name: 'Recovery Sunday',   description: 'Hit ALL daily habits on Sunday for 4 weeks.', target_value: 4,   reward_xp: 500,  reward_coins: 250, ...challengeFromToday(0, 30) },
  { name: 'Habit Stacker',     description: 'Create 3 new habits this week.',              target_value: 3,   reward_xp: 250,  reward_coins: 150, ...challengeFromToday(0, 7)  },
  { name: 'Streak Reignite',   description: 'Recover from a missed day and rebuild a 7-day streak.', target_value: 7, reward_xp: 350, reward_coins: 175, ...challengeFromToday(0, 14) },
  { name: 'Comeback King',     description: 'Log 20 habits after a week off.',             target_value: 20,  reward_xp: 500,  reward_coins: 250, ...challengeFromToday(0, 30) },
  { name: 'Variety Pack',      description: 'Log at least one of every difficulty (easy, medium, hard).', target_value: 3, reward_xp: 300, reward_coins: 150, ...challengeFromToday(0, 14) },
  { name: 'Iron Will',         description: 'Hit every habit for 21 straight days.',       target_value: 21,  reward_xp: 1200, reward_coins: 600, ...challengeFromToday(0, 30) },
  { name: '100-Day Challenge', description: 'A 100-completion marathon. For the bold.',    target_value: 100, reward_xp: 3000, reward_coins: 1500, ...challengeFromToday(0, 100) },
  { name: 'Weekend Warrior',   description: 'Log on every Saturday and Sunday for a month.', target_value: 8,  reward_xp: 400,  reward_coins: 200, ...challengeFromToday(0, 30) }
];

// ----------------------------------------------------------------------------

async function upsertShopItem(item: {
  name: string;
  description: string;
  cost: number;
  item_type: string;
  meta_data: Record<string, any>;
}): Promise<void> {
  const existing = await db.queryOne(
    'SELECT id FROM reward_shop WHERE name = $1',
    [item.name]
  );
  if (existing) {
    await db.query(
      `UPDATE reward_shop
         SET description = $2, cost = $3, item_type = $4, meta_data = $5, is_available = true
        WHERE id = $1`,
      [existing.id, item.description, item.cost, item.item_type, item.meta_data]
    );
  } else {
    await db.query(
      `INSERT INTO reward_shop (name, description, cost, item_type, meta_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [item.name, item.description, item.cost, item.item_type, item.meta_data]
    );
  }
}

async function seed(): Promise<void> {
  console.log('Seeding catalog data...');
  await db.connect();

  for (const f of FRAMES) {
    await upsertShopItem({
      name: f.name, description: f.description, cost: f.cost,
      item_type: 'avatar_item',
      meta_data: { color: f.color }
    });
  }
  console.log(`  ✓ ${FRAMES.length} avatar frames`);

  for (const t of THEMES) {
    await upsertShopItem({
      name: t.name, description: t.description, cost: t.cost,
      item_type: 'theme',
      meta_data: { palette: t.palette }
    });
  }
  console.log(`  ✓ ${THEMES.length} themes`);

  for (const c of CONSUMABLES) {
    await upsertShopItem({
      name: c.name, description: c.description, cost: c.cost,
      item_type: 'consumable',
      meta_data: { effect: c.effect, ...c.extra }
    });
  }
  console.log(`  ✓ ${CONSUMABLES.length} consumables`);

  for (const b of BADGE_ITEMS) {
    await upsertShopItem({
      name: b.name, description: b.description, cost: b.cost,
      item_type: 'badge',
      meta_data: { rarity: b.rarity, icon: b.icon }
    });
  }
  console.log(`  ✓ ${BADGE_ITEMS.length} badge cosmetics`);

  for (const c of CHALLENGES) {
    const existing = await db.queryOne('SELECT id FROM challenges WHERE name = $1', [c.name]);
    if (existing) {
      await db.query(
        `UPDATE challenges
           SET description = $2, start_date = $3, end_date = $4,
               target_value = $5, reward_xp = $6, reward_coins = $7, is_active = true
         WHERE id = $1`,
        [existing.id, c.description, c.start_date, c.end_date, c.target_value, c.reward_xp, c.reward_coins]
      );
    } else {
      await db.query(
        `INSERT INTO challenges (name, description, start_date, end_date, target_value, reward_xp, reward_coins)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [c.name, c.description, c.start_date, c.end_date, c.target_value, c.reward_xp, c.reward_coins]
      );
    }
  }
  console.log(`  ✓ ${CHALLENGES.length} challenges`);

  await db.disconnect();
  console.log('Seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
