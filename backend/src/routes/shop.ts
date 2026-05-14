import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { shopService } from '../services/ShopService';
import { validateBody } from '../middleware/validation';

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
 * POST /api/shop/purchase - Buy item
 */
router.post(
  '/purchase',
  authMiddleware,
  validateBody({
    itemId: { required: true, type: 'string' }
  }),
  async (req: AuthRequest, res: Response) => {
    try {
      const purchase = await shopService.purchaseItem(req.userId!, req.body.itemId);

      res.status(201).json({
        success: true,
        message: 'Purchase successful',
        data: { purchase }
      });
    } catch (error: any) {
      console.error('Purchase error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Purchase failed'
      });
    }
  }
);

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
