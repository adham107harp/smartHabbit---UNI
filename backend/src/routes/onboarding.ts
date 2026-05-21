import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { db } from '../config/database';
import { INTERESTS, TEMPLATES, recommendFor, templateById, Interest } from '../services/HabitTemplateService';

const router = Router();
router.use(authMiddleware);

/** GET /api/onboarding/interests — list of selectable interests. */
router.get('/interests', (_req, res: Response) => {
  res.json({ success: true, data: { interests: INTERESTS } });
});

/**
 * GET /api/onboarding/recommend?interests=health,fitness
 * Returns up to 6 habit templates matching the requested interests.
 * If no interests are provided, returns the first 6 templates.
 */
router.get('/recommend', (req: AuthRequest, res: Response) => {
  const raw = String(req.query.interests || '');
  const valid = new Set(INTERESTS.map(i => i.id));
  const list = raw.split(',').map(s => s.trim()).filter(s => valid.has(s as Interest)) as Interest[];
  const templates = recommendFor(list, 6);
  res.json({ success: true, data: { templates } });
});

/**
 * GET /api/onboarding/status — has the current user completed onboarding?
 * Used by welcome.html so re-opening the page redirects to the dashboard.
 */
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const row = await db.queryOne(
      'SELECT onboarded_at, interests FROM users WHERE id = $1 AND deleted_at IS NULL',
      [req.userId]
    );
    res.json({
      success: true,
      data: {
        onboarded: !!row?.onboarded_at,
        interests: row?.interests || []
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch onboarding status' });
  }
});

/**
 * POST /api/onboarding/complete
 * Body: { interests: string[], template_ids: string[] }
 *   - Saves interests on the user record.
 *   - Creates one habit per selected template (in a single transaction).
 *   - Sets users.onboarded_at = NOW().
 */
router.post('/complete', async (req: AuthRequest, res: Response) => {
  try {
    const validInterests = new Set(INTERESTS.map(i => i.id));
    const interests = (Array.isArray(req.body.interests) ? req.body.interests : [])
      .map(String)
      .filter((s: string) => validInterests.has(s as Interest));
    const ids = (Array.isArray(req.body.template_ids) ? req.body.template_ids : []).map(String);

    const created: any[] = [];
    await db.transaction(async (client) => {
      for (const id of ids) {
        const t = templateById(id);
        if (!t) continue;
        const habit = (await client.query(
          `INSERT INTO habits
             (user_id, name, description, goal_type, difficulty, target_value, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)
           RETURNING id, name`,
          [req.userId, t.name, t.description, t.goal_type, t.difficulty, t.target_value]
        )).rows[0];
        created.push(habit);
      }
      await client.query(
        `UPDATE users SET interests = $1, onboarded_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [interests, req.userId]
      );
    });

    res.status(201).json({
      success: true,
      data: { interests, habits_created: created }
    });
  } catch (e) {
    console.error('onboarding complete error:', e);
    res.status(500).json({ success: false, message: 'Failed to complete onboarding' });
  }
});

export default router;
