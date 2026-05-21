import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { shopService } from '../services/ShopService';

const router = Router();

/**
 * GET /api/shop/items - List shop items
 */
router.get('/items', async (req: AuthRequest, res: Response) => {
  try {
    const items = await shopService.getAvailableItems();

    res.json({
      success: true,
      data: { items }
    });
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch items' });
  }
});

/**
 * GET /api/shop/items/:type - Get items by type
 */
router.get('/items/type/:type', async (req: AuthRequest, res: Response) => {
  try {
    const items = await shopService.getItemsByType(req.params.type);

    res.json({
      success: true,
      data: { items }
    });
  } catch (error) {
    console.error('Get items by type error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch items' });
  }
});

/**
 * POST /api/shop/purchase - Buy item. Accepts either { itemId } or { item_id }.
 */
router.post('/purchase', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const itemId: string | undefined = req.body.itemId || req.body.item_id;
    if (!itemId) {
      res.status(400).json({ success: false, message: 'itemId is required' });
      return;
    }
    const purchase = await shopService.purchaseItem(req.userId!, itemId);
    res.status(201).json({ success: true, message: 'Purchase successful', data: { purchase } });
  } catch (error: any) {
    console.error('Purchase error:', error);
    const status = /insufficient/i.test(error.message) ? 402 : 400;
    res.status(status).json({
      success: false,
      code: status === 402 ? 'INSUFFICIENT_COINS' : 'PURCHASE_FAILED',
      message: error.message || 'Purchase failed'
    });
  }
});

/**
 * POST /api/shop/items/:id/equip — Equip a theme or avatar frame the user owns.
 */
router.post('/items/:id/equip', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await shopService.equipItem(req.userId!, req.params.id);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to equip item' });
  }
});

/**
 * POST /api/shop/items/unequip/:type — Remove the active theme or frame (back to default).
 *   :type = 'theme' | 'avatar_item'
 */
router.post('/items/unequip/:type', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const type = req.params.type as 'theme' | 'avatar_item';
    if (!['theme', 'avatar_item'].includes(type)) {
      res.status(400).json({ success: false, message: 'Invalid type' });
      return;
    }
    await shopService.unequipType(req.userId!, type);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to unequip' });
  }
});

/**
 * GET /api/users/me/inventory - Get owned items
 */
router.get('/user/inventory', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const inventory = await shopService.getUserInventory(req.userId!);

    res.json({
      success: true,
      data: { inventory }
    });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch inventory' });
  }
});

/**
 * GET /api/users/me/purchases - Get purchase history
 */
router.get('/user/purchases', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const purchases = await shopService.getUserPurchases(req.userId!);

    res.json({
      success: true,
      data: { purchases }
    });
  } catch (error) {
    console.error('Get purchases error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch purchases' });
  }
});

export default router;
