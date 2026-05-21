import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { db } from '../config/database';
import { gamificationEngine } from '../services/GamificationEngine';
import { formatUserResponse } from '../utils/auth';
import { validateBody } from '../middleware/validation';
import { avatarUpload, UPLOAD_PATHS, verifyImageMagic } from '../middleware/upload';

const router = Router();

/**
 * Loads a user row plus their currently equipped theme + frame from the shop.
 * This is the canonical "/me" shape the frontend depends on.
 */
async function fetchMe(userId: string): Promise<any> {
  const row = await db.queryOne(
    `SELECT
       u.*,
       to_jsonb(t.*) AS active_theme_row,
       to_jsonb(f.*) AS active_avatar_frame_row
     FROM users u
     LEFT JOIN reward_shop t ON t.id = u.active_theme_id
     LEFT JOIN reward_shop f ON f.id = u.active_avatar_frame_id
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [userId]
  );
  if (!row) return null;
  const { active_theme_row, active_avatar_frame_row, ...rest } = row;
  const user = formatUserResponse(rest);
  user.active_theme = active_theme_row || null;
  user.active_avatar_frame = active_avatar_frame_row || null;
  return user;
}

/**
 * GET /api/users/me - Current user, with equipped theme & avatar frame joined in.
 */
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await fetchMe(req.userId!);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.json({ success: true, data: { user } });
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
      if (avatar_url !== undefined) {
        updates.push(`avatar_url = $${paramCount++}`);
        values.push(avatar_url);
      }

      updates.push(`updated_at = NOW()`);

      await db.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $1`,
        values
      );

      const user = await fetchMe(req.userId!);
      res.json({ success: true, data: { user } });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
  }
);

/**
 * POST /api/users/me/avatar — Upload an avatar image (PNG/JPG/WebP, max 2 MB).
 * Returns the public URL the frontend should use.
 */
router.post(
  '/me/avatar',
  authMiddleware,
  (req, res, next) => {
    avatarUpload.single('avatar')(req, res, (err: any) => {
      if (err) {
        const msg = err.code === 'LIMIT_FILE_SIZE'
          ? 'Image too large. Max 2 MB.'
          : err.message || 'Upload failed.';
        res.status(400).json({ success: false, code: 'UPLOAD_FAILED', message: msg });
        return;
      }
      next();
    });
  },
  async (req: AuthRequest, res: Response) => {
    try {
      const file = (req as any).file;
      if (!file) {
        res.status(400).json({ success: false, message: 'No file uploaded' });
        return;
      }

      // Magic-byte verification: multer's MIME check is header-only and
      // trivially spoofable. This reads the actual file bytes and rejects
      // anything that isn't a real PNG/JPEG/WebP (and deletes the file).
      try {
        verifyImageMagic(file.path);
      } catch (e: any) {
        res.status(400).json({
          success: false,
          code: 'UPLOAD_INVALID_IMAGE',
          message: e?.message || 'Uploaded file is not a valid image.'
        });
        return;
      }

      const publicPath = `/uploads/avatars/${file.filename}`;

      // Best-effort: remove the previous avatar file if it was one of ours
      const prev = await db.queryOne(
        'SELECT avatar_url FROM users WHERE id = $1',
        [req.userId]
      );
      if (prev?.avatar_url?.startsWith('/uploads/avatars/')) {
        const prevPath = path.join(UPLOAD_PATHS.avatars, path.basename(prev.avatar_url));
        fs.promises.unlink(prevPath).catch(() => {});
      }

      await db.query(
        'UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2',
        [publicPath, req.userId]
      );

      const user = await fetchMe(req.userId!);
      res.json({ success: true, data: { user, avatar_url: publicPath } });
    } catch (error) {
      console.error('Avatar upload error:', error);
      res.status(500).json({ success: false, message: 'Failed to save avatar' });
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
