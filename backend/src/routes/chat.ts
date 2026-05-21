import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { chatService } from '../services/ChatService';

const router = Router();

router.use(authMiddleware);

/**
 * GET /api/chat/conversations — list of friends I've chatted with.
 */
router.get('/conversations', async (req: AuthRequest, res: Response) => {
  try {
    const list = await chatService.getConversations(req.userId!);
    res.json({ success: true, data: { conversations: list } });
  } catch (e: any) {
    console.error('Get conversations error:', e);
    res.status(500).json({ success: false, message: 'Failed to load conversations' });
  }
});

/**
 * GET /api/chat/unread/count — total unread message count.
 */
router.get('/unread/count', async (req: AuthRequest, res: Response) => {
  try {
    const n = await chatService.unreadCount(req.userId!);
    res.json({ success: true, data: { count: n } });
  } catch (e: any) {
    console.error('Get unread count error:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch unread count' });
  }
});

/**
 * GET /api/chat/with/:friendId?limit=50&before=ISO
 *   — paginated message history between me and :friendId.
 */
router.get('/with/:friendId', async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    const messages = await chatService.getHistory(req.userId!, req.params.friendId, limit, before);
    res.json({ success: true, data: { messages } });
  } catch (e: any) {
    const msg = e.message || 'Failed to load messages';
    const code = /friend/i.test(msg) ? 403 : 500;
    res.status(code).json({ success: false, message: msg });
  }
});

/**
 * POST /api/chat/with/:friendId — send a message via REST.
 * (Sockets are the primary path; this is a fallback when sockets aren't
 * connected.)
 */
router.post('/with/:friendId', async (req: AuthRequest, res: Response) => {
  try {
    const body = String(req.body?.body || '').trim();
    if (!body) {
      res.status(400).json({ success: false, message: 'Message body is required' });
      return;
    }
    const msg = await chatService.sendMessage(req.userId!, req.params.friendId, body);
    res.status(201).json({ success: true, data: { message: msg } });
  } catch (e: any) {
    const code = /friend|empty|long|yourself/i.test(e.message) ? 400 : 500;
    res.status(code).json({ success: false, message: e.message || 'Failed to send' });
  }
});

/**
 * PUT /api/chat/with/:friendId/read — mark all messages from :friendId as read.
 */
router.put('/with/:friendId/read', async (req: AuthRequest, res: Response) => {
  try {
    const n = await chatService.markRead(req.userId!, req.params.friendId);
    res.json({ success: true, data: { marked: n } });
  } catch (e: any) {
    console.error('Mark-read error:', e);
    res.status(500).json({ success: false, message: 'Failed to mark read' });
  }
});

export default router;
