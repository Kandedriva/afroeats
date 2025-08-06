import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

const { Pool } = pkg;

// Test database pool
const testPool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'afroeats_test',
  password: process.env.DB_PASSWORD || 'test_password',
  port: process.env.DB_PORT || 5432,
  max: 5, // Reduced pool size for tests
  idleTimeoutMillis: 5000,
  connectionTimeoutMillis: 2000,
});

export class DatabaseHelper {
  static pool = testPool;

  // Setup test database schema
  static async setupTestDatabase() {
    const client = await this.pool.connect();
    try {
      // Create basic tables for testing
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          secret_word VARCHAR(255),
          address TEXT,
          phone VARCHAR(20),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS restaurant_owners (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          secret_word VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS restaurants (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          address TEXT,
          phone_number VARCHAR(20),
          image_url VARCHAR(500),
          owner_id INTEGER REFERENCES restaurant_owners(id),
          stripe_account_id VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS dishes (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          price DECIMAL(10,2) NOT NULL,
          image_url VARCHAR(500),
          restaurant_id INTEGER REFERENCES restaurants(id),
          is_available BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          total DECIMAL(10,2) NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          order_details TEXT,
          delivery_address TEXT,
          delivery_phone VARCHAR(20),
          platform_fee DECIMAL(10,2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          paid_at TIMESTAMP
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS order_items (
          id SERIAL PRIMARY KEY,
          order_id INTEGER REFERENCES orders(id),
          dish_id INTEGER REFERENCES dishes(id),
          name VARCHAR(255) NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          quantity INTEGER NOT NULL,
          restaurant_id INTEGER REFERENCES restaurants(id)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          sid VARCHAR NOT NULL PRIMARY KEY,
          sess JSON NOT NULL,
          expires TIMESTAMP NOT NULL
        )
      `);

      console.log('✅ Test database schema created');
    } catch (error) {
      console.error('❌ Error setting up test database:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Clean test database
  static async cleanDatabase() {
    const client = await this.pool.connect();
    try {
      // Disable foreign key checks temporarily
      await client.query('SET session_replication_role = replica;');
      
      // Clean all tables
      const tables = [
        'order_items',
        'orders', 
        'dishes',
        'restaurants',
        'restaurant_owners',
        'users',
        'sessions'
      ];

      for (const table of tables) {
        await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
      }

      // Re-enable foreign key checks
      await client.query('SET session_replication_role = DEFAULT;');
      
    } catch (error) {
      console.error('❌ Error cleaning test database:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Close database connection
  static async closeDatabase() {
    try {
      await this.pool.end();
      console.log('✅ Test database connection closed');
    } catch (error) {
      console.error('❌ Error closing test database:', error);
    }
  }

  // Create test user
  static async createTestUser(userData = {}) {
    const client = await this.pool.connect();
    try {
      const defaultUser = global.testUtils.generateTestUser();
      const user = { ...defaultUser, ...userData };

      const result = await client.query(
        'INSERT INTO users (name, email, password, secret_word) VALUES ($1, $2, $3, $4) RETURNING *',
        [user.name, user.email, user.password, user.secret_word]
      );

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Create test restaurant owner
  static async createTestOwner(ownerData = {}) {
    const client = await this.pool.connect();
    try {
      const defaultOwner = global.testUtils.generateTestOwner();
      const owner = { ...defaultOwner, ...ownerData };

      const result = await client.query(
        'INSERT INTO restaurant_owners (name, email, password, secret_word) VALUES ($1, $2, $3, $4) RETURNING *',
        [owner.name, owner.email, owner.password, owner.secret_word]
      );

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Create test restaurant
  static async createTestRestaurant(ownerId, restaurantData = {}) {
    const client = await this.pool.connect();
    try {
      const defaultRestaurant = global.testUtils.generateTestRestaurant();
      const restaurant = { ...defaultRestaurant, ...restaurantData };

      const result = await client.query(
        'INSERT INTO restaurants (name, address, phone_number, owner_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [restaurant.name, restaurant.address, restaurant.phone_number, ownerId]
      );

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Create test dish
  static async createTestDish(restaurantId, dishData = {}) {
    const client = await this.pool.connect();
    try {
      const defaultDish = global.testUtils.generateTestDish(restaurantId);
      const dish = { ...defaultDish, ...dishData };

      const result = await client.query(
        'INSERT INTO dishes (name, description, price, restaurant_id, is_available) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [dish.name, dish.description, dish.price, dish.restaurant_id, dish.is_available]
      );

      return result.rows[0];
    } finally {
      client.release();
    }
  }
}

export default DatabaseHelper;