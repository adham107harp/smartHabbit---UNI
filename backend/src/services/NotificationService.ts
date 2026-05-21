import { db } from '../config/database';
import { Pool } from 'pg';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  relatedBadgeId?: string;
  relatedChallengeId?: string;
}

export class NotificationService {
  private pool: Pool = db.getPool();

  /**
   * Create notification
   */
  async createNotification(
    userId: string,
    title: string,
    message: string,
    type: string,
    relatedBadgeId?: string,
    relatedChallengeId?: string
  ): Promise<Notification> {
    const result = await this.pool.query(
      `INSERT INTO notifications 
       (user_id, title, message, type, related_badge_id, related_challenge_id, is_read)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING id, user_id, title, message, type, is_read, created_at`,
      [userId, title, message, type, relatedBadgeId, relatedChallengeId]
    );

    return result.rows[0];
  }

  /**
   * Send streak warning notification
   */
  async sendStreakWarning(userId: string, currentStreak: number): Promise<void> {
    const now = new Date();
    const hoursRemaining = 24 - now.getHours() - (now.getMinutes() > 0 ? 1 : 0);

    await this.createNotification(
      userId,
      '⚠️ Streak Alert!',
      `You have ${hoursRemaining} hours to maintain your ${currentStreak}-day streak!`,
      'streak_alert'
    );
  }

  /**
   * Send badge unlock notification
   */
  async sendBadgeUnlock(userId: string, badgeName: string, badgeId: string): Promise<void> {
    await this.createNotification(
      userId,
      '🏆 Achievement Unlocked!',
      `You earned the "${badgeName}" badge!`,
      'badge_earned',
      badgeId
    );
  }

  /**
   * Send level up notification
   */
  async sendLevelUp(userId: string, newLevel: number): Promise<void> {
    await this.createNotification(
      userId,
      '⭐ Level Up!',
      `Congratulations! You reached level ${newLevel}!`,
      'level_up'
    );
  }

  /**
   * Send challenge complete notification
   */
  async sendChallengeComplete(
    userId: string,
    challengeName: string,
    challengeId: string,
    rewards: { xp: number; coins: number }
  ): Promise<void> {
    await this.createNotification(
      userId,
      '🎉 Challenge Complete!',
      `You completed "${challengeName}" and earned ${rewards.xp} XP and ${rewards.coins} coins!`,
      'challenge_complete',
      undefined,
      challengeId
    );
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string,
    limit: number = 50,
    unreadOnly: boolean = false
  ): Promise<Notification[]> {
    let query = `
      SELECT id, user_id, title, message, type, is_read, created_at, 
             related_badge_id, related_challenge_id
      FROM notifications
      WHERE user_id = $1
    `;

    const params: any[] = [userId];

    if (unreadOnly) {
      query += ` AND is_read = false`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Mark a single notification read.
   * Scoped to the owner — returns false if the row didn't belong to userId
   * (or didn't exist). Callers should map false → 404 so attackers can't
   * enumerate notification IDs.
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE notifications
          SET is_read = true
        WHERE id = $1 AND user_id = $2
      RETURNING id`,
      [notificationId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.pool.query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false
       RETURNING id`,
      [userId]
    );

    return result.rows.length;
  }

  /**
   * Delete a notification.
   * Same ownership scoping as markAsRead — returns false if not the user's.
   */
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM notifications
        WHERE id = $1 AND user_id = $2
      RETURNING id`,
      [notificationId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Delete all notifications for user
   */
  async deleteAllNotifications(userId: string): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM notifications WHERE user_id = $1 RETURNING id`,
      [userId]
    );

    return result.rows.length;
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*) as count FROM notifications 
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    return parseInt(result.rows[0].count);
  }
}

export const notificationService = new NotificationService();
