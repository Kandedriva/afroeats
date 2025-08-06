import request from 'supertest';
import express from 'express';
import session from 'express-session';
import bcryptjs from 'bcryptjs';
import authRoutes from '../../routes/authRoutes.js';
import orderRoutes from '../../routes/orderRoutes.js';
import cartRoutes from '../../routes/cartRoutes.js';
import restaurantRoutes from '../../routes/restaurantRoutes.js';
import { DatabaseHelper } from '../helpers/database.js';

// Create test app with all necessary routes
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
  
  // Mock middleware
  app.use((req, res, next) => {
    req.isMobile = false;
    req.isChrome = false;
    next();
  });
  
  // Add all routes
  app.use('/api/auth', authRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api', restaurantRoutes);
  
  return app;
};

describe('Complete Order Flow Integration Tests', () => {
  let app;
  let testUser;
  let testOwner;
  let testRestaurant;
  let testDish1;
  let testDish2;
  let agent; // Supertest agent to maintain session

  beforeAll(async () => {
    await DatabaseHelper.setupTestDatabase();
    app = createTestApp();
  });

  beforeEach(async () => {
    await DatabaseHelper.cleanDatabase();
    
    // Create test data
    const userData = global.testUtils.generateTestUser();
    testUser = await DatabaseHelper.createTestUser({
      ...userData,
      password: await bcryptjs.hash(userData.password, 1)
    });
    
    testOwner = await DatabaseHelper.createTestOwner();
    testRestaurant = await DatabaseHelper.createTestRestaurant(testOwner.id);
    
    testDish1 = await DatabaseHelper.createTestDish(testRestaurant.id, {
      name: 'Delicious Pasta',
      price: 15.99
    });
    
    testDish2 = await DatabaseHelper.createTestDish(testRestaurant.id, {
      name: 'Tasty Pizza',
      price: 22.50
    });
    
    // Create agent and login
    agent = request.agent(app);
    const originalUser = global.testUtils.generateTestUser();
    
    await agent
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: originalUser.password
      })
      .expect(200);
  });

  afterAll(async () => {
    await DatabaseHelper.closeDatabase();
  });

  describe('Complete Customer Journey', () => {
    it('should complete full order workflow: browse → cart → order → payment', async () => {
      // Step 1: Browse restaurants
      const restaurantsResponse = await agent
        .get('/api/restaurants')
        .expect(200);
      
      expect(restaurantsResponse.body.restaurants).toHaveLength(1);
      const restaurant = restaurantsResponse.body.restaurants[0];
      expect(restaurant.name).toBe(testRestaurant.name);
      
      // Step 2: View restaurant details and dishes
      const restaurantDetailsResponse = await agent
        .get(`/api/restaurants/${testRestaurant.id}`)
        .expect(200);
      
      expect(restaurantDetailsResponse.body.dishes).toHaveLength(2);
      
      // Step 3: Add items to cart
      const addToCartResponse1 = await agent
        .post('/api/cart/add')
        .send({
          dish_id: testDish1.id,
          quantity: 2
        })
        .expect(200);
      
      expect(addToCartResponse1.body.message).toBe('Item added to cart');
      
      const addToCartResponse2 = await agent
        .post('/api/cart/add')
        .send({
          dish_id: testDish2.id,
          quantity: 1
        })
        .expect(200);
      
      // Step 4: View cart
      const cartResponse = await agent
        .get('/api/cart')
        .expect(200);
      
      expect(cartResponse.body.cart).toHaveLength(2);
      const expectedTotal = (15.99 * 2) + 22.50; // 54.48
      expect(parseFloat(cartResponse.body.total)).toBeCloseTo(expectedTotal, 2);
      
      // Step 5: Create order
      const orderData = {
        delivery_address: '123 Test Street, Test City',
        delivery_phone: '+1234567890',
        delivery_type: 'delivery',
        order_details: 'Please ring doorbell'
      };
      
      const createOrderResponse = await agent
        .post('/api/orders')
        .send(orderData)
        .expect(201);
      
      expect(createOrderResponse.body.order).toBeDefined();
      expect(createOrderResponse.body.order.total).toBe('55.68'); // Including $1.20 platform fee
      expect(createOrderResponse.body.order.platform_fee).toBe('1.20');
      expect(createOrderResponse.body.order.status).toBe('pending');
      
      // Step 6: Verify cart is cleared after order creation
      const emptyCartResponse = await agent
        .get('/api/cart')
        .expect(200);
      
      expect(emptyCartResponse.body.cart).toHaveLength(0);
      expect(emptyCartResponse.body.total).toBe('0.00');
      
      // Step 7: Verify order was created with correct items
      const orderId = createOrderResponse.body.order.id;
      
      // Check order details via auth route (customer's orders)
      const ordersResponse = await agent
        .get('/api/auth/orders')
        .expect(200);
      
      expect(ordersResponse.body.orders).toHaveLength(1);
      const order = ordersResponse.body.orders[0];
      expect(order.id).toBe(orderId);
      expect(order.items).toHaveLength(2);
      
      // Verify order items
      const pastaItem = order.items.find(item => item.name === testDish1.name);
      const pizzaItem = order.items.find(item => item.name === testDish2.name);
      
      expect(pastaItem).toBeDefined();
      expect(pastaItem.quantity).toBe(2);
      expect(parseFloat(pastaItem.price)).toBe(15.99);
      
      expect(pizzaItem).toBeDefined();
      expect(pizzaItem.quantity).toBe(1);
      expect(parseFloat(pizzaItem.price)).toBe(22.50);
    });

    it('should handle multi-restaurant orders correctly', async () => {
      // Create second restaurant with different owner
      const owner2 = await DatabaseHelper.createTestOwner({
        name: 'Second Owner',
        email: 'owner2@test.com'
      });
      
      const restaurant2 = await DatabaseHelper.createTestRestaurant(owner2.id, {
        name: 'Second Restaurant'
      });
      
      const dish3 = await DatabaseHelper.createTestDish(restaurant2.id, {
        name: 'Sushi Roll',
        price: 18.75
      });
      
      // Add items from both restaurants to cart
      await agent
        .post('/api/cart/add')
        .send({
          dish_id: testDish1.id,
          quantity: 1
        })
        .expect(200);
      
      await agent
        .post('/api/cart/add')
        .send({
          dish_id: dish3.id,
          quantity: 1
        })
        .expect(200);
      
      // Create order
      const orderResponse = await agent
        .post('/api/orders')
        .send({
          delivery_address: '123 Test Street',
          delivery_phone: '+1234567890'
        })
        .expect(201);
      
      // Verify order total includes items from both restaurants
      const expectedSubtotal = 15.99 + 18.75; // 34.74
      const expectedTotal = expectedSubtotal + 1.20; // 35.94 with platform fee
      expect(parseFloat(orderResponse.body.order.total)).toBeCloseTo(expectedTotal, 2);
      
      // Verify order items reference correct restaurants
      const ordersResponse = await agent
        .get('/api/auth/orders')
        .expect(200);
      
      const order = ordersResponse.body.orders[0];
      expect(order.items).toHaveLength(2);
      
      const restaurantIds = order.items.map(item => item.restaurant_id);
      expect(restaurantIds).toContain(testRestaurant.id);
      expect(restaurantIds).toContain(restaurant2.id);
    });
  });

  describe('Cart Management Integration', () => {
    it('should handle cart operations correctly', async () => {
      // Add item to cart
      await agent
        .post('/api/cart/add')
        .send({
          dish_id: testDish1.id,
          quantity: 2
        })
        .expect(200);
      
      // Update cart item quantity
      await agent
        .put('/api/cart/update')
        .send({
          dish_id: testDish1.id,
          quantity: 3
        })
        .expect(200);
      
      // Verify updated quantity
      const cartResponse = await agent
        .get('/api/cart')
        .expect(200);
      
      expect(cartResponse.body.cart).toHaveLength(1);
      expect(cartResponse.body.cart[0].quantity).toBe(3);
      
      // Remove item from cart
      await agent
        .delete(`/api/cart/remove/${testDish1.id}`)
        .expect(200);
      
      // Verify cart is empty
      const emptyCartResponse = await agent
        .get('/api/cart')
        .expect(200);
      
      expect(emptyCartResponse.body.cart).toHaveLength(0);
    });

    it('should prevent adding unavailable dishes to cart', async () => {
      // Create unavailable dish
      const unavailableDish = await DatabaseHelper.createTestDish(testRestaurant.id, {
        name: 'Unavailable Dish',
        is_available: false
      });
      
      const response = await agent
        .post('/api/cart/add')
        .send({
          dish_id: unavailableDish.id,
          quantity: 1
        })
        .expect(400);
      
      expect(response.body.error).toContain('not available');
    });
  });

  describe('Order Management Integration', () => {
    let orderId;
    
    beforeEach(async () => {
      // Create an order for testing
      await agent
        .post('/api/cart/add')
        .send({
          dish_id: testDish1.id,
          quantity: 1
        });
      
      const orderResponse = await agent
        .post('/api/orders')
        .send({
          delivery_address: '123 Test Street',
          delivery_phone: '+1234567890'
        });
      
      orderId = orderResponse.body.order.id;
    });

    it('should allow customer to cancel order', async () => {
      const cancelResponse = await agent
        .post(`/api/auth/orders/${orderId}/cancel`)
        .send({
          reason: 'Changed my mind',
          requestRefund: true
        })
        .expect(200);
      
      expect(cancelResponse.body.success).toBe(true);
      expect(cancelResponse.body.message).toContain('refund request sent');
    });

    it('should allow partial restaurant cancellation', async () => {
      const cancelResponse = await agent
        .post(`/api/auth/orders/${orderId}/cancel-restaurant`)
        .send({
          restaurantId: testRestaurant.id,
          reason: 'Restaurant unavailable',
          requestRefund: false
        })
        .expect(200);
      
      expect(cancelResponse.body.success).toBe(true);
      expect(cancelResponse.body.restaurantName).toBe(testRestaurant.name);
    });

    it('should update order status for testing purposes', async () => {
      const updateResponse = await agent
        .post(`/api/auth/orders/${orderId}/update-status`)
        .send({
          status: 'completed'
        })
        .expect(200);
      
      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.message).toContain('completed');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle authentication required for protected routes', async () => {
      const unauthenticatedAgent = request(app);
      
      // Try to access cart without authentication
      await unauthenticatedAgent
        .get('/api/cart')
        .expect(401);
      
      // Try to create order without authentication
      await unauthenticatedAgent
        .post('/api/orders')
        .send({
          delivery_address: '123 Test Street'
        })
        .expect(401);
      
      // Try to view orders without authentication
      await unauthenticatedAgent
        .get('/api/auth/orders')
        .expect(401);
    });

    it('should handle invalid dish IDs gracefully', async () => {
      const response = await agent
        .post('/api/cart/add')
        .send({
          dish_id: 99999,
          quantity: 1
        })
        .expect(400);
      
      expect(response.body.error).toContain('Dish not found');
    });

    it('should handle missing required order fields', async () => {
      await agent
        .post('/api/cart/add')
        .send({
          dish_id: testDish1.id,
          quantity: 1
        });
      
      const response = await agent
        .post('/api/orders')
        .send({
          // Missing required delivery_address
          delivery_phone: '+1234567890'
        })
        .expect(400);
      
      expect(response.body.error).toContain('required');
    });
  });
});