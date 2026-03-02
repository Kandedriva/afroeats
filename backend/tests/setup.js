import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set default test environment variables
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME || 'afroeats_test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';
process.env.BCRYPT_ROUNDS = '1'; // Use minimal rounds for faster tests

// Global test timeout
jest.setTimeout(10000);

// Suppress console.log during tests (optional)
if (process.env.SUPPRESS_TEST_LOGS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

// Mock external services for testing
jest.mock('../services/analytics.js', () => ({
  AnalyticsService: {
    trackVisitor: jest.fn(),
    trackRegistration: jest.fn(),
    trackOrder: jest.fn(),
    trackRestaurantActivity: jest.fn(),
  },
  trackVisitorMiddleware: (req, res, next) => next(),
}));

// Global test utilities
global.testUtils = {
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  generateTestUser: () => ({
    name: 'Test User',
    email: `test${Date.now()}@example.com`,
    password: 'TestPassword123!',
    secret_word: 'TestSecret123',
  }),
  
  generateTestOwner: () => ({
    name: 'Test Owner',
    email: `owner${Date.now()}@example.com`,
    password: 'OwnerPassword123!',
    secret_word: 'OwnerSecret123',
  }),
  
  generateTestRestaurant: () => ({
    name: 'Test Restaurant',
    address: '123 Test Street',
    phone_number: '+1234567890',
  }),
  
  generateTestDish: (restaurantId) => ({
    name: 'Test Dish',
    description: 'A delicious test dish',
    price: 15.99,
    restaurant_id: restaurantId,
    is_available: true,
  }),
};