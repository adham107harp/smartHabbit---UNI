import { Pool, PoolClient } from 'pg';
import { db } from '../config/database';

type Querier = Pick<PoolClient, 'query'>;

export interface StreakUpdate {
  userId: string;
  newStreak: number;
  maxStreak: number;
  streakBroken: boolean;
  shieldUsed: boolean;
  /** True when this update was a no-op because not every daily habit is
   *  done yet today. The streak counter is unchanged in that case. */
  pendingTodayCompletion: boolean;
}

/**
 * Returns true iff EVERY active daily habit for the user has hit its
 * target_value (via SUM of habit_logs.value) for the given date.
 * If the user has zero active daily habits the answer is false — we don't
 * want a habit-less user to magically grow a streak.
 */
export async function allDailyHabitsDone(
  q: Querier,
  userId: string,
  dateExpr: string = 'CURRENT_DATE'
): Promise<boolean> {
  const row = (await q.query(
    `WITH user_daily AS (
       SELECT id, target_value
         FROM habits
        WHERE user_id = $1
          AND deleted_at IS NULL
          AND is_active
          AND goal_type = 'daily'
     ),
     done AS (
       SELECT h.id
         FROM user_daily h
        WHERE COALESCE((
                SELECT SUM(value)
                  FROM habit_logs
                 WHERE habit_id = h.id
                   AND user_id  = $1
                   AND logged_date = ${dateExpr}
              ), 0) >= h.target_value
     )
     SELECT (SELECT COUNT(*) FROM user_daily) AS total,
            (SELECT COUNT(*) FROM done)       AS done`,
    [userId]
  )).rows[0];
  const total = Number(row.total);
  const done = Number(row.done);
  return total > 0 && done === total;
}

export class StreakService {
  private pool: Pool = db.getPool();

  /**
   * Update streak count.
   * Pass `client` to run inside an outer transaction; otherwise it opens its own.
   *
   * Streak shield: if the user missed yesterday and has a shield, the shield
   * is consumed (count -= 1) and the streak is preserved instead of reset.
   */
  async updateStreak(userId: string, client?: PoolClient): Promise<StreakUpdate> {
    const run = async (q: Querier): Promise<StreakUpdate> => {
      // v5 rule: streak only ticks when ALL daily habits are done for today.
      // If today isn't fully done yet, this call is a no-op — we leave the
      // streak counter unchanged and let last_active_at carry the freshness.
      const userResult = await q.query(
        `SELECT current_streak, max_streak, streak_shields_count,
                last_streak_date,
                last_streak_date = CURRENT_DATE AS already_bumped_today
           FROM users WHERE id = $1`,
        [userId]
      );
      const user = userResult.rows[0];

      // last_active_at always touches — punishment job needs an accurate
      // "user did something" timestamp regardless of streak.
      await q.query(
        'UPDATE users SET last_active_at = NOW(), updated_at = NOW() WHERE id = $1',
        [userId]
      );

      // Idempotency: if we already credited the streak for today, never
      // bump it again, regardless of how many habits get logged later.
      if (user.already_bumped_today) {
        return {
          userId,
          newStreak: user.current_streak,
          maxStreak: user.max_streak,
          streakBroken: false,
          shieldUsed: false,
          pendingTodayCompletion: false
        };
      }

      const todayAllDone = await allDailyHabitsDone(q, userId, 'CURRENT_DATE');
      if (!todayAllDone) {
        return {
          userId,
          newStreak: user.current_streak,
          maxStreak: user.max_streak,
          streakBroken: false,
          shieldUsed: false,
          pendingTodayCompletion: true
        };
      }

      // Today is fully done. Did the streak already account for it? We
      // detect "the user just completed today" by checking: was today's
      // streak credit already counted? We approximate this with the
      // "did yesterday's all-done qualify too?" check — a clean transition.
      //
      // Use SQL date math so timezone doesn't drift the comparison.
      const yesterdayAllDone = await allDailyHabitsDone(q, userId, "(CURRENT_DATE - INTERVAL '1 day')");

      let newStreak: number;
      let streakBroken = false;
      let shieldUsed = false;

      if (yesterdayAllDone) {
        // Two consecutive full-completion days → extend.
        newStreak = user.current_streak + 1;
      } else if (user.streak_shields_count > 0 && user.current_streak > 0) {
        // Yesterday wasn't fully done but the user already had a streak.
        // Spend a shield to keep it alive (one-day grace).
        shieldUsed = true;
        newStreak = user.current_streak + 1;
        await q.query(
          'UPDATE users SET streak_shields_count = streak_shields_count - 1 WHERE id = $1',
          [userId]
        );
        await q.query(
          `INSERT INTO notifications (user_id, title, message, type)
           VALUES ($1, '🛡️ Streak Shield Used',
                   'Your streak shield saved your streak. It''s still alive!',
                   'general')`,
          [userId]
        );
      } else {
        // New streak starting today.
        newStreak = 1;
        streakBroken = user.current_streak > 0 && user.current_streak !== 1;
      }

      // Always stamp today as bumped so subsequent logs same day skip.
      const maxStreak = Math.max(user.max_streak, newStreak);
      await q.query(
        `UPDATE users
            SET current_streak = $1,
                max_streak = $2,
                last_streak_date = CURRENT_DATE,
                updated_at = NOW()
          WHERE id = $3`,
        [newStreak, maxStreak, userId]
      );

      const streakMilestones = [7, 30, 100, 365];
      if (streakMilestones.includes(newStreak)) {
        await q.query(
          `INSERT INTO notifications (user_id, title, message, type)
           VALUES ($1, '🔥 Streak Milestone!', 'You reached a ' || $2 || '-day streak!', 'streak_milestone')`,
          [userId, newStreak]
        );
      }

      return {
        userId,
        newStreak,
        maxStreak: Math.max(user.max_streak, newStreak),
        streakBroken,
        shieldUsed,
        pendingTodayCompletion: false
      };
    };

    if (client) return run(client);
    return db.transaction(async (c) => run(c));
  }

