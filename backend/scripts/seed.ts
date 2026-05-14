/**
 * Seed catalog data: shop items and challenges.
 * Badges are seeded by migration 004. Idempotent — safe to re-run.
 *
 *   npm run seed
 */
import { db } from '../src/config/database';

const SHOP_ITEMS = [
  {
    name: 'Cosmic Avatar Frame',
    description: 'A glowing purple-gold frame for your profile picture.',
    cost: 200,
    item_type: 'avatar_item',
    meta_data: { color: 'purple-gold' }
  },
  {
    name: 'Midnight Theme',
    description: 'A sleek dark theme with neon accents.',
    cost: 350,
    item_type: 'theme',
    meta_data: { palette: 'midnight' }
  },
  {
    name: 'Sunrise Theme',
    description: 'A warm gradient theme to start your day right.',
    cost: 350,
    item_type: 'theme',
    meta_data: { palette: 'sunrise' }
  },
  {
    name: 'Streak Shield',
    description: 'Protects your streak from one missed day.',
    cost: 150,
    item_type: 'consumable',
    meta_data: { effect: 'streak_protection', uses: 1 }
  },
  {
    name: 'Double XP Boost',
    description: 'Doubles XP earned from habits for 24 hours.',
    cost: 250,
    item_type: 'consumable',
    meta_data: { effect: 'xp_boost', multiplier: 2, duration_hours: 24 }
  },
  {
    name: 'Coin Doubler',
    description: 'Doubles coins earned from habits for 24 hours.',
    cost: 200,
    item_type: 'consumable',
    meta_data: { effect: 'coin_boost', multiplier: 2, duration_hours: 24 }
  },
  {
    name: 'Ocean Theme',
    description: 'Cool blues and teals for a calming workspace.',
    cost: 350,
    item_type: 'theme',
    meta_data: { palette: 'ocean' }
  },
  {
    name: 'Crown Badge',
    description: 'Display royalty on your profile.',
    cost: 500,
    item_type: 'badge',
    meta_data: { rarity: 'rare' }
  }
];

function challengeFromToday(daysFromNow: number, durationDays: number) {
  const start = new Date();
  start.setDate(start.getDate() + daysFromNow);
  const end = new Date(start);
  end.setDate(end.getDate() + durationDays);
  return { start_date: start.toISOString(), end_date: end.toISOString() };
}

const CHALLENGES = [
  {
    name: 'Week One Warrior',
    description: 'Log any habit every day for a full week.',
    target_value: 7,
    reward_xp: 200,
    reward_coins: 100,
    ...challengeFromToday(0, 7)
  },
  {
    name: 'Daily Devotion',
    description: 'Complete 14 habits in 14 days.',
    target_value: 14,
    reward_xp: 400,
    reward_coins: 200,
    ...challengeFromToday(0, 14)
  },
  {
    name: 'Monthly Marathon',
    description: 'Complete 30 habits in 30 days.',
    target_value: 30,
    reward_xp: 1000,
    reward_coins: 500,
    ...challengeFromToday(0, 30)
  }
];

async function seed(): Promise<void> {
  console.log('Seeding catalog data...');
  await db.connect();

  // Shop items — upsert by name
  for (const item of SHOP_ITEMS) {
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
  console.log(`  ✓ ${SHOP_ITEMS.length} shop items`);

  // Challenges — upsert by name
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
