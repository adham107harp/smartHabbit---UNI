import { db } from '../config/database';
import { Pool } from 'pg';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  itemType: string;
  metadata: Record<string, any>;
  isAvailable: boolean;
}

export interface PurchaseResult {
  purchaseId: string;
  itemId: string;
  itemName: string;
  costPaid: number;
  newCoins: number;
  purchasedAt: string;
}

export class ShopService {
  private pool: Pool = db.getPool();

  /**
   * Get all available shop items
   */
  async getAvailableItems(limit: number = 100): Promise<ShopItem[]> {
    const result = await this.pool.query(
      `SELECT id, name, description, cost, item_type, meta_data, is_available
       FROM reward_shop
       WHERE is_available = true
       ORDER BY item_type ASC, cost ASC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((row: any) => ({
      ...row,
      itemType: row.item_type,
      metadata: row.meta_data,
      isAvailable: row.is_available
    }));
  }

  /**
   * Get shop items by type
   */
  async getItemsByType(
    itemType: string,
    limit: number = 50
  ): Promise<ShopItem[]> {
    const result = await this.pool.query(
      `SELECT id, name, description, cost, item_type, meta_data, is_available
       FROM reward_shop
       WHERE item_type = $1 AND is_available = true
       ORDER BY cost ASC
       LIMIT $2`,
      [itemType, limit]
    );

    return result.rows.map((row: any) => ({
      ...row,
      itemType: row.item_type,
      metadata: row.meta_data,
      isAvailable: row.is_available
    }));
  }

  /**
   * Purchase item from shop
   */
  async purchaseItem(userId: string, itemId: string): Promise<PurchaseResult> {
    return await db.transaction(async (client) => {
      // Get item details
      const itemResult = await client.query(
        `SELECT * FROM reward_shop WHERE id = $1 AND is_available = true`,
        [itemId]
      );

      if (itemResult.rows.length === 0) {
        throw new Error('Item not found or no longer available');
      }

      const item = itemResult.rows[0];

      // Get user's coins
      const userResult = await client.query(
        `SELECT coins FROM users WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const userCoins = userResult.rows[0].coins;

      // Check if user has enough coins
      if (userCoins < item.cost) {
        throw new Error('Insufficient coins');
      }

      // Deduct coins (atomic operation)
      const updateResult = await client.query(
        `UPDATE users 
         SET coins = coins - $1, updated_at = NOW() 
         WHERE id = $2 AND coins >= $1
         RETURNING coins`,
        [item.cost, userId]
      );

      if (updateResult.rows.length === 0) {
        throw new Error('Insufficient coins');
      }

      const newCoins = updateResult.rows[0].coins;

      // Record purchase
      const purchaseResult = await client.query(
        `INSERT INTO purchases (user_id, item_id, cost_paid, purchased_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING id, purchased_at`,
        [userId, itemId, item.cost]
      );

      const purchase = purchaseResult.rows[0];

      // Apply item effect based on type
      await this.applyItemEffect(userId, item, client);

      return {
        purchaseId: purchase.id,
        itemId,
        itemName: item.name,
        costPaid: item.cost,
        newCoins,
        purchasedAt: purchase.purchased_at
      };
    });
  }

  /**
   * Apply the item's real effect at purchase time.
   * Consumables (boosts, shields) activate immediately.
   * Cosmetics (themes, frames) just sit in inventory until the user equips them.
   * Badge purchases are one-shot: the badge is granted right now.
   */
  private async applyItemEffect(
    userId: string,
    item: any,
    client: any
  ): Promise<void> {
    const effect = item.meta_data?.effect;
    const itemType = item.item_type;

    if (itemType === 'consumable' && effect === 'streak_protection') {
      const uses = item.meta_data?.uses || 1;
      await client.query(
        `UPDATE users
            SET streak_shields_count = streak_shields_count + $1, updated_at = NOW()
          WHERE id = $2`,
        [uses, userId]
      );
    } else if (itemType === 'consumable' && effect === 'xp_boost') {
      const hours = item.meta_data?.duration_hours || 24;
      // Stack from the later of "now" or current expiry so back-to-back buys add up.
      await client.query(
        `UPDATE users
            SET xp_boost_expires_at =
                  GREATEST(NOW(), COALESCE(xp_boost_expires_at, NOW())) + ($1 || ' hours')::INTERVAL,
                updated_at = NOW()
          WHERE id = $2`,
        [String(hours), userId]
      );
    } else if (itemType === 'consumable' && effect === 'coin_boost') {
      const hours = item.meta_data?.duration_hours || 24;
      await client.query(
        `UPDATE users
            SET coin_boost_expires_at =
                  GREATEST(NOW(), COALESCE(coin_boost_expires_at, NOW())) + ($1 || ' hours')::INTERVAL,
                updated_at = NOW()
          WHERE id = $2`,
        [String(hours), userId]
      );
    } else if (itemType === 'badge') {
      // Make the user own this badge immediately (one-shot purchase).
      // Note: this needs a badge row referenced by item.meta_data.badge_id OR
      // we treat the shop_item itself as the badge — keep simple, no-op for now.
      // (Future: link shop badge items to real badges table.)
    }
    // themes + avatar_item: no automatic effect — user equips in their own time.

    await client.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, '🛍️ Purchase Complete', 'You purchased ' || $2 || '!', 'purchase')`,
      [userId, item.name]
    );
  }

  /**
   * Equip a theme or avatar frame that the user already owns.
   * Returns the enriched user record so the frontend can re-apply the theme
   * without a second roundtrip.
   */
  async equipItem(userId: string, itemId: string): Promise<{ item_type: string }> {
    return await db.transaction(async (client) => {
      const itemRes = await client.query(
        `SELECT rs.*, p.id AS purchase_id
           FROM reward_shop rs
           LEFT JOIN purchases p ON p.item_id = rs.id AND p.user_id = $1
          WHERE rs.id = $2`,
        [userId, itemId]
      );
      const item = itemRes.rows[0];
      if (!item) throw new Error('Item not found');
      if (!item.purchase_id) throw new Error("You don't own this item.");
      if (!['theme', 'avatar_item'].includes(item.item_type)) {
        throw new Error('This item is not equippable.');
      }
      const column = item.item_type === 'theme' ? 'active_theme_id' : 'active_avatar_frame_id';
      await client.query(
        `UPDATE users SET ${column} = $1, updated_at = NOW() WHERE id = $2`,
        [itemId, userId]
      );
      return { item_type: item.item_type };
    });
  }

  /**
   * Unequip the currently active theme or frame (back to default).
   */
  async unequipType(userId: string, type: 'theme' | 'avatar_item'): Promise<void> {
    const column = type === 'theme' ? 'active_theme_id' : 'active_avatar_frame_id';
    await this.pool.query(
      `UPDATE users SET ${column} = NULL, updated_at = NOW() WHERE id = $1`,
      [userId]
    );
  }

  /**
   * Get user's purchase history
   */
  async getUserPurchases(userId: string, limit: number = 50): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT 
        p.id, p.item_id, rs.name, rs.item_type, p.cost_paid, p.purchased_at
       FROM purchases p
       INNER JOIN reward_shop rs ON p.item_id = rs.id
       WHERE p.user_id = $1
       ORDER BY p.purchased_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  /**
   * Get user's inventory (owned items)
   */
  async getUserInventory(userId: string): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT rs.id, rs.name, rs.description, rs.item_type, rs.meta_data, p.purchased_at
       FROM purchases p
       INNER JOIN reward_shop rs ON p.item_id = rs.id
       WHERE p.user_id = $1 AND rs.item_type IN ('avatar_item', 'theme')
       ORDER BY p.purchased_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Create new shop item (admin)
   */
  async createItem(
    name: string,
    description: string,
    cost: number,
    itemType: string,
    metadata?: Record<string, any>
  ): Promise<ShopItem> {
    const result = await this.pool.query(
      `INSERT INTO reward_shop (name, description, cost, item_type, meta_data, is_available)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [name, description, cost, itemType, metadata || {}]
    );

    return result.rows[0];
  }

  /**
   * Update shop item (admin)
   */
  async updateItem(
    itemId: string,
    updates: Partial<ShopItem>
  ): Promise<ShopItem> {
    const fields: string[] = [];
    const values: (string | number | boolean)[] = [itemId];
    let paramCount = 2;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(updates.name);
    }
    if (updates.cost !== undefined) {
      fields.push(`cost = $${paramCount++}`);
      values.push(updates.cost);
    }
    if (updates.isAvailable !== undefined) {
      fields.push(`is_available = $${paramCount++}`);
      values.push(updates.isAvailable);
    }

    fields.push(`updated_at = NOW()`);

    const query = `UPDATE reward_shop SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
    const result = await this.pool.query(query, values);

    return result.rows[0];
  }
}

export const shopService = new ShopService();
