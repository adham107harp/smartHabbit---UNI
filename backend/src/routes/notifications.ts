import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { notificationService } from '../services/NotificationService';

const router = Router();

/**
 * GET /api/notifications - Get user notifications
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const unreadOnly = req.query.unread === 'true';
    const limit = parseInt(req.query.limit as string) || 50;

    const notifications = await notificationService.getUserNotifications(
      req.userId!,
      limit,
      unreadOnly
    );

    res.json({
      success: true,
      data: { notifications }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

/**
 * GET /api/notifications/unread/count - Get unread count
 */
router.get('/unread/count', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const count = await notificationService.getUnreadCount(req.userId!);

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ success: false, message: 'Failed to get unread count' });
  }
});

/**
 * PUT /api/notifications/:id/read - Mark as read (must own the notification).
 */
router.put('/:id/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const ok = await notificationService.markAsRead(req.params.id, req.userId!);
    if (!ok) {
      res.status(404).json({ success: false, code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found.' });
      return;
    }
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
});

/**
 * PUT /api/notifications/mark-all-read - Mark all as read
 */
router.put('/mark-all/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const count = await notificationService.markAllAsRead(req.userId!);

    res.json({
      success: true,
      message: `${count} notifications marked as read`,
      data: { count }
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark all as read' });
  }
});

/**
 * DELETE /api/notifications/:id - Delete notification (must own it).
 */
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const ok = await notificationService.deleteNotification(req.params.id, req.userId!);
    if (!ok) {
      res.status(404).json({ success: false, code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found.' });
      return;
    }
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete notification' });
  }
});

/**
 * DELETE /api/notifications - Delete all notifications
 */
router.delete('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const count = await notificationService.deleteAllNotifications(req.userId!);

    res.json({
      success: true,
      message: `${count} notifications deleted`,
      data: { count }
    });
  } catch (error) {
    console.error('Delete all notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete notifications' });
  }
});

export default router;
