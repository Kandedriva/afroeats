-- Grocery Orders Tables Migration
-- Purpose: Store marketplace/grocery orders separately from restaurant orders

-- Main grocery orders table
CREATE TABLE IF NOT EXISTS grocery_orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,

  -- Pricing
  subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
  platform_fee DECIMAL(10, 2) NOT NULL CHECK (platform_fee >= 0),
  delivery_fee DECIMAL(10, 2) NOT NULL CHECK (delivery_fee >= 0),
  total DECIMAL(10, 2) NOT NULL CHECK (total >= 0),

  -- Delivery information
  delivery_address TEXT NOT NULL,
  delivery_city VARCHAR(100) NOT NULL,
  delivery_state VARCHAR(50),
  delivery_zip VARCHAR(20),
  delivery_phone VARCHAR(50) NOT NULL,
  delivery_name VARCHAR(255) NOT NULL,
  notes TEXT,
  distance_miles DECIMAL(10, 2) DEFAULT 0,

  -- Order status
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- Statuses: pending, paid, preparing, packed, shipped, delivered, cancelled, refunded

  -- Payment information
  stripe_session_id VARCHAR(255),
  stripe_payment_intent VARCHAR(255),
  paid_at TIMESTAMP,

  -- Fulfillment timestamps
  preparing_at TIMESTAMP,
  packed_at TIMESTAMP,
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  cancelled_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN (
    'pending', 'paid', 'preparing', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'
  ))
);

-- Grocery order items table
CREATE TABLE IF NOT EXISTS grocery_order_items (
  id SERIAL PRIMARY KEY,
  grocery_order_id INTEGER NOT NULL REFERENCES grocery_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  total_price DECIMAL(10, 2) NOT NULL CHECK (total_price >= 0),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_grocery_orders_user_id ON grocery_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_grocery_orders_status ON grocery_orders(status);
CREATE INDEX IF NOT EXISTS idx_grocery_orders_created_at ON grocery_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grocery_orders_stripe_session ON grocery_orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_grocery_order_items_order_id ON grocery_order_items(grocery_order_id);
CREATE INDEX IF NOT EXISTS idx_grocery_order_items_product_id ON grocery_order_items(product_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_grocery_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS grocery_orders_updated_at_trigger ON grocery_orders;
CREATE TRIGGER grocery_orders_updated_at_trigger
  BEFORE UPDATE ON grocery_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_grocery_orders_updated_at();

-- Trigger to update stock quantity when order is paid
CREATE OR REPLACE FUNCTION deduct_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- When order status changes to 'paid', deduct stock
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    UPDATE products p
    SET stock_quantity = stock_quantity - goi.quantity
    FROM grocery_order_items goi
    WHERE goi.grocery_order_id = NEW.id
    AND goi.product_id = p.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deduct_product_stock_trigger ON grocery_orders;
CREATE TRIGGER deduct_product_stock_trigger
  AFTER UPDATE ON grocery_orders
  FOR EACH ROW
  WHEN (NEW.status = 'paid' AND OLD.status != 'paid')
  EXECUTE FUNCTION deduct_product_stock();

COMMENT ON TABLE grocery_orders IS 'Marketplace/grocery orders - separate from restaurant food orders';
COMMENT ON TABLE grocery_order_items IS 'Line items for grocery orders';
COMMENT ON COLUMN grocery_orders.status IS 'Order status: pending → paid → preparing → packed → shipped → delivered';