  /**
   * Send streak warning notifications
   */
  async sendStreakWarning(userId: string): Promise<void> {
    const userResult = await this.pool.query(
      `SELECT current_streak FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) return;

    const currentStreak = userResult.rows[0].current_streak;

    if (currentStreak > 0) {
      // Check if they've logged today
      const todayLogResult = await this.pool.query(
        `SELECT COUNT(*) as count FROM habit_logs 
         WHERE user_id = $1 AND logged_date = CURRENT_DATE`,
        [userId]
      );

      const hasLoggedToday = todayLogResult.rows[0].count > 0;

      if (!hasLoggedToday) {
        // Get time remaining message
        const now = new Date();
        const hoursRemaining = 24 - now.getHours() - (now.getMinutes() > 0 ? 1 : 0);

        await this.pool.query(
          `INSERT INTO notifications (user_id, title, message, type)
           VALUES ($1, '⚠️ Streak Alert!', 'You have ' || $2 || ' hours to maintain your ' || $3 || '-day streak!', 'streak_alert')`,
          [userId, hoursRemaining, currentStreak]
        );
      }
    }
  }

  /**
   * Reset streaks for users who didn't log yesterday
   * Should run daily at midnight
   */
  async resetBrokenStreaks(): Promise<number> {
    const result = await this.pool.query(
      `UPDATE users 
       SET current_streak = 0, updated_at = NOW()
       WHERE id IN (
         SELECT u.id FROM users u
         WHERE u.current_streak > 0
         AND NOT EXISTS (
           SELECT 1 FROM habit_logs hl
           WHERE hl.user_id = u.id 
           AND hl.logged_date = CURRENT_DATE - INTERVAL '1 day'
         )
       )
       RETURNING id`
    );

    console.log(`Reset streaks for ${result.rows.length} users`);
    return result.rows.length;
  }

  /**
   * Get streak stats for user
   */
  async getStreakStats(userId: string): Promise<any> {
    const result = await this.pool.query(
      `SELECT 
        current_streak, 
        max_streak,
        (SELECT COUNT(*) FROM habit_logs WHERE user_id = $1 AND logged_date = CURRENT_DATE) as today_completions,
        (SELECT COUNT(*) FROM habit_logs WHERE user_id = $1 AND logged_date >= CURRENT_DATE - INTERVAL '7 days') as week_completions,
        (SELECT COUNT(*) FROM habit_logs WHERE user_id = $1) as total_completions
       FROM users 
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return result.rows[0];
  }
}

export const streakService = new StreakService();
