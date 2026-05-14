-- 008_create_reward_shop_table.sql
CREATE TABLE IF NOT EXISTS reward_shop (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  cost INT NOT NULL CHECK (cost >= 0),
  item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('avatar_item', 'theme', 'badge', 'consumable')),
  meta_data JSONB,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reward_shop_item_type ON reward_shop(item_type);
CREATE INDEX idx_reward_shop_is_available ON reward_shop(is_available);
CREATE INDEX idx_reward_shop_cost ON reward_shop(cost);

COMMENT ON TABLE reward_shop IS 'Store items available for purchase with coins';
COMMENT ON COLUMN reward_shop.meta_data IS 'Flexible JSON for item-specific attributes';
