/**
 * /api/admin/*
 *
 * Every endpoint here is gated by authMiddleware + requireAdmin. A 403
 * (ADMIN_ONLY) is returned for anyone whose user_row.is_admin is false
 * AND whose email isn't in the ADMIN_EMAILS env allowlist.
 *
 * Surfaces:
 *   - GET    /stats              KPIs for the dashboard tab
 *   - GET    /users              paginated user list (with search)
 *   - GET    /users/:id          one user, full record
 *   - PUT    /users/:id          edit username / xp / coins / level / streaks / is_admin
 *   - DELETE /users/:id          soft-delete account
 *   - POST   /users/:id/award-badge   { badge_id } → INSERT user_badges
 *   - POST   /users/:id/notify        { title, message, type? }
 *   - POST   /badges             create badge
 *   - PUT    /badges/:id         edit badge
 *   - DELETE /badges/:id         delete badge
 *   - POST   /challenges         create challenge
 *   - PUT    /challenges/:id     edit
 *   - DELETE /challenges/:id     delete
 *   - POST   /shop               create shop item
 *   - PUT    /shop/:id           edit
 *   - DELETE /shop/:id           delete
 *   - POST   /broadcast          { title, message } → notification fan-out to all
 */

import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { db } from '../config/database';

const router = Router();
router.use(authMiddleware, requireAdmin);

/* ------------------------------------------------------------------ */
/* Dashboard                                                          */
/* ------------------------------------------------------------------ */

router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const totalUsers      = await db.queryOne('SELECT COUNT(*)::int AS n FROM users WHERE deleted_at IS NULL');
    const activeToday     = await db.queryOne(`SELECT COUNT(DISTINCT user_id)::int AS n
                                                  FROM habit_logs
                                                 WHERE logged_date = CURRENT_DATE`);
    const totalHabits     = await db.queryOne('SELECT COUNT(*)::int AS n FROM habits WHERE deleted_at IS NULL');
    const totalLogs       = await db.queryOne('SELECT COUNT(*)::int AS n FROM habit_logs');
    const newUsersWeek    = await db.queryOne(`SELECT COUNT(*)::int AS n
                                                  FROM users
                                                 WHERE created_at > NOW() - INTERVAL '7 days'`);
    const topUsers = await db.query(
      `SELECT id, username, level, xp, coins, current_streak
         FROM users
        WHERE deleted_at IS NULL
        ORDER BY xp DESC
        LIMIT 10`
    );
    res.json({
      success: true,
      data: {
        stats: {
          users:           totalUsers.n,
          active_today:    activeToday.n,
          total_habits:    totalHabits.n,
          total_logs:      totalLogs.n,
          new_users_week:  newUsersWeek.n
        },
        top_users: topUsers
      }
    });
  } catch (e) {
    console.error('admin stats error:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

/* ------------------------------------------------------------------ */
/* Users                                                              */
/* ------------------------------------------------------------------ */

router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
    const page  = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const offset = (page - 1) * limit;

    const params: any[] = [];
    let where = 'WHERE deleted_at IS NULL';
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (username ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }
    params.push(limit, offset);

    const users = await db.query(
      `SELECT id, username, email, level, xp, coins, current_streak, max_streak,
              is_admin, last_active_at, warn_count, created_at, onboarded_at
         FROM users ${where}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const totalRow = await db.queryOne(
      `SELECT COUNT(*)::int AS n FROM users ${where}`,
      q ? [`%${q}%`] : []
    );
    res.json({
      success: true,
      data: { users, total: totalRow.n, page, limit }
    });
  } catch (e) {
    console.error('admin list users error:', e);
    res.status(500).json({ success: false, message: 'Failed to list users' });
  }
});

router.get('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const u = await db.queryOne(
      `SELECT id, username, email, level, xp, coins, current_streak, max_streak,
              is_admin, last_active_at, warn_count, streak_shields_count,
              xp_boost_expires_at, coin_boost_expires_at,
              avatar_url, created_at, onboarded_at, interests
         FROM users
        WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!u) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.json({ success: true, data: { user: u } });
  } catch (e) {
    console.error('admin get user error:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
});

router.put('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const allowed = ['username', 'xp', 'coins', 'level', 'current_streak', 'max_streak', 'is_admin'];
    const fields: string[] = [];
    const values: any[] = [req.params.id];
    for (const key of allowed) {
      if (req.body[key] === undefined) continue;
      values.push(req.body[key]);
      fields.push(`${key} = $${values.length}`);
    }
    if (fields.length === 0) {
      res.status(400).json({ success: false, message: 'Nothing to update' });
      return;
    }
    fields.push('updated_at = NOW()');
    const updated = await db.queryOne(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      values
    );
    if (!updated) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    delete updated.password_hash;
    res.json({ success: true, data: { user: updated } });
  } catch (e) {
    console.error('admin update user error:', e);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const r = await db.query(
      `UPDATE users SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [req.params.id]
    );
    if (!r.length) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.json({ success: true });
  } catch (e) {
    console.error('admin delete user error:', e);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

router.post('/users/:id/award-badge', async (req: AuthRequest, res: Response) => {
  try {
    const badgeId = req.body.badge_id;
    if (!badgeId) {
      res.status(400).json({ success: false, message: 'badge_id is required' });
      return;
    }
    await db.query(
      `INSERT INTO user_badges (user_id, badge_id, earned_at)
       VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
      [req.params.id, badgeId]
    );
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, related_badge_id)
       SELECT $1, '🏆 Badge granted', 'An admin awarded you the "' || b.name || '" badge!', 'badge_earned', $2
         FROM badges b WHERE b.id = $2`,
      [req.params.id, badgeId]
    );
    res.status(201).json({ success: true });
  } catch (e) {
    console.error('admin award-badge error:', e);
    res.status(500).json({ success: false, message: 'Failed to award badge' });
  }
});

router.post('/users/:id/notify', async (req: AuthRequest, res: Response) => {
  try {
    const title   = String(req.body.title   || 'Admin').slice(0, 100);
    const message = String(req.body.message || '').trim();
    const type    = String(req.body.type    || 'general');
    if (!message) {
      res.status(400).json({ success: false, message: 'message is required' });
      return;
    }
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)`,
      [req.params.id, title, message, type]
    );
    res.status(201).json({ success: true });
  } catch (e) {
    console.error('admin notify error:', e);
    res.status(500).json({ success: false, message: 'Failed to send notification' });
  }
});

