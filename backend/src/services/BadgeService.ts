import { Pool, PoolClient } from 'pg';
import { db } from '../config/database';

type Querier = Pick<PoolClient, 'query'>;

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
   * Check and award badges when criteria are met.
   * Pass `client` to participate in an outer transaction.
   *
   * v4 perf: previously made one SELECT per badge (N+1 with ~50 badges per
   * habit log). Now fetches every stat once up front and evaluates the
   * criteria against the in-memory snapshot, so awarding 50 badges is 2
   * queries + N inserts instead of 1 + N*1 + N inserts.
   */
  async checkAndAwardBadges(userId: string, client?: PoolClient): Promise<AwardedBadge[]> {
    const run = async (q: Querier): Promise<AwardedBadge[]> => {
      // One round-trip for everything badge criteria might check.
      const statsRow = (await q.query(
        `SELECT u.xp,
                u.level,
                u.max_streak,
                u.current_streak,
                (SELECT COUNT(*)::int FROM habit_logs WHERE user_id = u.id)                                   AS completions,
                (SELECT COUNT(*)::int FROM user_challenges WHERE user_id = u.id AND status = 'completed')    AS challenges_completed
           FROM users u
          WHERE u.id = $1`,
        [userId]
      )).rows[0];

      if (!statsRow) return [];

      const unearnedBadgesResult = await q.query(
        `SELECT b.* FROM badges b
          WHERE b.id NOT IN (SELECT badge_id FROM user_badges WHERE user_id = $1)`,
        [userId]
      );

      const awardedBadges: AwardedBadge[] = [];
      let bonusXp = 0;
      let bonusCoins = 0;

      for (const badge of unearnedBadgesResult.rows) {
        if (!this.meetsCriteria(badge.criteria_type, badge.criteria_value, statsRow)) {
          continue;
        }
        await this.awardBadge(userId, badge.id, q);
        awardedBadges.push({
          badgeId: badge.id,
          badgeName: badge.name,
          xpBonus: badge.bonus_xp || 0,
          coinsBonus: badge.bonus_coins || 0
        });
        bonusXp += badge.bonus_xp || 0;
        bonusCoins += badge.bonus_coins || 0;
      }

      // Coalesced bonus payout — one UPDATE instead of one per awarded badge.
      if (bonusXp > 0 || bonusCoins > 0) {
        await q.query(
          `UPDATE users
              SET xp = xp + $1, coins = coins + $2, updated_at = NOW()
            WHERE id = $3`,
          [bonusXp, bonusCoins, userId]
        );
      }

      return awardedBadges;
    };

    if (client) return run(client);
    return db.transaction(async (c) => run(c));
  }

  /**
   * Pure helper: does this badge's criteria match the cached stats?
   * No I/O — keeps the awarding loop tight.
   */
  private meetsCriteria(
    type: string,
    value: number,
    stats: { xp: number; level: number; max_streak: number; completions: number; challenges_completed: number }
  ): boolean {
    switch (type) {
      case 'streak':               return stats.max_streak >= value;
      case 'total_xp':             return stats.xp >= value;
      case 'completions':          return stats.completions >= value;
      case 'level':                return stats.level >= value;
      case 'challenges_completed': return stats.challenges_completed >= value;
      default:                     return false;
    }
  }

  private async awardBadge(userId: string, badgeId: string, q: Querier): Promise<void> {
    await q.query(
      `INSERT INTO user_badges (user_id, badge_id, earned_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT DO NOTHING`,
      [userId, badgeId]
    );

    await q.query(
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
