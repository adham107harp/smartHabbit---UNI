import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { db } from '../config/database';
import { gamificationEngine } from '../services/GamificationEngine';
import { formatUserResponse } from '../utils/auth';
import { validateBody } from '../middleware/validation';

const router = Router();

/**
 * GET /api/users/me - Get current user profile
 */
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await db.queryOne(
      'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL',
      [req.userId]
    );

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({
      success: true,
      data: { user: formatUserResponse(user) }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

/**
 * PUT /api/users/me - Update current user profile
 */
router.put(
  '/me',
  authMiddleware,
  validateBody({
    username: { type: 'string', minLength: 3, maxLength: 50 },
    avatar_url: { type: 'string' }
  }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { username, avatar_url } = req.body;

      // Check if username is taken
      if (username) {
        const existing = await db.queryOne(
          'SELECT id FROM users WHERE username = $1 AND id != $2',
          [username, req.userId]
        );

        if (existing) {
          res.status(409).json({ success: false, message: 'Username already taken' });
          return;
        }
      }

      const updates = [];
      const values: any[] = [req.userId];
      let paramCount = 2;

      if (username) {
        updates.push(`username = $${paramCount++}`);
        values.push(username);
      }
      if (avatar_url) {
        updates.push(`avatar_url = $${paramCount++}`);
        values.push(avatar_url);
      }

      updates.push(`updated_at = NOW()`);

      const user = await db.queryOne(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
        values
      );

      res.json({
        success: true,
        data: { user: formatUserResponse(user) }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
  }
);

/**
 * GET /api/users/search?q=username - Search users by username (case-insensitive)
 * Excludes the current user; returns at most 20 results.
 */
router.get('/search', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      res.json({ success: true, data: { users: [] } });
      return;
    }
    const users = await db.query(
      `SELECT id, username, avatar_url, level, xp, current_streak
         FROM users
        WHERE deleted_at IS NULL
          AND id <> $1
          AND username ILIKE $2
        ORDER BY username
        LIMIT 20`,
      [req.userId, `%${q}%`]
    );
    res.json({ success: true, data: { users } });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ success: false, message: 'Search failed' });
  }
});

/**
 * GET /api/users/:id/stats - Get user stats
 */
router.get('/:id/stats', async (req: AuthRequest, res: Response) => {
  try {
    const stats = await gamificationEngine.getUserStats(req.params.id);

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(404).json({ success: false, message: 'User not found' });
  }
});

/**
 * DELETE /api/users/me - Soft delete account (optional)
 */
router.delete('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await db.query(
      'UPDATE users SET deleted_at = NOW() WHERE id = $1',
      [req.userId]
    );

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete account' });
  }
});

export default router;
