import request from 'supertest';
import express from 'express';
import session from 'express-session';
import bcryptjs from 'bcryptjs';
import authRoutes from '../../routes/authRoutes.js';
import { DatabaseHelper } from '../helpers/database.js';

// Create test app
const createTestApp = () => {
  const app = express();
  
  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Session middleware for testing
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }));
  
  // Mock middleware for testing
  app.use((req, res, next) => {
    req.isMobile = false;
    req.isChrome = false;
    next();
  });
  
  app.use('/api/auth', authRoutes);
  
  return app;
};

describe('Authentication Routes', () => {
  let app;
  let testUser;
  let hashedPassword;

  beforeAll(async () => {
    await DatabaseHelper.setupTestDatabase();
    app = createTestApp();
  });

  beforeEach(async () => {
    await DatabaseHelper.cleanDatabase();
    
    // Create test user with hashed password
    const userData = global.testUtils.generateTestUser();
    hashedPassword = await bcryptjs.hash(userData.password, 1);
    testUser = await DatabaseHelper.createTestUser({
      ...userData,
      password: hashedPassword
    });
  });

  afterAll(async () => {
    await DatabaseHelper.closeDatabase();
  });

  describe('POST /register', () => {
    it('should register a new user successfully', async () => {
      const newUser = global.testUtils.generateTestUser();
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(newUser)
        .expect(201);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(newUser.email);
      expect(response.body.user.name).toBe(newUser.name);
      expect(response.body.user.password).toBeUndefined(); // Password should not be returned
    });

    it('should reject registration with existing email', async () => {
      const duplicateUser = {
        ...global.testUtils.generateTestUser(),
        email: testUser.email
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(duplicateUser)
        .expect(400);

      expect(response.body.error).toBe('User already exists');
    });

    it('should reject registration with missing required fields', async () => {
      const incompleteUser = {
        name: 'Test User',
        // Missing email and password
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(incompleteUser)
        .expect(500); // Server error due to missing fields

      expect(response.body.error).toBe('Server error');
    });

    it('should create session for newly registered user', async () => {
      const newUser = global.testUtils.generateTestUser();
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(newUser);

      // Check if session was created (cookie should be set)
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  describe('POST /login', () => {
    it('should login with valid credentials', async () => {
      const originalUser = global.testUtils.generateTestUser();
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: originalUser.password // Use original password before hashing
        })
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.sessionInfo).toBeDefined();
      expect(response.body.sessionInfo.sessionId).toBeDefined();
    });

    it('should reject login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!'
        })
        .expect(400);

      expect(response.body.error).toContain('Invalid email or password');
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!'
        })
        .expect(400);

      expect(response.body.error).toContain('Invalid email or password');
    });

    it('should create session on successful login', async () => {
      const originalUser = global.testUtils.generateTestUser();
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: originalUser.password
        });

      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  describe('GET /me', () => {
    let agent;
    
    beforeEach(async () => {
      agent = request.agent(app);
      const originalUser = global.testUtils.generateTestUser();
      
      // Login to create session
      await agent
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: originalUser.password
        });
    });

    it('should return user info for authenticated user', async () => {
      const response = await agent
        .get('/api/auth/me')
        .expect(200);

      expect(response.body.id).toBe(testUser.id);
      expect(response.body.email).toBe(testUser.email);
      expect(response.body.name).toBe(testUser.name);
    });

    it('should return 401 for unauthenticated user', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.error).toBe('Not authenticated');
    });
  });

  describe('POST /logout', () => {
    let agent;
    
    beforeEach(async () => {
      agent = request.agent(app);
      const originalUser = global.testUtils.generateTestUser();
      
      // Login to create session
      await agent
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: originalUser.password
        });
    });

    it('should logout successfully', async () => {
      const response = await agent
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body.message).toBe('Logout successful');
    });

    it('should destroy session on logout', async () => {
      await agent.post('/api/auth/logout');
      
      // Try to access protected route after logout
      const response = await agent
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.error).toBe('Not authenticated');
    });
  });

  describe('POST /update-password', () => {
    let testUserWithSecret;
    
    beforeEach(async () => {
      const userData = global.testUtils.generateTestUser();
      const hashedSecret = await bcryptjs.hash(userData.secret_word, 1);
      
      testUserWithSecret = await DatabaseHelper.createTestUser({
        ...userData,
        password: await bcryptjs.hash(userData.password, 1),
        secret_word: hashedSecret
      });
    });

    it('should update password with valid secret word', async () => {
      const originalUser = global.testUtils.generateTestUser();
      const newPassword = 'NewPassword123!@#';
      
      const response = await request(app)
        .post('/api/auth/update-password')
        .send({
          email: testUserWithSecret.email,
          secret_word: originalUser.secret_word,
          new_password: newPassword
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password updated successfully');
    });

    it('should reject password update with invalid secret word', async () => {
      const response = await request(app)
        .post('/api/auth/update-password')
        .send({
          email: testUserWithSecret.email,
          secret_word: 'WrongSecret',
          new_password: 'NewPassword123!@#'
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid secret word');
    });

    it('should reject weak passwords', async () => {
      const originalUser = global.testUtils.generateTestUser();
      
      const response = await request(app)
        .post('/api/auth/update-password')
        .send({
          email: testUserWithSecret.email,
          secret_word: originalUser.secret_word,
          new_password: 'weak'
        })
        .expect(400);

      expect(response.body.error).toContain('12 characters');
    });

    it('should reject password without special characters', async () => {
      const originalUser = global.testUtils.generateTestUser();
      
      const response = await request(app)
        .post('/api/auth/update-password')
        .send({
          email: testUserWithSecret.email,
          secret_word: originalUser.secret_word,
          new_password: 'SimplePassword123'
        })
        .expect(400);

      expect(response.body.error).toContain('special character');
    });
  });

  describe('GET /profile', () => {
    let agent;
    
    beforeEach(async () => {
      agent = request.agent(app);
      const originalUser = global.testUtils.generateTestUser();
      
      // Login to create session
      await agent
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: originalUser.password
        });
    });

    it('should return user profile for authenticated user', async () => {
      const response = await agent
        .get('/api/auth/profile')
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe(testUser.id);
      expect(response.body.user.email).toBe(testUser.email);
    });

    it('should return 401 for unauthenticated user', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body.error).toBe('Not authenticated');
    });
  });

  describe('PUT /update-profile', () => {
    let agent;
    
    beforeEach(async () => {
      agent = request.agent(app);
      const originalUser = global.testUtils.generateTestUser();
      
      // Login to create session
      await agent
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: originalUser.password
        });
    });

    it('should update user profile successfully', async () => {
      const updatedData = {
        name: 'Updated Name',
        email: 'updated@example.com',
        phone: '+1234567890',
        address: '123 Updated Street'
      };

      const response = await agent
        .put('/api/auth/update-profile')
        .send(updatedData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.name).toBe(updatedData.name);
      expect(response.body.user.email).toBe(updatedData.email);
    });

    it('should reject update with invalid email format', async () => {
      const response = await agent
        .put('/api/auth/update-profile')
        .send({
          name: 'Updated Name',
          email: 'invalid-email',
        })
        .expect(400);

      expect(response.body.error).toBe('Please enter a valid email address');
    });

    it('should reject update with empty name', async () => {
      const response = await agent
        .put('/api/auth/update-profile')
        .send({
          name: '',
          email: 'valid@example.com',
        })
        .expect(400);

      expect(response.body.error).toBe('Name is required');
    });
  });
});