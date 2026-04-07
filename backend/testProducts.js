import pool from './db.js';

async function testProducts() {
  try {
    console.log('🧪 Testing product tables...\n');

    // Check if tables exist
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('products', 'product_categories', 'product_audit_log')
      ORDER BY table_name
    `);

    console.log('✅ Tables created:');
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // Check categories
    const categoriesResult = await pool.query('SELECT name, display_name, icon FROM product_categories ORDER BY sort_order');
    console.log(`\n✅ Product categories loaded: ${categoriesResult.rows.length}`);
    categoriesResult.rows.forEach(cat => {
      console.log(`   ${cat.icon} ${cat.display_name} (${cat.name})`);
    });

    // Check products table structure
    const columnsResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'products'
      ORDER BY ordinal_position
    `);
    console.log(`\n✅ Products table columns: ${columnsResult.rows.length}`);

    // Try to insert a test product
    console.log('\n🧪 Testing product insertion...');
    const testProduct = await pool.query(`
      INSERT INTO products (
        name, description, price, category, unit, stock_quantity,
        image_url, origin, organic, tags, created_by_admin_id
      ) VALUES (
        'Test Spinach',
        'Fresh organic spinach for testing',
        3.99,
        'vegetables',
        'bunch',
        50,
        'https://example.com/spinach.jpg',
        'Local',
        true,
        '["organic", "fresh", "test"]',
        1
      ) RETURNING id, name, price, category
    `);

    console.log('✅ Test product created:');
    console.log(`   ID: ${testProduct.rows[0].id}`);
    console.log(`   Name: ${testProduct.rows[0].name}`);
    console.log(`   Price: $${testProduct.rows[0].price}`);
    console.log(`   Category: ${testProduct.rows[0].category}`);

    // Clean up test product
    await pool.query('DELETE FROM products WHERE name = $1', ['Test Spinach']);
    console.log('\n✅ Test product cleaned up');

    console.log('\n🎉 All tests passed! Product system is ready.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testProducts();
