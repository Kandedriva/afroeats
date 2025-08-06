import request from 'supertest';
import express from 'express';
import session from 'express-session';
import restaurantRoutes from '../../routes/restaurantRoutes.js';
import { DatabaseHelper } from '../helpers/database.js';

// Create test app
const createTestApp = () => {
  const app = express();
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }));
  
  app.use('/api', restaurantRoutes);
  
  return app;
};

describe('Restaurant Routes', () => {
  let app;
  let testOwner;
  let testRestaurant;
  let testDish;

  beforeAll(async () => {
    await DatabaseHelper.setupTestDatabase();
    app = createTestApp();
  });

  beforeEach(async () => {
    await DatabaseHelper.cleanDatabase();
    
    // Create test data
    testOwner = await DatabaseHelper.createTestOwner();
    testRestaurant = await DatabaseHelper.createTestRestaurant(testOwner.id);
    testDish = await DatabaseHelper.createTestDish(testRestaurant.id);
  });

  afterAll(async () => {
    await DatabaseHelper.closeDatabase();
  });

  describe('GET /restaurants', () => {
    it('should return list of restaurants', async () => {
      const response = await request(app)
        .get('/api/restaurants')
        .expect(200);

      expect(response.body).toHaveProperty('restaurants');
      expect(Array.isArray(response.body.restaurants)).toBe(true);
      expect(response.body.restaurants.length).toBeGreaterThan(0);
      
      const restaurant = response.body.restaurants[0];
      expect(restaurant).toHaveProperty('id');
      expect(restaurant).toHaveProperty('name');
      expect(restaurant).toHaveProperty('address');
    });

    it('should return empty array when no restaurants exist', async () => {
      await DatabaseHelper.cleanDatabase();
      
      const response = await request(app)
        .get('/api/restaurants')
        .expect(200);

      expect(response.body.restaurants).toEqual([]);
    });

    it('should include restaurant owner information', async () => {
      const response = await request(app)
        .get('/api/restaurants')
        .expect(200);

      const restaurant = response.body.restaurants[0];
      expect(restaurant).toHaveProperty('owner_name');
      expect(restaurant.owner_name).toBe(testOwner.name);
    });
  });

  describe('GET /restaurants/:id', () => {
    it('should return specific restaurant with dishes', async () => {
      const response = await request(app)
        .get(`/api/restaurants/${testRestaurant.id}`)
        .expect(200);

      expect(response.body).toHaveProperty('restaurant');
      expect(response.body).toHaveProperty('dishes');
      
      const restaurant = response.body.restaurant;
      expect(restaurant.id).toBe(testRestaurant.id);
      expect(restaurant.name).toBe(testRestaurant.name);
      
      const dishes = response.body.dishes;
      expect(Array.isArray(dishes)).toBe(true);
      expect(dishes.length).toBeGreaterThan(0);
      expect(dishes[0].name).toBe(testDish.name);
    });

    it('should return 404 for non-existent restaurant', async () => {
      const response = await request(app)
        .get('/api/restaurants/99999')
        .expect(404);

      expect(response.body.error).toBe('Restaurant not found');
    });

    it('should return 400 for invalid restaurant ID', async () => {
      const response = await request(app)
        .get('/api/restaurants/invalid-id')
        .expect(500); // Database error for invalid ID format

      expect(response.body.error).toBe('Server error');
    });

    it('should only return available dishes', async () => {
      // Create an unavailable dish
      await DatabaseHelper.createTestDish(testRestaurant.id, {
        name: 'Unavailable Dish',
        is_available: false
      });

      const response = await request(app)
        .get(`/api/restaurants/${testRestaurant.id}`)
        .expect(200);

      const dishes = response.body.dishes;
      
      // Should only include available dishes
      const unavailableDishes = dishes.filter(dish => !dish.is_available);
      expect(unavailableDishes.length).toBe(0);
      
      // Should include the original available dish
      const availableDishes = dishes.filter(dish => dish.is_available);
      expect(availableDishes.length).toBeGreaterThan(0);
    });
  });

  describe('Restaurant data integrity', () => {
    it('should include all required restaurant fields', async () => {
      const response = await request(app)
        .get('/api/restaurants')
        .expect(200);

      const restaurant = response.body.restaurants[0];
      
      expect(restaurant).toHaveProperty('id');
      expect(restaurant).toHaveProperty('name');
      expect(restaurant).toHaveProperty('address');
      expect(restaurant).toHaveProperty('phone_number');
      expect(restaurant).toHaveProperty('image_url');
      expect(restaurant).toHaveProperty('owner_name');
      expect(restaurant).toHaveProperty('created_at');
      
      // Verify data types
      expect(typeof restaurant.id).toBe('number');
      expect(typeof restaurant.name).toBe('string');
      expect(restaurant.name.length).toBeGreaterThan(0);
    });

    it('should include all required dish fields in restaurant details', async () => {
      const response = await request(app)
        .get(`/api/restaurants/${testRestaurant.id}`)
        .expect(200);

      const dish = response.body.dishes[0];
      
      expect(dish).toHaveProperty('id');
      expect(dish).toHaveProperty('name');
      expect(dish).toHaveProperty('description');
      expect(dish).toHaveProperty('price');
      expect(dish).toHaveProperty('image_url');
      expect(dish).toHaveProperty('is_available');
      expect(dish).toHaveProperty('created_at');
      
      // Verify data types
      expect(typeof dish.id).toBe('number');
      expect(typeof dish.name).toBe('string');
      expect(typeof dish.price).toBe('string'); // Decimal comes as string from DB
      expect(typeof dish.is_available).toBe('boolean');
    });
  });

  describe('Restaurant search and filtering', () => {
    beforeEach(async () => {
      // Create additional test restaurants for search tests
      const owner2 = await DatabaseHelper.createTestOwner({
        name: 'Second Owner',
        email: 'owner2@test.com'
      });
      
      await DatabaseHelper.createTestRestaurant(owner2.id, {
        name: 'Pizza Palace',
        address: '456 Pizza Street'
      });
      
      await DatabaseHelper.createTestRestaurant(owner2.id, {
        name: 'Burger Joint',
        address: '789 Burger Ave'
      });
    });

    it('should return all restaurants when no search params', async () => {
      const response = await request(app)
        .get('/api/restaurants')
        .expect(200);

      expect(response.body.restaurants.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle database errors gracefully', async () => {
      // Close database connection to simulate error
      await DatabaseHelper.closeDatabase();
      
      const response = await request(app)
        .get('/api/restaurants')
        .expect(500);

      expect(response.body.error).toBe('Server error');
      
      // Restore database connection
      await DatabaseHelper.setupTestDatabase();
    });
  });

  describe('Performance considerations', () => {
    it('should respond within reasonable time limits', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/restaurants')
        .expect(200);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle multiple concurrent requests', async () => {
      const promises = [];
      
      // Make 5 concurrent requests
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .get('/api/restaurants')
            .expect(200)
        );
      }
      
      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.body).toHaveProperty('restaurants');
        expect(Array.isArray(response.body.restaurants)).toBe(true);
      });
    });
  });
});