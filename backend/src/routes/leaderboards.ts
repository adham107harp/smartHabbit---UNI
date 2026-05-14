import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { socialService } from '../services/SocialService';

const router = Router();

/**
 * GET /api/leaderboards/global - Global rankings (top 100 by XP)
 */
router.get('/global', async (_req: AuthRequest, res: Response) => {
  try {
    const leaderboard = await socialService.getGlobalLeaderboard();
    res.json({ success: true, data: { leaderboard } });
  } catch (error) {
    console.error('Get global leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leaderboard' });
  }
});

/**
 * GET /api/leaderboards/friends - Friends rankings (authenticated user's friends)
 */
router.get('/friends', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const leaderboard = await socialService.getFriendsLeaderboard(req.userId!);
    res.json({ success: true, data: { leaderboard } });
  } catch (error) {
    console.error('Get friends leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leaderboard' });
  }
});

/**
 * GET /api/leaderboards/weekly - Weekly rankings (XP earned this week)
 */
router.get('/weekly', async (_req: AuthRequest, res: Response) => {
  try {
    const leaderboard = await socialService.getWeeklyLeaderboard();
    res.json({ success: true, data: { leaderboard } });
  } catch (error) {
    console.error('Get weekly leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leaderboard' });
  }
});

export default router;