/* ------------------------------------------------------------------ */
/* Catalog: badges, challenges, shop                                  */
/* ------------------------------------------------------------------ */

router.post('/badges', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, criteria_type, criteria_value, bonus_xp, bonus_coins } = req.body;
    const row = await db.queryOne(
      `INSERT INTO badges (name, description, criteria_type, criteria_value, bonus_xp, bonus_coins)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, description || '', criteria_type, criteria_value, bonus_xp ?? 0, bonus_coins ?? 0]
    );
    res.status(201).json({ success: true, data: { badge: row } });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message || 'Failed to create badge' });
  }
});

router.put('/badges/:id', async (req: AuthRequest, res: Response) => {
  try {
    const allowed = ['name', 'description', 'criteria_type', 'criteria_value', 'bonus_xp', 'bonus_coins'];
    const fields: string[] = []; const vals: any[] = [req.params.id];
    for (const k of allowed) if (req.body[k] !== undefined) { vals.push(req.body[k]); fields.push(`${k} = $${vals.length}`); }
    if (!fields.length) { res.status(400).json({ success: false, message: 'Nothing to update' }); return; }
    const row = await db.queryOne(`UPDATE badges SET ${fields.join(', ')} WHERE id = $1 RETURNING *`, vals);
    if (!row) { res.status(404).json({ success: false, message: 'Badge not found' }); return; }
    res.json({ success: true, data: { badge: row } });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message || 'Failed to update badge' });
  }
});

router.delete('/badges/:id', async (req: AuthRequest, res: Response) => {
  try {
    const r = await db.query('DELETE FROM badges WHERE id = $1 RETURNING id', [req.params.id]);
    if (!r.length) { res.status(404).json({ success: false, message: 'Badge not found' }); return; }
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message || 'Failed to delete badge' });
  }
});

router.post('/challenges', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, start_date, end_date, target_value, reward_xp, reward_coins } = req.body;
    const row = await db.queryOne(
      `INSERT INTO challenges (name, description, start_date, end_date, target_value, reward_xp, reward_coins)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, description || '', start_date, end_date, target_value, reward_xp ?? 100, reward_coins ?? 50]
    );
    res.status(201).json({ success: true, data: { challenge: row } });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message || 'Failed to create challenge' });
  }
});

