/**
 * Punishment job: every UTC day at ~00:05 it sweeps users who didn't log
 * any habit yesterday and applies a graduated penalty:
 *
 *   1. If current_streak > 0 → current_streak -= 1
 *   2. Else if coins >= 10  → coins -= 10
 *   3. Else if xp > 0       → xp = max(0, xp - 10) (level recomputed)
 *
 * On top of that, any user inactive for 45+ days is soft-deleted
 * (`deleted_at = NOW()`).
 *
 * Heads-up: at 21:00 UTC every day, users at risk (haven't logged today,
 * have an active streak) get a friendly warning notification.
 *
 * The job runs every 10 minutes and checks the recorded `last_run_at`
 * against the current UTC day to make sure it fires at most once per day.
 */

import { db } from '../config/database';

const INACTIVITY_DAYS_BEFORE_DELETE = 45;
const COIN_PENALTY = 10;
const XP_PENALTY = 10;

let timer: NodeJS.Timeout | null = null;

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Check whether punishment already ran for today's UTC date.
 */
async function shouldRunPunishment(): Promise<boolean> {
  const state = await db.queryOne(
    'SELECT last_run_at FROM punishment_job_state WHERE id = 1'
  );
  if (!state?.last_run_at) return true;
  const lastDate = new Date(state.last_run_at).toISOString().slice(0, 10);
  return lastDate !== todayUtcDate();
}

async function markRan(): Promise<void> {
  await db.query(
    'UPDATE punishment_job_state SET last_run_at = NOW() WHERE id = 1'
  );
}

/**
 * Punish a single user. Wrapped in its own transaction so one user's bad
 * data can't poison the rest of the sweep.
 */
async function punishUser(userId: string): Promise<void> {
  await db.transaction(async (client) => {
    const user = (await client.query(
      `SELECT id, username, xp, level, coins, current_streak, last_active_at
         FROM users
        WHERE id = $1 AND deleted_at IS NULL
        FOR UPDATE`,
      [userId]
    )).rows[0];
    if (!user) return;

    // 45-day inactivity: hard-stop, soft-delete the account and bail
    const inactiveDays = Math.floor(
      (Date.now() - new Date(user.last_active_at).getTime()) / 86400000
    );
    if (inactiveDays >= INACTIVITY_DAYS_BEFORE_DELETE) {
      await client.query(
        'UPDATE users SET deleted_at = NOW() WHERE id = $1',
        [user.id]
      );
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, '👋 Account deactivated',
                 'You were inactive for over ${INACTIVITY_DAYS_BEFORE_DELETE} days, so your account has been deactivated. Reach out to support to restore it.',
                 'account_deleted_inactive')`,
        [user.id]
      );
      return;
    }

    // Apply the graduated penalty
    let title = '';
    let message = '';
    if (user.current_streak > 0) {
      await client.query(
        'UPDATE users SET current_streak = current_streak - 1, warn_count = warn_count + 1, updated_at = NOW() WHERE id = $1',
        [user.id]
      );
      title = '🔥 Streak penalty';
      message = `You didn't log any habit yesterday — you lost 1 day of your streak. It's now ${user.current_streak - 1} days.`;
    } else if (user.coins >= COIN_PENALTY) {
      await client.query(
        'UPDATE users SET coins = coins - $1, warn_count = warn_count + 1, updated_at = NOW() WHERE id = $2',
        [COIN_PENALTY, user.id]
      );
      title = '💰 Coin penalty';
      message = `You didn't log any habit yesterday — ${COIN_PENALTY} coins were deducted.`;
    } else if (user.xp > 0) {
      const newXp = Math.max(0, user.xp - XP_PENALTY);
      const newLevel = Math.floor(Math.sqrt(newXp / 100)) + 1;
      await client.query(
        'UPDATE users SET xp = $1, level = $2, warn_count = warn_count + 1, updated_at = NOW() WHERE id = $3',
        [newXp, newLevel, user.id]
      );
      title = '⚡ XP penalty';
      message = `You didn't log any habit yesterday — ${XP_PENALTY} XP was deducted.`;
    } else {
      // Nothing left to deduct; just bump warn_count so we know they're idle
      await client.query(
        'UPDATE users SET warn_count = warn_count + 1, updated_at = NOW() WHERE id = $1',
        [user.id]
      );
      title = '👀 You missed yesterday';
      message = `You didn't log any habit yesterday. Nothing left to deduct — log today to get back on track.`;
    }

    await client.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, $2, $3, 'punishment_applied')`,
      [user.id, title, message]
    );
  });
}

/**
 * The actual sweep — picks users who had at least one active daily habit
 * yesterday AND did NOT complete every one of them.
 *
 * "Completed" = SUM(habit_logs.value WHERE logged_date = yesterday) >= target_value.
 * This matches the new v5 definition of "a fully done day."
 */
async function runOnce(): Promise<void> {
  console.log('[punishment] sweeping…');
  const candidates = await db.query(
    `WITH yesterday_progress AS (
       SELECT h.user_id, h.id AS habit_id, h.target_value,
              COALESCE(SUM(hl.value), 0) AS done
         FROM habits h
         LEFT JOIN habit_logs hl
                ON hl.habit_id = h.id
               AND hl.user_id  = h.user_id
               AND hl.logged_date = CURRENT_DATE - INTERVAL '1 day'
        WHERE h.deleted_at IS NULL
          AND h.is_active = true
          AND h.goal_type = 'daily'
        GROUP BY h.user_id, h.id, h.target_value
     ),
     incomplete_users AS (
       SELECT DISTINCT user_id
         FROM yesterday_progress
        WHERE done < target_value
     )
     SELECT u.id
       FROM users u
       INNER JOIN incomplete_users i ON i.user_id = u.id
      WHERE u.deleted_at IS NULL`
  );

  for (const row of candidates) {
    try {
      await punishUser(row.id);
    } catch (e) {
      console.error(`[punishment] failed for user ${row.id}:`, e);
    }
  }

  // Inactivity-only sweep (covers users who don't even have habits)
  const orphans = await db.query(
    `SELECT id FROM users
      WHERE deleted_at IS NULL
        AND last_active_at < NOW() - INTERVAL '${INACTIVITY_DAYS_BEFORE_DELETE} days'`
  );
  for (const o of orphans) {
    try {
      await punishUser(o.id);
    } catch (e) {
      console.error(`[punishment] orphan-delete failed for ${o.id}:`, e);
    }
  }

  console.log(`[punishment] swept ${candidates.length} candidates + ${orphans.length} orphans.`);
}

/**
 * Tick handler — fires every 10 minutes, but only does real work if a new
 * UTC day has begun since the last run AND we're past 00:05 UTC.
 */
async function tick(): Promise<void> {
  try {
    const now = new Date();
    if (now.getUTCHours() === 0 && now.getUTCMinutes() < 5) return;
    if (!(await shouldRunPunishment())) return;
    await runOnce();
    await markRan();
  } catch (e) {
    console.error('[punishment] tick error:', e);
  }
}

export function startPunishmentJob(): void {
  // First tick: 30 seconds after boot (so migrations have settled).
  setTimeout(tick, 30_000);
  timer = setInterval(tick, 10 * 60 * 1000); // every 10 minutes
}

export function stopPunishmentJob(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Exposed for manual triggers from a script (npm run punish-now). */
export async function runPunishmentNow(): Promise<void> {
  await runOnce();
  await markRan();
}
