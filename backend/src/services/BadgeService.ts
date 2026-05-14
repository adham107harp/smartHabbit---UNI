import { db } from '../config/database';
import { Pool } from 'pg';

export interface BadgeInfo {
  id: string;
  name: string;
  description: string;
  criteria_type: string;
  criteria_value: number;
  image_url: string;
}

export interface AwardedBadge {
  badgeId: string;
  badgeName: string;
  xpBonus: number;
  coinsBonus: number;
}

export class BadgeService {
  private pool: Pool = db.getPool();

  /**
   * Check and award badges when criteria are met
   */
  async checkAndAwardBadges(userId: string): Promise<AwardedBadge[]> {
    return await db.transaction(async (client) => {
      // Get all badges user doesn't have yet
      const unearnedBadgesResult = await client.query(
        `SELECT b.* FROM badges b
         WHERE b.id NOT IN (
           SELECT badge_id FROM user_badges WHERE user_id = $1
         )`,
        [userId]
      );

      const badgesToEvaluate = unearnedBadgesResult.rows;
      const awardedBadges: AwardedBadge[] = [];

      for (const badge of badgesToEvaluate) {
        const isEarned = await this.checkBadgeCriteria(
          userId,
          badge.criteria_type,
          badge.criteria_value,
          client
        );

        if (isEarned) {
          await this.awardBadge(userId, badge.id, client);
          awardedBadges.push({
            badgeId: badge.id,
            badgeName: badge.name,
            xpBonus: badge.bonus_xp || 0,
            coinsBonus: badge.bonus_coins || 0
          });

          // Award bonus XP and coins
          if (badge.bonus_xp || badge.bonus_coins) {
            await client.query(
              `UPDATE users 
               SET xp = xp + $1, coins = coins + $2, updated_at = NOW() 
               WHERE id = $3`,
              [badge.bonus_xp || 0, badge.bonus_coins || 0, userId]
            );
          }
        }
      }

      return awardedBadges;
    });
  }

  /**
   * Check if badge criteria are met
   */
  private async checkBadgeCriteria(
    userId: string,
    criteriaType: string,
    criteriaValue: number,
    client: any
  ): Promise<boolean> {
    switch (criteriaType) {
      case 'streak':
        return await this.checkStreakCriteria(userId, criteriaValue, client);
      case 'total_xp':
        return await this.checkTotalXPCriteria(userId, criteriaValue, client);
      case 'completions':
        return await this.checkCompletionsCriteria(userId, criteriaValue, client);
      default:
        return false;
    }
  }

  /**
   * Check streak criteria
   */
  private async checkStreakCriteria(
    userId: string,
    requiredStreak: number,
    client: any
  ): Promise<boolean> {
    const result = await client.query(
      'SELECT max_streak FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) return false;
    return result.rows[0].max_streak >= requiredStreak;
  }

  /**
   * Check total XP criteria
   */
  private async checkTotalXPCriteria(
    userId: string,
    requiredXP: number,
    client: any
  ): Promise<boolean> {
    const result = await client.query(
      'SELECT xp FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) return false;
    return result.rows[0].xp >= requiredXP;
  }

  /**
   * Check completion count criteria
   */
  private async checkCompletionsCriteria(
    userId: string,
    requiredCompletions: number,
    client: any
  ): Promise<boolean> {
    const result = await client.query(
      `SELECT COUNT(*) as completion_count 
       FROM habit_logs 
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) return false;
    return parseInt(result.rows[0].completion_count) >= requiredCompletions;
  }

  /**
   * Award badge to user
   */
  private async awardBadge(
    userId: string,
    badgeId: string,
    client: any
  ): Promise<void> {
    await client.query(
      `INSERT INTO user_badges (user_id, badge_id, earned_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT DO NOTHING`,
      [userId, badgeId]
    );

    // Create notification for badge unlock
    await client.query(
      `INSERT INTO notifications (user_id, title, message, type, related_badge_id)
       SELECT $1, 
              '🏆 Achievement Unlocked!',
              'You earned the "' || b.name || '" badge!',
              'badge_earned',
              $2
       FROM badges b WHERE b.id = $2`,
      [userId, badgeId]
    );
  }

  /**
   * Get all badges (system-defined)
   */
  async getAllBadges(): Promise<BadgeInfo[]> {
    const result = await this.pool.query(
      `SELECT id, name, description, criteria_type, criteria_value, image_url
       FROM badges
       ORDER BY criteria_value ASC`
    );

    return result.rows;
  }

  /**
   * Get user's earned badges
   */
  async getUserBadges(userId: string): Promise<BadgeInfo[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT b.id, b.name, b.description, b.criteria_type, 
              b.criteria_value, b.image_url, ub.earned_at
       FROM badges b
       INNER JOIN user_badges ub ON b.id = ub.badge_id
       WHERE ub.user_id = $1
       ORDER BY ub.earned_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Get user's next badges (badges they haven't earned yet)
   */
  async getUserNextBadges(userId: string): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT b.*, 
              CASE 
                WHEN b.criteria_type = 'streak' THEN (SELECT current_streak FROM users WHERE id = $1)
                WHEN b.criteria_type = 'total_xp' THEN (SELECT xp FROM users WHERE id = $1)
                WHEN b.criteria_type = 'completions' THEN (SELECT COUNT(*) FROM habit_logs WHERE user_id = $1)
              END as current_progress
       FROM badges b
       WHERE b.id NOT IN (SELECT badge_id FROM user_badges WHERE user_id = $1)
       ORDER BY b.criteria_value ASC
       LIMIT 5`,
      [userId]
    );

    return result.rows;
  }
}

export const badgeService = new BadgeService();
