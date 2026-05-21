import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { db } from '../config/database';
import { gamificationEngine } from '../services/GamificationEngine';
import { streakService } from '../services/StreakService';
import { badgeService } from '../services/BadgeService';
import { challengeService } from '../services/ChallengeService';
import { validateBody } from '../middleware/validation';
import {
  HttpError,
  NoLogToUndoError,
  UndoWindowExpiredError
} from '../utils/errors';

const router = Router();

const UNDO_WINDOW_MS = 60 * 1000; // 60 seconds — must match the frontend toast timer.

/**
 * GET /api/habits - List user's habits, enriched with today's progress.
 * Each row includes:
 *   today_progress  — SUM(value) on logs for today (number)
 *   is_done_today   — boolean: progress >= target_value
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const habits = await db.query(
      `SELECT h.*,
              COALESCE((
                SELECT SUM(hl.value)
                  FROM habit_logs hl
                 WHERE hl.habit_id = h.id
                   AND hl.user_id  = h.user_id
                   AND hl.logged_date = CURRENT_DATE
              ), 0)::float AS today_progress,
              COALESCE((
                SELECT SUM(hl.value) >= h.target_value
                  FROM habit_logs hl
                 WHERE hl.habit_id = h.id
                   AND hl.user_id  = h.user_id
                   AND hl.logged_date = CURRENT_DATE
              ), false) AS is_done_today
         FROM habits h
        WHERE h.user_id = $1 AND h.deleted_at IS NULL
        ORDER BY h.created_at DESC`,
      [req.userId]
    );

    res.json({
      success: true,
      data: { habits }
    });
  } catch (error) {
    console.error('List habits error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch habits' });
  }
});

/**
 * GET /api/habits/:id - Get single habit (with today_progress + is_done_today).
 */
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const habit = await db.queryOne(
      `SELECT h.*,
              COALESCE((
                SELECT SUM(hl.value)
                  FROM habit_logs hl
                 WHERE hl.habit_id = h.id
                   AND hl.user_id  = h.user_id
                   AND hl.logged_date = CURRENT_DATE
              ), 0)::float AS today_progress,
              COALESCE((
                SELECT SUM(hl.value) >= h.target_value
                  FROM habit_logs hl
                 WHERE hl.habit_id = h.id
                   AND hl.user_id  = h.user_id
                   AND hl.logged_date = CURRENT_DATE
              ), false) AS is_done_today
         FROM habits h
        WHERE h.id = $1 AND h.user_id = $2 AND h.deleted_at IS NULL`,
      [req.params.id, req.userId]
    );
    if (!habit) {
      res.status(404).json({ success: false, message: 'Habit not found' });
      return;
    }
    res.json({ success: true, data: { habit } });
  } catch (error) {
    console.error('Get habit error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch habit' });
  }
});

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normaliseRemindAt(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value);
  if (!TIME_REGEX.test(s)) {
    throw new Error('remind_at must be "HH:MM" 24-hour time.');
  }
  // Force seconds component to 00 so the DB stores a consistent time
  return `${s}:00`;
}

/**
 * POST /api/habits - Create new habit
 */
router.post(
  '/',
  authMiddleware,
  validateBody({
    name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    goal_type: { required: true, enum: ['daily', 'weekly'] },
    difficulty: { required: true, enum: ['easy', 'medium', 'hard'] },
    target_value: { type: 'number' },
    description: { type: 'string' }
  }),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        name, goal_type, difficulty, target_value, description,
        remind_at, reminder_enabled
      } = req.body;

      let normalisedRemind: string | null = null;
      try {
        normalisedRemind = normaliseRemindAt(remind_at);
      } catch (e: any) {
        res.status(400).json({ success: false, message: e.message });
        return;
      }

      const habit = await db.queryOne(
        `INSERT INTO habits
          (user_id, name, description, goal_type, difficulty, target_value, is_active,
           remind_at, reminder_enabled)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)
         RETURNING *`,
        [
          req.userId, name, description || null, goal_type, difficulty,
          target_value || 1, normalisedRemind, !!reminder_enabled
        ]
      );

      res.status(201).json({ success: true, data: { habit } });
    } catch (error) {
      console.error('Create habit error:', error);
      res.status(500).json({ success: false, message: 'Failed to create habit' });
    }
  }
);

/**
 * PUT /api/habits/:id - Update habit
 */
router.put(
  '/:id',
  authMiddleware,
  validateBody({
    name: { type: 'string' },
    is_active: { type: 'boolean' },
    target_value: { type: 'number' },
    reminder_enabled: { type: 'boolean' }
  }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, is_active, target_value, remind_at, reminder_enabled } = req.body;

      // Verify ownership
      const habit = await db.queryOne(
        'SELECT * FROM habits WHERE id = $1 AND user_id = $2',
        [req.params.id, req.userId]
      );

      if (!habit) {
        res.status(404).json({ success: false, message: 'Habit not found' });
        return;
      }

      let normalisedRemind: string | null | undefined = undefined;
      if (remind_at !== undefined) {
        try {
          normalisedRemind = normaliseRemindAt(remind_at);
        } catch (e: any) {
          res.status(400).json({ success: false, message: e.message });
          return;
        }
      }

      const updates = [];
      const values: any[] = [req.params.id, req.userId];
      let paramCount = 3;

      if (name) {
        updates.push(`name = $${paramCount++}`);
        values.push(name);
      }
      if (is_active !== undefined) {
        updates.push(`is_active = $${paramCount++}`);
        values.push(is_active);
      }
      if (target_value !== undefined) {
        updates.push(`target_value = $${paramCount++}`);
        values.push(target_value);
      }
      if (normalisedRemind !== undefined) {
        updates.push(`remind_at = $${paramCount++}`);
        values.push(normalisedRemind);
      }
      if (reminder_enabled !== undefined) {
        updates.push(`reminder_enabled = $${paramCount++}`);
        values.push(!!reminder_enabled);
      }

      updates.push(`updated_at = NOW()`);

      const updated = await db.queryOne(
        `UPDATE habits SET ${updates.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
        values
      );

      res.json({
        success: true,
        data: { habit: updated }
      });
    } catch (error) {
      console.error('Update habit error:', error);
      res.status(500).json({ success: false, message: 'Failed to update habit' });
    }
  }
);

/**
 * DELETE /api/habits/:id - Soft delete habit
 */
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `UPDATE habits SET deleted_at = NOW() 
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.userId]
    );

    if (result.length === 0) {
      res.status(404).json({ success: false, message: 'Habit not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Habit deleted successfully'
    });
  } catch (error) {
    console.error('Delete habit error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete habit' });
  }
});

