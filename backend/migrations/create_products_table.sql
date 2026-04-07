-- Products Table Migration
-- Purpose: Store marketplace products (produce and cooking ingredients)
-- Admin-only management: Only platform admins can add/edit products

-- Main products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  unit VARCHAR(50) NOT NULL, -- e.g., "lb", "kg", "each", "bunch", "dozen"

  -- Inventory
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  low_stock_threshold INTEGER DEFAULT 10,
  is_available BOOLEAN DEFAULT true,

  -- Media
  image_url TEXT,
  additional_images JSONB DEFAULT '[]', -- Array of additional image URLs

  -- Product details
  origin VARCHAR(100), -- e.g., "Local", "Imported from Nigeria", "USA"
  organic BOOLEAN DEFAULT false,
  gluten_free BOOLEAN DEFAULT false,
  vegan BOOLEAN DEFAULT false,

  -- Search and filtering
  tags JSONB DEFAULT '[]', -- Array of tags: ["fresh", "seasonal", "popular"]
  search_terms TEXT, -- Additional search keywords

  -- Admin metadata
  created_by_admin_id INTEGER,
  updated_by_admin_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Soft delete
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP,

  -- Indexes for performance
  CONSTRAINT valid_category CHECK (category IN (
    'vegetables',
    'fruits',
    'grains',
    'spices',
    'meat',
    'seafood',
    'dairy',
    'oils',
    'sauces',
    'snacks',
    'beverages',
    'other'
  ))
);

-- Product categories table (for better organization)
CREATE TABLE IF NOT EXISTS product_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50), -- Emoji or icon name
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default categories
INSERT INTO product_categories (name, display_name, description, icon, sort_order) VALUES
  ('vegetables', 'Vegetables', 'Fresh vegetables and greens', '🥬', 1),
  ('fruits', 'Fruits', 'Fresh fruits and berries', '🍎', 2),
  ('grains', 'Grains & Cereals', 'Rice, flour, and grains', '🌾', 3),
  ('spices', 'Spices & Seasonings', 'African spices and seasonings', '🌶️', 4),
  ('meat', 'Meat & Poultry', 'Fresh and frozen meat', '🍖', 5),
  ('seafood', 'Seafood', 'Fresh fish and seafood', '🐟', 6),
  ('dairy', 'Dairy & Eggs', 'Milk, cheese, and eggs', '🥛', 7),
  ('oils', 'Oils & Fats', 'Cooking oils and fats', '🫒', 8),
  ('sauces', 'Sauces & Condiments', 'Cooking sauces and pastes', '🥫', 9),
  ('snacks', 'Snacks', 'Packaged snacks and treats', '🍿', 10),
  ('beverages', 'Beverages', 'Drinks and beverages', '🧃', 11),
  ('other', 'Other', 'Miscellaneous items', '📦', 12)
ON CONFLICT (name) DO NOTHING;

-- Product audit log (track all changes)
CREATE TABLE IF NOT EXISTS product_audit_log (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  admin_id INTEGER,
  admin_email VARCHAR(255),
  action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'deleted', 'stock_updated'
  changes JSONB, -- What changed (old vs new values)
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_available ON products(is_available);
CREATE INDEX IF NOT EXISTS idx_products_is_deleted ON products(is_deleted);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_name_search ON products USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_product_audit_log_product_id ON product_audit_log(product_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS products_updated_at_trigger ON products;
CREATE TRIGGER products_updated_at_trigger
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();

-- Sample data (optional - for testing)
-- Uncomment to insert sample products
/*
INSERT INTO products (name, description, price, category, unit, stock_quantity, image_url, origin, tags, created_by_admin_id) VALUES
  ('Fresh Spinach', 'Organic fresh spinach leaves', 3.99, 'vegetables', 'bunch', 50, 'https://example.com/spinach.jpg', 'Local', '["organic", "fresh", "popular"]', 1),
  ('Cassava Flour', 'Premium cassava flour from Nigeria', 8.99, 'grains', 'lb', 100, 'https://example.com/cassava.jpg', 'Imported from Nigeria', '["gluten-free", "african"]', 1),
  ('Scotch Bonnet Peppers', 'Authentic hot peppers', 5.49, 'spices', 'lb', 30, 'https://example.com/peppers.jpg', 'Local', '["hot", "fresh", "african"]', 1),
  ('Palm Oil', 'Red palm oil for cooking', 12.99, 'oils', 'bottle', 75, 'https://example.com/palm-oil.jpg', 'Imported from Nigeria', '["african", "cooking"]', 1),
  ('Plantains', 'Fresh green plantains', 2.99, 'fruits', 'lb', 200, 'https://example.com/plantains.jpg', 'Local', '["fresh", "popular", "african"]', 1);
*/

COMMENT ON TABLE products IS 'Marketplace products (produce and cooking ingredients) - Admin-only management';
COMMENT ON TABLE product_categories IS 'Product category definitions';
COMMENT ON TABLE product_audit_log IS 'Audit trail for all product changes';