router.put('/challenges/:id', async (req: AuthRequest, res: Response) => {
  try {
    const allowed = ['name', 'description', 'start_date', 'end_date', 'target_value', 'reward_xp', 'reward_coins', 'is_active'];
    const fields: string[] = []; const vals: any[] = [req.params.id];
    for (const k of allowed) if (req.body[k] !== undefined) { vals.push(req.body[k]); fields.push(`${k} = $${vals.length}`); }
    if (!fields.length) { res.status(400).json({ success: false, message: 'Nothing to update' }); return; }
    const row = await db.queryOne(`UPDATE challenges SET ${fields.join(', ')} WHERE id = $1 RETURNING *`, vals);
    if (!row) { res.status(404).json({ success: false, message: 'Challenge not found' }); return; }
    res.json({ success: true, data: { challenge: row } });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message || 'Failed to update challenge' });
  }
});

router.delete('/challenges/:id', async (req: AuthRequest, res: Response) => {
  try {
    const r = await db.query('DELETE FROM challenges WHERE id = $1 RETURNING id', [req.params.id]);
    if (!r.length) { res.status(404).json({ success: false, message: 'Challenge not found' }); return; }
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message || 'Failed to delete challenge' });
  }
});

router.post('/shop', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, cost, item_type, meta_data } = req.body;
    const row = await db.queryOne(
      `INSERT INTO reward_shop (name, description, cost, item_type, meta_data, is_available)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
      [name, description || '', cost, item_type, meta_data || {}]
    );
    res.status(201).json({ success: true, data: { item: row } });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message || 'Failed to create shop item' });
  }
});

router.put('/shop/:id', async (req: AuthRequest, res: Response) => {
  try {
    const allowed = ['name', 'description', 'cost', 'item_type', 'meta_data', 'is_available'];
    const fields: string[] = []; const vals: any[] = [req.params.id];
    for (const k of allowed) if (req.body[k] !== undefined) { vals.push(req.body[k]); fields.push(`${k} = $${vals.length}`); }
    if (!fields.length) { res.status(400).json({ success: false, message: 'Nothing to update' }); return; }
    const row = await db.queryOne(`UPDATE reward_shop SET ${fields.join(', ')} WHERE id = $1 RETURNING *`, vals);
    if (!row) { res.status(404).json({ success: false, message: 'Shop item not found' }); return; }
    res.json({ success: true, data: { item: row } });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message || 'Failed to update shop item' });
  }
});

router.delete('/shop/:id', async (req: AuthRequest, res: Response) => {
  try {
    const r = await db.query('DELETE FROM reward_shop WHERE id = $1 RETURNING id', [req.params.id]);
    if (!r.length) { res.status(404).json({ success: false, message: 'Shop item not found' }); return; }
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message || 'Failed to delete shop item' });
  }
});

/* ------------------------------------------------------------------ */
/* Broadcast notification to every active user                        */
/* ------------------------------------------------------------------ */

router.post('/broadcast', async (req: AuthRequest, res: Response) => {
  try {
    const title   = String(req.body.title   || '📣 Announcement').slice(0, 100);
    const message = String(req.body.message || '').trim();
    if (!message) {
      res.status(400).json({ success: false, message: 'message is required' });
      return;
    }
    const r = await db.query(
      `INSERT INTO notifications (user_id, title, message, type)
       SELECT id, $1, $2, 'admin_broadcast'
         FROM users WHERE deleted_at IS NULL
       RETURNING id`,
      [title, message]
    );
    res.status(201).json({ success: true, data: { delivered: r.length } });
  } catch (e: any) {
    console.error('admin broadcast error:', e);
    res.status(500).json({ success: false, message: 'Failed to broadcast' });
  }
});

export default router;
