import { Pool, PoolClient } from 'pg';
import { db } from '../config/database';
import {
  HabitAlreadyAtTargetError,
  HabitNotFoundError
} from '../utils/errors';

/**
 * A "Querier" is anything with a .query() method matching pg's API.
 * Both Pool and PoolClient satisfy it, so any service method can run
 * either standalone (on the pool) or inside a parent transaction (on a client).
 */
type Querier = Pick<PoolClient, 'query'>;

export interface XPReward {
  baseXP: number;
  multiplier: number;
  totalXP: number;
  coinsAwarded: number;
}

export interface ProcessedHabit {
  userId: string;
  habitId: string;
  xpEarned: number;
  coinsEarned: number;
  newLevel: number;
  leveledUp: boolean;
  newStreak?: number;
  boostsApplied: { xp: boolean; coins: boolean };
  /** Today's progress AFTER this log (sum of value across all today's logs). */
  todayProgress: number;
  /** Target the habit asks for. */
  targetValue: number;
  /** True if this specific log is the one that crossed the target. */
  justCompleted: boolean;
  /** Mystery box id if this log triggered a level%10 milestone, else null. */
  mysteryBoxId: string | null;
}

export class GamificationEngine {
  private pool: Pool = db.getPool();

  /**
   * Calculate XP reward based on habit difficulty and streak bonus.
   * (Streak bonus follows the PDF: ×1.25 at 7d, ×1.5 at 30d, ×2 at 100d.)
   */
  calculateXPReward(habitDifficulty: string, currentStreak: number): XPReward {
    const baseXPMap: Record<string, number> = { easy: 10, medium: 25, hard: 50 };
    const baseXP = baseXPMap[habitDifficulty] || 10;

    let multiplier = 1;
    if (currentStreak >= 100) multiplier = 2.0;
    else if (currentStreak >= 30) multiplier = 1.5;
    else if (currentStreak >= 7) multiplier = 1.25;

    const totalXP = Math.floor(baseXP * multiplier);
    return { baseXP, multiplier, totalXP, coinsAwarded: Math.floor(totalXP / 10) };
  }

  /**
   * Level = floor(sqrt(xp / 100)) + 1
   */
  calculateLevel(totalXP: number): number {
    return Math.floor(Math.sqrt(totalXP / 100)) + 1;
  }

  calculateXPForNextLevel(currentLevel: number): number {
    return currentLevel * currentLevel * 100;
  }

