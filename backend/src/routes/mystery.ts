import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { db } from '../config/database';

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/mystery/pending — every unopened mystery box for the current user.
 */
router.get('/pending', async (req: AuthRequest, res: Response) => {
  try {
    const boxes = await db.query(
      `SELECT id, level_awarded, created_at
         FROM mystery_boxes
        WHERE user_id = $1 AND opened_at IS NULL
        ORDER BY level_awarded ASC`,
      [req.userId]
    );
    res.json({ success: true, data: { boxes } });
  } catch (e) {
    console.error('mystery pending error:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch mystery boxes' });
  }
});

/**
 * POST /api/mystery/:id/open — roll the reward, persist it, return it.
 *
 * Rolls (weighted 50/25/25):
 *   - 50% coins:   100 × level/10 coins
 *   - 25% theme:   random unowned theme → record purchase
 *   - 25% frame:   random unowned avatar_item → record purchase
 *   - fallback to coins if the chosen pool is empty
 */
router.post('/:id/open', async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.transaction(async (client) => {
      // Lock + load the box
      const boxRow = (await client.query(
        `SELECT id, user_id, level_awarded, opened_at
           FROM mystery_boxes
          WHERE id = $1 AND user_id = $2
          FOR UPDATE`,
        [req.params.id, req.userId]
      )).rows[0];

      if (!boxRow) throw new Error('NOT_FOUND');
      if (boxRow.opened_at) throw new Error('ALREADY_OPENED');

      const tier = Math.max(1, Math.floor(boxRow.level_awarded / 10));
      const roll = Math.random();
      let kind: 'coins' | 'theme' | 'frame' = 'coins';
      if (roll < 0.50) kind = 'coins';
      else if (roll < 0.75) kind = 'theme';
      else kind = 'frame';

      let rewardValue: any;

      // Helper: pick a random unowned shop item of the given type
      async function pickUnowned(itemType: 'theme' | 'avatar_item'): Promise<any | null> {
        const row = (await client.query(
          `SELECT id, name, cost, meta_data
             FROM reward_shop
            WHERE item_type = $1
              AND is_available = true
              AND id NOT IN (SELECT item_id FROM purchases WHERE user_id = $2)
            ORDER BY RANDOM()
            LIMIT 1`,
          [itemType, req.userId]
        )).rows[0];
        return row || null;
      }

      if (kind !== 'coins') {
        const item = await pickUnowned(kind === 'theme' ? 'theme' : 'avatar_item');
        if (item) {
          await client.query(
            `INSERT INTO purchases (user_id, item_id, cost_paid, purchased_at)
             VALUES ($1, $2, 0, NOW())`,
            [req.userId, item.id]
          );
          rewardValue = { item_id: item.id, name: item.name, meta_data: item.meta_data };
        } else {
          // Pool exhausted — fall back to coins.
          kind = 'coins';
        }
      }

      if (kind === 'coins') {
        const coins = 100 * tier;
        await client.query(
          'UPDATE users SET coins = coins + $1, updated_at = NOW() WHERE id = $2',
          [coins, req.userId]
        );
        rewardValue = { coins };
      }

      await client.query(
        `UPDATE mystery_boxes
            SET opened_at = NOW(), reward_kind = $1, reward_value = $2
          WHERE id = $3`,
        [kind, rewardValue, boxRow.id]
      );

      await client.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, '🎁 Mystery Box Opened!',
                 'You unwrapped a ' || $2 || ' reward from your level ' || $3 || ' box!',
                 'mystery_box_opened')`,
        [req.userId, kind, boxRow.level_awarded]
      );

      return { kind, value: rewardValue, level_awarded: boxRow.level_awarded };
    });

    res.json({ success: true, data: { reward: result } });
  } catch (e: any) {
    if (e.message === 'NOT_FOUND') {
      res.status(404).json({ success: false, code: 'MYSTERY_NOT_FOUND', message: 'Mystery box not found.' });
      return;
    }
    if (e.message === 'ALREADY_OPENED') {
      res.status(409).json({ success: false, code: 'MYSTERY_ALREADY_OPENED', message: 'This box was already opened.' });
      return;
    }
    console.error('mystery open error:', e);
    res.status(500).json({ success: false, message: 'Failed to open mystery box' });
  }
});

export default router;
