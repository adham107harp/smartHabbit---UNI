import { db } from '../config/database';
import { Pool } from 'pg';

export interface StreakUpdate {
  userId: string;
  newStreak: number;
  maxStreak: number;
  streakBroken: boolean;
}

export class StreakService {
  private pool: Pool = db.getPool();

  /**
   * Update streak count - called when habit is logged
   */
  async updateStreak(userId: string): Promise<StreakUpdate> {
    return await db.transaction(async (client) => {
      // Get last habit log date for this user
      const lastLogResult = await client.query(
        `SELECT MAX(logged_date) as last_logged_date 
         FROM habit_logs 
         WHERE user_id = $1`,
        [userId]
      );

      const lastLoggedDate = lastLogResult.rows[0]?.last_logged_date;
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      const userResult = await client.query(
        'SELECT current_streak, max_streak FROM users WHERE id = $1',
        [userId]
      );

      const user = userResult.rows[0];
      let newStreak = user.current_streak;
      let streakBroken = false;

      if (lastLoggedDate === today) {
        // Already logged today, no change
        newStreak = user.current_streak;
      } else if (lastLoggedDate === yesterday) {
        // Consecutive day - increment streak
        newStreak = user.current_streak + 1;
      } else {
        // Streak broken
        newStreak = 1;
        streakBroken = user.current_streak > 0;
      }

      // Update user streak
      const maxStreak = Math.max(user.max_streak, newStreak);

      await client.query(
        `UPDATE users 
         SET current_streak = $1, max_streak = $2, updated_at = NOW() 
         WHERE id = $3`,
        [newStreak, maxStreak, userId]
      );

      // Check for streak milestone badges
      const streakMilestones = [7, 30, 100, 365];
      if (streakMilestones.includes(newStreak)) {
        await client.query(
          `INSERT INTO notifications (user_id, title, message, type)
           VALUES ($1, '🔥 Streak Milestone!', 'You reached a ' || $2 || '-day streak!', 'general')`,
          [userId, newStreak]
        );
      }

      return {
        userId,
        newStreak,
        maxStreak,
        streakBroken
      };
    });
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
