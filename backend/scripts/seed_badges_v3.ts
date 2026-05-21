/**
 * Seed 40 additional badges (on top of the 10 from migration 004 = 50 total).
 * Idempotent — uses ON CONFLICT (name).
 *
 *   npm run seed:badges
 */
import { db } from '../src/config/database';

interface Badge {
  name: string;
  description: string;
  criteria_type: 'streak' | 'total_xp' | 'completions' | 'level' | 'challenges_completed';
  criteria_value: number;
  bonus_xp?: number;
  bonus_coins?: number;
}

const NEW_BADGES: Badge[] = [
  // ---- Streak (7 new) -----------------------------------------------------
  { name: '2-Week Hero',     description: 'Maintain a 14-day streak.',  criteria_type: 'streak', criteria_value: 14,  bonus_xp: 30 },
  { name: '3-Week Hero',     description: 'Maintain a 21-day streak.',  criteria_type: 'streak', criteria_value: 21,  bonus_xp: 50 },
  { name: 'Half Centurion',  description: 'Maintain a 50-day streak.',  criteria_type: 'streak', criteria_value: 50,  bonus_xp: 100, bonus_coins: 30 },
  { name: '60-Day Master',   description: 'Maintain a 60-day streak.',  criteria_type: 'streak', criteria_value: 60,  bonus_xp: 120, bonus_coins: 40 },
  { name: 'Quarter Year',    description: 'Maintain a 90-day streak.',  criteria_type: 'streak', criteria_value: 90,  bonus_xp: 200, bonus_coins: 60 },
  { name: 'Half Year Hero',  description: 'Maintain a 180-day streak.', criteria_type: 'streak', criteria_value: 180, bonus_xp: 400, bonus_coins: 100 },
  { name: '9-Month Saint',   description: 'Maintain a 270-day streak.', criteria_type: 'streak', criteria_value: 270, bonus_xp: 600, bonus_coins: 150 },

  // ---- Total XP (7 new) ---------------------------------------------------
  { name: '250 XP',          description: 'Earn 250 total XP.',         criteria_type: 'total_xp', criteria_value: 250,    bonus_coins: 10 },
  { name: '500 XP',          description: 'Earn 500 total XP.',         criteria_type: 'total_xp', criteria_value: 500,    bonus_coins: 20 },
  { name: '2K XP',           description: 'Earn 2,000 total XP.',       criteria_type: 'total_xp', criteria_value: 2000,   bonus_coins: 50 },
  { name: '5K XP',           description: 'Earn 5,000 total XP.',       criteria_type: 'total_xp', criteria_value: 5000,   bonus_coins: 100 },
  { name: '25K XP',          description: 'Earn 25,000 total XP.',      criteria_type: 'total_xp', criteria_value: 25000,  bonus_coins: 250 },
  { name: '50K XP',          description: 'Earn 50,000 total XP.',      criteria_type: 'total_xp', criteria_value: 50000,  bonus_coins: 500 },
  { name: '100K XP',         description: 'Earn 100,000 total XP.',     criteria_type: 'total_xp', criteria_value: 100000, bonus_coins: 1000 },

  // ---- Completions (8 new) ------------------------------------------------
  { name: '10 Logs',         description: 'Log 10 habit completions.',  criteria_type: 'completions', criteria_value: 10,  bonus_xp: 20 },
  { name: '25 Logs',         description: 'Log 25 habit completions.',  criteria_type: 'completions', criteria_value: 25,  bonus_xp: 40 },
  { name: '75 Logs',         description: 'Log 75 habit completions.',  criteria_type: 'completions', criteria_value: 75,  bonus_xp: 80 },
  { name: '100 Logs',        description: 'Log 100 habit completions.', criteria_type: 'completions', criteria_value: 100, bonus_xp: 120, bonus_coins: 25 },
  { name: '200 Logs',        description: 'Log 200 habit completions.', criteria_type: 'completions', criteria_value: 200, bonus_xp: 200, bonus_coins: 50 },
  { name: '300 Logs',        description: 'Log 300 habit completions.', criteria_type: 'completions', criteria_value: 300, bonus_xp: 300, bonus_coins: 75 },
  { name: '750 Logs',        description: 'Log 750 habit completions.', criteria_type: 'completions', criteria_value: 750, bonus_xp: 500, bonus_coins: 150 },
  { name: '1000 Logs',       description: 'Log 1,000 habit completions.', criteria_type: 'completions', criteria_value: 1000, bonus_xp: 750, bonus_coins: 250 },

  // ---- Level (8 new) ------------------------------------------------------
  { name: 'Level 5',         description: 'Reach level 5.',             criteria_type: 'level', criteria_value: 5,  bonus_coins: 20 },
  { name: 'Level 10',        description: 'Reach level 10.',            criteria_type: 'level', criteria_value: 10, bonus_coins: 50 },
  { name: 'Level 15',        description: 'Reach level 15.',            criteria_type: 'level', criteria_value: 15, bonus_coins: 75 },
  { name: 'Level 20',        description: 'Reach level 20.',            criteria_type: 'level', criteria_value: 20, bonus_coins: 100 },
  { name: 'Level 25',        description: 'Reach level 25.',            criteria_type: 'level', criteria_value: 25, bonus_coins: 150 },
  { name: 'Level 30',        description: 'Reach level 30.',            criteria_type: 'level', criteria_value: 30, bonus_coins: 200 },
  { name: 'Level 40',        description: 'Reach level 40.',            criteria_type: 'level', criteria_value: 40, bonus_coins: 300 },
  { name: 'Level 50',        description: 'Reach the elite level 50.',  criteria_type: 'level', criteria_value: 50, bonus_coins: 500 },

  // ---- Challenges completed (5 new) --------------------------------------
  { name: 'First Challenge',   description: 'Complete your first challenge.',  criteria_type: 'challenges_completed', criteria_value: 1,  bonus_xp: 50,   bonus_coins: 20 },
  { name: 'Challenge Trio',    description: 'Complete 3 challenges.',          criteria_type: 'challenges_completed', criteria_value: 3,  bonus_xp: 150,  bonus_coins: 60 },
  { name: 'Challenge Hand',    description: 'Complete 5 challenges.',          criteria_type: 'challenges_completed', criteria_value: 5,  bonus_xp: 300,  bonus_coins: 120 },
  { name: 'Challenge Pro',     description: 'Complete 10 challenges.',         criteria_type: 'challenges_completed', criteria_value: 10, bonus_xp: 600,  bonus_coins: 250 },
  { name: 'Challenge Legend',  description: 'Complete 25 challenges.',         criteria_type: 'challenges_completed', criteria_value: 25, bonus_xp: 1500, bonus_coins: 600 },

  // ---- Filler tier (5 new) — rounds total to 50 ---------------------------
  { name: 'Sprint Starter',    description: 'Maintain a 3-day streak.',        criteria_type: 'streak',               criteria_value: 3,    bonus_xp: 15 },
  { name: 'Daily Dabbler',     description: 'Log 5 habit completions.',         criteria_type: 'completions',          criteria_value: 5,    bonus_xp: 10 },
  { name: 'Level 2',           description: 'Reach level 2.',                   criteria_type: 'level',                criteria_value: 2,    bonus_coins: 5 },
  { name: 'Level 3',           description: 'Reach level 3.',                   criteria_type: 'level',                criteria_value: 3,    bonus_coins: 10 },
  { name: 'Level 75',          description: 'Reach the legendary level 75.',    criteria_type: 'level',                criteria_value: 75,   bonus_coins: 1000, bonus_xp: 2000 }
];

async function seed(): Promise<void> {
  console.log('Seeding v3 badges…');
  await db.connect();

  for (const b of NEW_BADGES) {
    await db.query(
      `INSERT INTO badges (name, description, criteria_type, criteria_value, bonus_xp, bonus_coins)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (name) DO UPDATE
         SET description    = EXCLUDED.description,
             criteria_type  = EXCLUDED.criteria_type,
             criteria_value = EXCLUDED.criteria_value,
             bonus_xp       = EXCLUDED.bonus_xp,
             bonus_coins    = EXCLUDED.bonus_coins`,
      [b.name, b.description, b.criteria_type, b.criteria_value, b.bonus_xp ?? 0, b.bonus_coins ?? 0]
    );
  }
  console.log(`  ✓ ${NEW_BADGES.length} badges upserted`);

  const total = await db.queryOne('SELECT COUNT(*)::int AS n FROM badges');
  console.log(`  → badges table now contains ${total.n} badges total.`);

  await db.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
