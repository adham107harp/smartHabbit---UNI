import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { socialService } from '../services/SocialService';

const router = Router();

/**
 * GET /api/friends - List friends
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const friends = await socialService.getUserFriends(req.userId!);

    res.json({
      success: true,
      data: { friends }
    });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch friends' });
  }
});

/**
 * GET /api/friends/requests - Get pending friend requests
 */
router.get('/requests/pending', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const requests = await socialService.getPendingRequests(req.userId!);

    res.json({
      success: true,
      data: { requests }
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch requests' });
  }
});

/**
 * POST /api/friends/request/:id - Send friend request
 */
router.post(
  '/request/:id',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      await socialService.sendFriendRequest(req.userId!, req.params.id);

      res.status(201).json({
        success: true,
        message: 'Friend request sent'
      });
    } catch (error: any) {
      console.error('Send request error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to send request'
      });
    }
  }
);

/**
 * PUT /api/friends/:id/accept - Accept a pending friend request.
 * :id is the friends-row id from getPendingRequests.
 */
router.put('/:id/accept', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const ok = await socialService.acceptFriendRequest(req.userId!, req.params.id);
    if (!ok) {
      res.status(404).json({
        success: false,
        code: 'FRIEND_REQUEST_NOT_FOUND',
        message: 'This request was already handled or no longer exists.'
      });
      return;
    }
    res.json({ success: true, message: 'Friend request accepted' });
  } catch (error: any) {
    console.error('Accept request error:', error);
    res.status(500).json({ success: false, message: 'Failed to accept request' });
  }
});

/**
 * PUT /api/friends/:id/decline - Decline a pending friend request.
 */
router.put('/:id/decline', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const ok = await socialService.declineFriendRequest(req.userId!, req.params.id);
    if (!ok) {
      res.status(404).json({
        success: false,
        code: 'FRIEND_REQUEST_NOT_FOUND',
        message: 'This request was already handled or no longer exists.'
      });
      return;
    }
    res.json({ success: true, message: 'Friend request declined' });
  } catch (error) {
    console.error('Decline request error:', error);
    res.status(500).json({ success: false, message: 'Failed to decline request' });
  }
});

/**
 * DELETE /api/friends/:id - Remove an accepted friend.
 * :id is the friends-row id from getUserFriends.
 */
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const ok = await socialService.removeFriend(req.userId!, req.params.id);
    if (!ok) {
      res.status(404).json({
        success: false,
        code: 'FRIENDSHIP_NOT_FOUND',
        message: 'That friend connection no longer exists.'
      });
      return;
    }
    res.json({ success: true, message: 'Friend removed' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove friend' });
  }
});

/**
 * POST /api/friends/:id/block - Block user
 */
router.post('/:id/block', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await socialService.blockUser(req.userId!, req.params.id);

    res.json({
      success: true,
      message: 'User blocked'
    });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ success: false, message: 'Failed to block user' });
  }
});

export default router;
