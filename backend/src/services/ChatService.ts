import { Pool } from 'pg';
import { db } from '../config/database';

export interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface ConversationSummary {
  friend_id: string;
  username: string;
  avatar_url: string | null;
  level: number;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export class ChatService {
  private pool: Pool = db.getPool();

  /**
   * Confirm the two users are accepted friends; raises if not.
   * The friends table uses (user_id, friend_id) so we check both orderings.
   */
  async ensureFriends(a: string, b: string): Promise<void> {
    const row = await this.pool.query(
      `SELECT 1 FROM friends
        WHERE status = 'accepted'
          AND ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
        LIMIT 1`,
      [a, b]
    );
    if (row.rowCount === 0) {
      throw new Error('You can only chat with accepted friends.');
    }
  }

  async sendMessage(senderId: string, receiverId: string, body: string): Promise<ChatMessage> {
    if (senderId === receiverId) {
      throw new Error("You can't message yourself.");
    }
    const trimmed = body.trim();
    if (!trimmed) throw new Error('Message body cannot be empty.');
    if (trimmed.length > 1000) throw new Error('Message too long (max 1000 chars).');

    await this.ensureFriends(senderId, receiverId);

    const result = await this.pool.query(
      `INSERT INTO chat_messages (sender_id, receiver_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, sender_id, receiver_id, body, is_read, created_at`,
      [senderId, receiverId, trimmed]
    );
    return result.rows[0];
  }

  /**
   * Pull message history between two users, paginated by `before` (created_at).
   * Returns oldest-first so the UI can simply append.
   */
  async getHistory(
    userA: string,
    userB: string,
    limit: number,
    beforeIso?: string
  ): Promise<ChatMessage[]> {
    await this.ensureFriends(userA, userB);

    const params: any[] = [userA, userB];
    let whereExtra = '';
    if (beforeIso) {
      params.push(beforeIso);
      whereExtra = `AND created_at < $3`;
    }

    const result = await this.pool.query(
      `SELECT id, sender_id, receiver_id, body, is_read, created_at
         FROM chat_messages
        WHERE ((sender_id = $1 AND receiver_id = $2)
            OR (sender_id = $2 AND receiver_id = $1))
              ${whereExtra}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1}`,
      [...params, limit]
    );
    return result.rows.reverse();
  }

  /**
   * List one's conversations: every friend who's exchanged messages with
   * the current user, plus the last message and unread count.
   */
  async getConversations(userId: string): Promise<ConversationSummary[]> {
    const rows = await this.pool.query(
      `WITH partners AS (
         SELECT CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS friend_id,
                MAX(created_at) AS last_message_at
           FROM chat_messages
          WHERE sender_id = $1 OR receiver_id = $1
          GROUP BY friend_id
       ),
       last_msg AS (
         SELECT DISTINCT ON (
                  CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END
                )
                CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS friend_id,
                body
           FROM chat_messages
          WHERE sender_id = $1 OR receiver_id = $1
          ORDER BY
                CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END,
                created_at DESC
       ),
       unread AS (
         SELECT sender_id AS friend_id, COUNT(*)::int AS n
           FROM chat_messages
          WHERE receiver_id = $1 AND is_read = false
          GROUP BY sender_id
       )
       SELECT p.friend_id,
              u.username, u.avatar_url, u.level,
              lm.body AS last_message,
              p.last_message_at,
              COALESCE(un.n, 0) AS unread_count
         FROM partners p
         INNER JOIN users u ON u.id = p.friend_id AND u.deleted_at IS NULL
         LEFT JOIN last_msg lm ON lm.friend_id = p.friend_id
         LEFT JOIN unread   un ON un.friend_id = p.friend_id
         ORDER BY p.last_message_at DESC`,
      [userId]
    );
    return rows.rows;
  }

  /**
   * Mark every message *from `friendId` to `userId`* as read.
   */
  async markRead(userId: string, friendId: string): Promise<number> {
    const result = await this.pool.query(
      `UPDATE chat_messages SET is_read = true
        WHERE receiver_id = $1 AND sender_id = $2 AND is_read = false`,
      [userId, friendId]
    );
    return result.rowCount || 0;
  }

  /**
   * Total unread count for the bell-style indicator.
   */
  async unreadCount(userId: string): Promise<number> {
    const r = await this.pool.query(
      'SELECT COUNT(*)::int AS n FROM chat_messages WHERE receiver_id = $1 AND is_read = false',
      [userId]
    );
    return r.rows[0]?.n ?? 0;
  }
}

export const chatService = new ChatService();
