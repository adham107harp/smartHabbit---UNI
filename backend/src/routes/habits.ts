import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { db } from '../config/database';
import { gamificationEngine } from '../services/GamificationEngine';
import { streakService } from '../services/StreakService';
import { badgeService } from '../services/BadgeService';
import { challengeService } from '../services/ChallengeService';
import { validateBody } from '../middleware/validation';

const router = Router();

/**
 * GET /api/habits - List user's habits
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const habits = await db.query(
      'SELECT * FROM habits WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC',
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
 * GET /api/habits/:id - Get single habit
 */
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const habit = await db.queryOne(
      'SELECT * FROM habits WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
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
      const { name, goal_type, difficulty, target_value, description } = req.body;

      const habit = await db.queryOne(
        `INSERT INTO habits (user_id, name, description, goal_type, difficulty, target_value, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING *`,
        [req.userId, name, description || null, goal_type, difficulty, target_value || 1]
      );

      res.status(201).json({
        success: true,
        data: { habit }
      });
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
    target_value: { type: 'number' }
  }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, is_active, target_value } = req.body;

      // Verify ownership
      const habit = await db.queryOne(
        'SELECT * FROM habits WHERE id = $1 AND user_id = $2',
        [req.params.id, req.userId]
      );

      if (!habit) {
        res.status(404).json({ success: false, message: 'Habit not found' });
        return;
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
 * POST /api/habits/:id/log - Log habit completion
 */
router.post(
  '/:id/log',
  authMiddleware,
  validateBody({
    value: { required: true, type: 'number' }
  }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { value } = req.body;

      // Process habit completion
      const processed = await gamificationEngine.processHabitCompletion(
        req.userId!,
        req.params.id,
        value
      );

      // Update streak
      const streakUpdate = await streakService.updateStreak(req.userId!);

      // Check for badges
      const awardedBadges = await badgeService.checkAndAwardBadges(req.userId!);

      // Update challenges
      const completedChallenges = await challengeService.updateChallengeProgress(
        req.userId!,
        req.params.id
      );

      res.json({
        success: true,
        data: {
          habitCompletion: processed,
          streak: streakUpdate,
          badgesEarned: awardedBadges,
          challengesCompleted: completedChallenges
        }
      });
    } catch (error: any) {
      console.error('Log habit error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to log habit'
      });
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
