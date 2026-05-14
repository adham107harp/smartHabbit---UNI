import { db } from '../config/database';
import { Pool } from 'pg';

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
}

export class GamificationEngine {
  private pool: Pool = db.getPool();

  /**
   * Calculate XP reward based on habit difficulty and streak bonus
   */
  calculateXPReward(habitDifficulty: string, currentStreak: number): XPReward {
    // Base XP by difficulty
    const baseXPMap: Record<string, number> = {
      easy: 10,
      medium: 25,
      hard: 50
    };

    let xp = baseXPMap[habitDifficulty] || 10;

    // Streak multiplier (max 2x)
    if (currentStreak >= 30) {
      xp *= 2; // 2x multiplier for 30+ day streak
    } else if (currentStreak >= 7) {
      xp *= 1.5; // 1.5x multiplier for 7+ day streak
    }

    const coins = Math.floor(xp / 10);

    return {
      baseXP: baseXPMap[habitDifficulty] || 10,
      multiplier: xp / (baseXPMap[habitDifficulty] || 10),
      totalXP: xp,
      coinsAwarded: coins
    };
  }

  /**
   * Calculate user level from total XP
   * Formula: Level = floor(sqrt(total_xp / 100)) + 1
   */
  calculateLevel(totalXP: number): number {
    return Math.floor(Math.sqrt(totalXP / 100)) + 1;
  }

  /**
   * Calculate XP needed for next level
   */
  calculateXPForNextLevel(currentLevel: number): number {
    return currentLevel * currentLevel * 100;
  }

  /**
   * Process habit completion - main business logic
   */
  async processHabitCompletion(
    userId: string,
    habitId: string,
    progressValue: number
  ): Promise<ProcessedHabit> {
    return await db.transaction(async (client) => {
      // 1. Get habit details and user's current stats
      const habitResult = await client.query(
        'SELECT * FROM habits WHERE id = $1 AND user_id = $2',
        [habitId, userId]
      );

      if (habitResult.rows.length === 0) {
        throw new Error('Habit not found');
      }

      const habit = habitResult.rows[0];

      const userResult = await client.query(
        'SELECT xp, level, coins, current_streak FROM users WHERE id = $1',
        [userId]
      );

      const user = userResult.rows[0];

      // 2. Calculate XP earned
      const reward = this.calculateXPReward(habit.difficulty, user.current_streak);

      // 3. Insert habit log
      await client.query(
        `INSERT INTO habit_logs (habit_id, user_id, logged_date, value, xp_earned)
         VALUES ($1, $2, CURRENT_DATE, $3, $4)
         ON CONFLICT (habit_id, user_id, logged_date) 
         DO UPDATE SET value = $3, xp_earned = $4`,
        [habitId, userId, progressValue, reward.totalXP]
      );

      // 4. Update user's XP and coins
      const newXP = user.xp + reward.totalXP;
      const newCoins = user.coins + reward.coinsAwarded;
      const newLevel = this.calculateLevel(newXP);
      const leveledUp = newLevel > user.level;

      await client.query(
        `UPDATE users 
         SET xp = $1, coins = $2, level = $3, updated_at = NOW() 
         WHERE id = $4`,
        [newXP, newCoins, newLevel, userId]
      );

      return {
        userId,
        habitId,
        xpEarned: reward.totalXP,
        coinsEarned: reward.coinsAwarded,
        newLevel,
        leveledUp,
        newStreak: user.current_streak
      };
    });
  }

  /**
   * Recalculate user's level based on current XP (for synchronization)
   */
  async recalculateLevel(userId: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT xp FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const newLevel = this.calculateLevel(result.rows[0].xp);

    await this.pool.query(
      'UPDATE users SET level = $1, updated_at = NOW() WHERE id = $2',
      [newLevel, userId]
    );

    return newLevel;
  }

  /**
   * Get user's overview stats
   */
  async getUserStats(userId: string): Promise<any> {
    const result = await this.pool.query(
      `SELECT 
        id, username, email, xp, level, coins, 
        current_streak, max_streak, avatar_url, created_at
      FROM users 
      WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = result.rows[0];
    const nextLevelXP = this.calculateXPForNextLevel(user.level);
    const progressToNext = (user.xp - (user.level - 1) * (user.level - 1) * 100) / (nextLevelXP - ((user.level - 1) * (user.level - 1) * 100));

    return {
      ...user,
      nextLevelXP,
      progressToNextLevel: Math.min(Math.max(progressToNext, 0), 1)
    };
  }
}

export const gamificationEngine = new GamificationEngine();
