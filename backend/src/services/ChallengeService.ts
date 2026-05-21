import { Pool, PoolClient } from 'pg';
import { db } from '../config/database';

type Querier = Pick<PoolClient, 'query'>;

export interface ChallengeProgress {
  challengeId: string;
  userId: string;
  status: 'joined' | 'completed' | 'failed';
  progress: number;
  targetValue: number;
  progressPercent: number;
}

export interface CompletedChallenge {
  challengeId: string;
  userId: string;
  xpAwarded: number;
  coinsAwarded: number;
  badgeAwarded?: string;
}

export class ChallengeService {
  private pool: Pool = db.getPool();

  /**
   * Update challenge progress after habit completion.
   * Pass `client` to participate in an outer transaction.
   */
  async updateChallengeProgress(
    userId: string,
    habitId: string,
    client?: PoolClient
  ): Promise<CompletedChallenge[]> {
    const run = async (q: Querier): Promise<CompletedChallenge[]> => {
      const completedChallenges: CompletedChallenge[] = [];

      const activeChallengesResult = await q.query(
        `SELECT uc.*, c.target_value, c.reward_xp, c.reward_coins, c.badge_id
           FROM user_challenges uc
          INNER JOIN challenges c ON uc.challenge_id = c.id
          WHERE uc.user_id = $1 AND uc.status = 'joined'
            AND c.end_date > NOW()`,
        [userId]
      );

      for (const challenge of activeChallengesResult.rows) {
        const newProgress = challenge.progress + 1;

        if (newProgress >= challenge.target_value) {
          await q.query(
            `UPDATE user_challenges
                SET status = 'completed', progress = $1, completed_at = NOW()
              WHERE user_id = $2 AND challenge_id = $3`,
            [newProgress, userId, challenge.challenge_id]
          );

          await q.query(
            `UPDATE users
                SET xp = xp + $1, coins = coins + $2, updated_at = NOW()
              WHERE id = $3`,
            [challenge.reward_xp, challenge.reward_coins, userId]
          );

          if (challenge.badge_id) {
            await q.query(
              `INSERT INTO user_badges (user_id, badge_id, earned_at)
               VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
              [userId, challenge.badge_id]
            );
          }

          await q.query(
            `INSERT INTO notifications (user_id, title, message, type, related_challenge_id)
             VALUES ($1, '🎉 Challenge Complete!',
                     'You completed a challenge and earned rewards!',
                     'challenge_complete', $2)`,
            [userId, challenge.challenge_id]
          );

          completedChallenges.push({
            challengeId: challenge.challenge_id,
            userId,
            xpAwarded: challenge.reward_xp,
            coinsAwarded: challenge.reward_coins,
            badgeAwarded: challenge.badge_id
          });
        } else {
          await q.query(
            `UPDATE user_challenges
                SET progress = $1
              WHERE user_id = $2 AND challenge_id = $3`,
            [newProgress, userId, challenge.challenge_id]
          );
        }
      }

      return completedChallenges;
    };

    if (client) return run(client);
    return db.transaction(async (c) => run(c));
  }

  /**
   * Join a challenge
   */
  async joinChallenge(userId: string, challengeId: string): Promise<void> {
    const result = await this.pool.query(
      `INSERT INTO user_challenges (user_id, challenge_id, status, progress, joined_at)
       VALUES ($1, $2, 'joined', 0, NOW())
       ON CONFLICT (user_id, challenge_id) DO NOTHING
       RETURNING id`,
      [userId, challengeId]
    );

    if (result.rows.length === 0) {
      throw new Error('Already joined this challenge or challenge not found');
    }
  }

  /**
   * Leave a challenge
   */
  async leaveChallenge(userId: string, challengeId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM user_challenges WHERE user_id = $1 AND challenge_id = $2`,
      [userId, challengeId]
    );
  }

  /**
   * Get user's active challenges
   */
  async getUserActiveChallenges(userId: string): Promise<ChallengeProgress[]> {
    const result = await this.pool.query(
      `SELECT 
        uc.challenge_id, uc.user_id, uc.status, uc.progress, c.target_value,
        ROUND((uc.progress::numeric / NULLIF(c.target_value, 0)::numeric) * 100, 2) as progress_percent
       FROM user_challenges uc
       INNER JOIN challenges c ON uc.challenge_id = c.id
       WHERE uc.user_id = $1 AND uc.status = 'joined'
       AND c.end_date > NOW()
       ORDER BY uc.joined_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Get all active challenges
   */
  async getActiveChallenges(): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT id, name, description, start_date, end_date, target_value, 
              reward_xp, reward_coins, badge_id
       FROM challenges
       WHERE is_active = true AND end_date > NOW()
       ORDER BY start_date DESC`
    );

    return result.rows;
  }

  /**
   * Get challenge leaderboard
   */
  async getChallengeLeaderboard(
    challengeId: string,
    limit: number = 100
  ): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT 
        u.id, u.username, u.avatar_url, uc.progress, 
        c.target_value, uc.status,
        ROW_NUMBER() OVER (ORDER BY uc.progress DESC) as rank
       FROM user_challenges uc
       INNER JOIN users u ON uc.user_id = u.id
       INNER JOIN challenges c ON uc.challenge_id = c.id
       WHERE uc.challenge_id = $1
       ORDER BY uc.progress DESC
       LIMIT $2`,
      [challengeId, limit]
    );

    return result.rows;
  }

  /**
   * Auto-fail expired challenges (cron job)
   */
  async failExpiredChallenges(): Promise<number> {
    const result = await this.pool.query(
      `UPDATE user_challenges 
       SET status = 'failed'
       WHERE status = 'joined' 
       AND challenge_id IN (
         SELECT id FROM challenges WHERE end_date <= NOW()
       )
       RETURNING id`
    );

    console.log(`Auto-failed ${result.rows.length} expired challenges`);
    return result.rows.length;
  }
}

export const challengeService = new ChallengeService();