  /**
   * Process a habit completion.
   *
   * Pass a `client` (PoolClient) to participate in an outer transaction;
   * otherwise the call uses the default pool with its own implicit transaction.
   *
   * Throws HabitAlreadyLoggedError (409) if today's log already exists.
   */
  async processHabitCompletion(
    userId: string,
    habitId: string,
    progressValue: number,
    client?: PoolClient
  ): Promise<ProcessedHabit> {
    const run = async (q: Querier): Promise<ProcessedHabit> => {
      // 1. Habit must exist and belong to this user
      const habitResult = await q.query(
        'SELECT * FROM habits WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [habitId, userId]
      );
      if (habitResult.rows.length === 0) throw new HabitNotFoundError();
      const habit = habitResult.rows[0];
      const targetValue = Number(habit.target_value) || 1;

      // 2. How much progress does the user already have today on this habit?
      const progressBefore = Number(
        (await q.query(
          `SELECT COALESCE(SUM(value), 0)::numeric AS total
             FROM habit_logs
            WHERE habit_id = $1 AND user_id = $2 AND logged_date = CURRENT_DATE`,
          [habitId, userId]
        )).rows[0].total
      );

      if (progressBefore >= targetValue) {
        // Already hit (or exceeded) today's target — no extra logs allowed.
        throw new HabitAlreadyAtTargetError();
      }

      const progressAfter = progressBefore + Number(progressValue);
      const justCompleted = progressBefore < targetValue && progressAfter >= targetValue;

      // 3. Current user stats (for streak bonus and boost flags)
      const userResult = await q.query(
        `SELECT xp, level, coins, current_streak,
                xp_boost_expires_at, coin_boost_expires_at
           FROM users WHERE id = $1`,
        [userId]
      );
      const user = userResult.rows[0];

      // 4. XP/coins are only awarded on the log that crosses the target.
      //    Logs that just rack progress (e.g. 1/8, 2/8…) don't pay out.
      //    Keeps the XP economy stable regardless of target size.
      let finalXP = 0;
      let finalCoins = 0;
      let xpBoosted = false;
      let coinBoosted = false;
      if (justCompleted) {
        const reward = this.calculateXPReward(habit.difficulty, user.current_streak);
        const now = new Date();
        xpBoosted = !!(user.xp_boost_expires_at && new Date(user.xp_boost_expires_at) > now);
        coinBoosted = !!(user.coin_boost_expires_at && new Date(user.coin_boost_expires_at) > now);
        finalXP = xpBoosted ? reward.totalXP * 2 : reward.totalXP;
        finalCoins = coinBoosted ? Math.floor(finalXP / 10) * 2 : Math.floor(finalXP / 10);
      }

      // 5. Insert the log row — multi-log per day is allowed now.
      await q.query(
        `INSERT INTO habit_logs (habit_id, user_id, logged_date, value, xp_earned, coins_earned)
         VALUES ($1, $2, CURRENT_DATE, $3, $4, $5)`,
        [habitId, userId, progressValue, finalXP, finalCoins]
      );

      // 6. Update user totals (only changes when justCompleted = true)
      const newXP = user.xp + finalXP;
      const newCoins = user.coins + finalCoins;
      const newLevel = this.calculateLevel(newXP);
      const leveledUp = newLevel > user.level;

      if (finalXP > 0 || finalCoins > 0) {
        await q.query(
          `UPDATE users
              SET xp = $1, coins = $2, level = $3, updated_at = NOW()
            WHERE id = $4`,
          [newXP, newCoins, newLevel, userId]
        );
      }

      // 7. Mystery box every 10 levels. Idempotent on (user, level).
      let mysteryBoxId: string | null = null;
      if (leveledUp && newLevel % 10 === 0) {
        const mb = await q.query(
          `INSERT INTO mystery_boxes (user_id, level_awarded)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [userId, newLevel]
        );
        if (mb.rowCount && mb.rowCount > 0) {
          mysteryBoxId = mb.rows[0].id;
          await q.query(
            `INSERT INTO notifications (user_id, title, message, type)
             VALUES ($1, '🎁 Mystery Box!', 'You hit level ' || $2 || ' — claim your reward!', 'mystery_box_awarded')`,
            [userId, newLevel]
          );
        }
      }

      return {
        userId,
        habitId,
        xpEarned: finalXP,
        coinsEarned: finalCoins,
        newLevel,
        leveledUp,
        newStreak: user.current_streak,
        boostsApplied: { xp: !!xpBoosted, coins: !!coinBoosted },
        todayProgress: progressAfter,
        targetValue,
        justCompleted,
        mysteryBoxId
      };
    };

    if (client) return run(client);
    return db.transaction(async (c) => run(c));
  }

  async recalculateLevel(userId: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT xp FROM users WHERE id = $1',
      [userId]
    );
    if (result.rows.length === 0) throw new Error('User not found');
    const newLevel = this.calculateLevel(result.rows[0].xp);
    await this.pool.query(
      'UPDATE users SET level = $1, updated_at = NOW() WHERE id = $2',
      [newLevel, userId]
    );
    return newLevel;
  }

  async getUserStats(userId: string): Promise<any> {
    const result = await this.pool.query(
      `SELECT id, username, email, xp, level, coins,
              current_streak, max_streak, avatar_url, created_at
         FROM users
        WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    if (result.rows.length === 0) throw new Error('User not found');

    const user = result.rows[0];
    const nextLevelXP = this.calculateXPForNextLevel(user.level);
    const currentLevelFloor = (user.level - 1) * (user.level - 1) * 100;
    const progressToNext = (user.xp - currentLevelFloor) / Math.max(1, nextLevelXP - currentLevelFloor);

    return {
      ...user,
      nextLevelXP,
      progressToNextLevel: Math.min(Math.max(progressToNext, 0), 1)
    };
  }
}

export const gamificationEngine = new GamificationEngine();
