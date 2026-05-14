-- 009_create_purchases_table.sql
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES reward_shop(id),
  cost_paid INT NOT NULL CHECK (cost_paid >= 0),
  purchased_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchases_user_id ON purchases(user_id);
CREATE INDEX idx_purchases_item_id ON purchases(item_id);
CREATE INDEX idx_purchases_purchased_at ON purchases(purchased_at DESC);

COMMENT ON TABLE purchases IS 'Transaction log of all coin purchases';
