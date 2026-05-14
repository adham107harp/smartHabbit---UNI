import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { challengeService } from '../services/ChallengeService';
import { validateBody } from '../middleware/validation';

const router = Router();

/**
 * GET /api/challenges - List active challenges
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const challenges = await challengeService.getActiveChallenges();

    res.json({
      success: true,
      data: { challenges }
    });
  } catch (error) {
    console.error('Get challenges error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch challenges' });
  }
});

/**
 * POST /api/challenges/:id/join - Join a challenge
 */
router.post('/:id/join', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await challengeService.joinChallenge(req.userId!, req.params.id);

    res.status(201).json({
      success: true,
      message: 'Challenge joined successfully'
    });
  } catch (error: any) {
    console.error('Join challenge error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to join challenge'
    });
  }
});

/**
 * GET /api/users/me/challenges - Get user's active challenges
 */
router.get('/user/active', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const challenges = await challengeService.getUserActiveChallenges(req.userId!);

    res.json({
      success: true,
      data: { challenges }
    });
  } catch (error) {
    console.error('Get user challenges error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch challenges' });
  }
});

/**
 * GET /api/challenges/:id/leaderboard - Challenge rankings
 */
router.get('/:id/leaderboard', async (req: AuthRequest, res: Response) => {
  try {
    const leaderboard = await challengeService.getChallengeLeaderboard(req.params.id);

    res.json({
      success: true,
      data: { leaderboard }
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leaderboard' });
  }
});

/**
 * DELETE /api/challenges/:id/leave - Leave a challenge
 */
router.delete('/:id/leave', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await challengeService.leaveChallenge(req.userId!, req.params.id);

    res.json({
      success: true,
      message: 'Left challenge successfully'
    });
  } catch (error) {
    console.error('Leave challenge error:', error);
    res.status(500).json({ success: false, message: 'Failed to leave challenge' });
  }
});

export default router;
