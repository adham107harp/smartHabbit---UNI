import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { badgeService } from '../services/BadgeService';

const router = Router();

/**
 * GET /api/badges - List all badges
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const badges = await badgeService.getAllBadges();

    res.json({
      success: true,
      data: { badges }
    });
  } catch (error) {
    console.error('Get badges error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch badges' });
  }
});

/**
 * GET /api/users/me/badges - Get user's earned badges
 */
router.get('/user/earned', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const badges = await badgeService.getUserBadges(req.userId!);

    res.json({
      success: true,
      data: { badges }
    });
  } catch (error) {
    console.error('Get user badges error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch badges' });
  }
});

/**
 * GET /api/users/me/next-badges - Show upcoming badges
 */
router.get('/user/next', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const badges = await badgeService.getUserNextBadges(req.userId!);

    res.json({
      success: true,
      data: { badges }
    });
  } catch (error) {
    console.error('Get next badges error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch next badges' });
  }
});

export default router;