/**
 * POST /api/habits/:id/log — Log habit completion
 *
 * v2: All four services share one parent transaction so the entire log
 * is atomic (XP, streak, badges, challenges all commit together or not at all).
 *
 * Duplicate same-day logs are rejected with 409 HABIT_ALREADY_LOGGED.
 */
router.post(
  '/:id/log',
  authMiddleware,
  validateBody({ value: { required: true, type: 'number' } }),
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const habitId = req.params.id;
    const { value } = req.body;

    try {
      const result = await db.transaction(async (client) => {
        const processed = await gamificationEngine.processHabitCompletion(
          userId, habitId, value, client
        );
        const streakUpdate = await streakService.updateStreak(userId, client);
        const awardedBadges = await badgeService.checkAndAwardBadges(userId, client);
        const completedChallenges = await challengeService.updateChallengeProgress(
          userId, habitId, client
        );
        return { processed, streakUpdate, awardedBadges, completedChallenges };
      });

      res.json({
        success: true,
        data: {
          habitCompletion: result.processed,
          streak: result.streakUpdate,
          badgesEarned: result.awardedBadges,
          challengesCompleted: result.completedChallenges
        }
      });
    } catch (error: any) {
      if (error instanceof HttpError) {
        res.status(error.status).json({
          success: false,
          code: error.code,
          message: error.message
        });
        return;
      }
      console.error('Log habit error:', error);
      res.status(500).json({ success: false, message: 'Failed to log habit' });
    }
  }
);

/**
 * DELETE /api/habits/:id/log/last — Undo the most recent log for this habit
 * within the 60-second window. Reverses XP, coins, and (if needed) streak.
 *
 * Badges and challenges keep their changes — un-awarding them is messy and
 * uncommon as a user need.
 */
router.delete(
  '/:id/log/last',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const habitId = req.params.id;

    try {
      const result = await db.transaction(async (client) => {
        const lastLog = await client.query(
          `SELECT id, xp_earned, coins_earned, created_at, logged_date
             FROM habit_logs
            WHERE habit_id = $1 AND user_id = $2
            ORDER BY created_at DESC
            LIMIT 1`,
          [habitId, userId]
        );
        if (lastLog.rows.length === 0) throw new NoLogToUndoError();

        const log = lastLog.rows[0];
        const ageMs = Date.now() - new Date(log.created_at).getTime();
        if (ageMs > UNDO_WINDOW_MS) throw new UndoWindowExpiredError();

        // Delete the log row first
        await client.query('DELETE FROM habit_logs WHERE id = $1', [log.id]);

        // Refund XP / coins; reset level on the new XP total
        await client.query(
          `UPDATE users
              SET xp = GREATEST(0, xp - $1),
                  coins = GREATEST(0, coins - $2),
                  level = FLOOR(SQRT(GREATEST(0, xp - $1) / 100.0)) + 1,
                  updated_at = NOW()
            WHERE id = $3`,
          [log.xp_earned || 0, log.coins_earned || 0, userId]
        );

        // If this was the user's only log today, decrement the streak.
        const otherTodayLogs = await client.query(
          `SELECT 1 FROM habit_logs
            WHERE user_id = $1 AND logged_date = $2 LIMIT 1`,
          [userId, log.logged_date]
        );
        if (otherTodayLogs.rows.length === 0) {
          await client.query(
            `UPDATE users
                SET current_streak = GREATEST(0, current_streak - 1)
              WHERE id = $1`,
            [userId]
          );
        }

        const userAfter = await client.query(
          'SELECT xp, coins, level, current_streak FROM users WHERE id = $1',
          [userId]
        );

        return {
          refunded: { xp: log.xp_earned || 0, coins: log.coins_earned || 0 },
          user: userAfter.rows[0]
        };
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      if (error instanceof HttpError) {
        res.status(error.status).json({
          success: false,
          code: error.code,
          message: error.message
        });
        return;
      }
      console.error('Undo log error:', error);
      res.status(500).json({ success: false, message: 'Failed to undo log' });
    }
  }
);

/**
 * GET /api/habits/:id/history - Get habit logs history
 */
router.get(
  '/:id/history',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const logs = await db.query(
        `SELECT * FROM habit_logs 
         WHERE habit_id = $1 AND user_id = $2
         ORDER BY logged_date DESC
         LIMIT 100`,
        [req.params.id, req.userId]
      );

      res.json({
        success: true,
        data: { logs }
      });
    } catch (error) {
      console.error('Get history error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch history' });
    }
  }
);

export default router;
