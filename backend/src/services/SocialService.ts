import { db } from '../config/database';
import { Pool } from 'pg';

export interface Friend {
  id: string;
  userId: string;
  friendId: string;
  username: string;
  avatarUrl: string;
  level: number;
  xp: number;
  status: 'accepted' | 'pending' | 'blocked';
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string;
  level: number;
  xp: number;
  currentStreak: number;
  maxStreak: number;
}

export class SocialService {
  private pool: Pool = db.getPool();

  /**
   * Send friend request
   */
  async sendFriendRequest(fromUserId: string, toUserId: string): Promise<void> {
    if (fromUserId === toUserId) {
      throw new Error('Cannot send friend request to yourself');
    }

    // Check if already friends or blocked
    const existingResult = await this.pool.query(
      `SELECT status FROM friends 
       WHERE (user_id = $1 AND friend_id = $2) 
       OR (user_id = $2 AND friend_id = $1)`,
      [fromUserId, toUserId]
    );

    if (existingResult.rows.length > 0) {
      const status = existingResult.rows[0].status;
      if (status === 'blocked') {
        throw new Error('Cannot add blocked user');
      }
      if (status === 'accepted') {
        throw new Error('Already friends');
      }
    }

    // Create pending relationship
    await this.pool.query(
      `INSERT INTO friends (user_id, friend_id, status) 
       VALUES ($1, $2, 'pending')`,
      [fromUserId, toUserId]
    );

    // Notify target user
    await this.pool.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, '👋 Friend Request', 'You received a new friend request!', 'friend_request')`,
      [toUserId]
    );
  }

  /**
   * Accept friend request
   */
  async acceptFriendRequest(userId: string, friendId: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE friends 
       SET status = 'accepted' 
       WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'
       RETURNING id`,
      [friendId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Friend request not found');
    }

    // Notify the requester
    await this.pool.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, '✅ Friend Request Accepted', 'Your friend request was accepted!', 'friend_request')`,
      [friendId]
    );
  }

  /**
   * Decline friend request
   */
  async declineFriendRequest(userId: string, friendId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM friends 
       WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'`,
      [friendId, userId]
    );
  }

  /**
   * Remove friend
   */
  async removeFriend(userId: string, friendId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM friends 
       WHERE (user_id = $1 AND friend_id = $2 AND status = 'accepted')
       OR (user_id = $2 AND friend_id = $1 AND status = 'accepted')`,
      [userId, friendId]
    );
  }

  /**
   * Block a user
   */
  async blockUser(userId: string, blockedUserId: string): Promise<void> {
    // Delete any existing friendship
    await this.pool.query(
      `DELETE FROM friends 
       WHERE (user_id = $1 AND friend_id = $2) 
       OR (user_id = $2 AND friend_id = $1)`,
      [userId, blockedUserId]
    );

    // Create blocked relationship
    await this.pool.query(
      `INSERT INTO friends (user_id, friend_id, status) 
       VALUES ($1, $2, 'blocked')`,
      [userId, blockedUserId]
    );
  }

  /**
   * Get user's friends list
   */
  async getUserFriends(userId: string, limit: number = 50): Promise<Friend[]> {
    const result = await this.pool.query(
      `SELECT 
        f.id, f.user_id, f.friend_id, u.username, u.avatar_url, u.level, u.xp, f.status, f.created_at
       FROM friends f
       INNER JOIN users u ON f.friend_id = u.id
       WHERE f.user_id = $1 AND f.status = 'accepted' AND u.deleted_at IS NULL
       ORDER BY f.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  /**
   * Get pending friend requests
   */
  async getPendingRequests(userId: string): Promise<Friend[]> {
    const result = await this.pool.query(
      `SELECT 
        f.id, f.user_id, f.friend_id, u.username, u.avatar_url, u.level, u.xp, f.status, f.created_at
       FROM friends f
       INNER JOIN users u ON f.user_id = u.id
       WHERE f.friend_id = $1 AND f.status = 'pending' AND u.deleted_at IS NULL
       ORDER BY f.created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Get global leaderboard
   */
  async getGlobalLeaderboard(limit: number = 100): Promise<LeaderboardEntry[]> {
    const result = await this.pool.query(
      `SELECT 
        ROW_NUMBER() OVER (ORDER BY u.xp DESC, u.level DESC) as rank,
        u.id, u.username, u.avatar_url, u.level, u.xp, u.current_streak, u.max_streak
       FROM users u
       WHERE u.deleted_at IS NULL
       ORDER BY u.xp DESC, u.level DESC, u.username ASC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  /**
   * Get friends leaderboard
   */
  async getFriendsLeaderboard(userId: string): Promise<LeaderboardEntry[]> {
    const result = await this.pool.query(
      `SELECT 
        ROW_NUMBER() OVER (ORDER BY u.xp DESC, u.level DESC) as rank,
        u.id, u.username, u.avatar_url, u.level, u.xp, u.current_streak, u.max_streak
       FROM users u
       INNER JOIN friends f ON (f.friend_id = u.id AND f.user_id = $1 AND f.status = 'accepted')
       WHERE u.deleted_at IS NULL
       ORDER BY u.xp DESC, u.level DESC, u.username ASC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Get weekly leaderboard (XP earned this week)
   */
  async getWeeklyLeaderboard(limit: number = 100): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT 
        ROW_NUMBER() OVER (ORDER BY weekly_xp DESC) as rank,
        u.id, u.username, u.avatar_url, u.level,
        COALESCE(SUM(hl.xp_earned), 0) as weekly_xp
       FROM users u
       LEFT JOIN habit_logs hl ON u.id = hl.user_id 
         AND hl.logged_date >= CURRENT_DATE - INTERVAL '7 days'
       WHERE u.deleted_at IS NULL
       GROUP BY u.id, u.username, u.avatar_url, u.level
       ORDER BY weekly_xp DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }
}

export const socialService = new SocialService();
