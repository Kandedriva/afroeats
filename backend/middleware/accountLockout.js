import { cache } from '../utils/cache.js';

// Account lockout settings
const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const LOCKOUT_TIME = parseInt(process.env.LOCKOUT_TIME_MINUTES) || 15; // minutes
const LOCKOUT_TIME_MS = LOCKOUT_TIME * 60 * 1000;

/**
 * Get login attempts for an identifier (email or IP)
 */
export const getLoginAttempts = async (identifier) => {
  try {
    const key = `login_attempts:${identifier}`;
    const attempts = await cache.get(key);
    return attempts ? parseInt(attempts) : 0;
  } catch (error) {
    console.error('Error getting login attempts:', error);
    return 0; // Fail open for availability
  }
};

/**
 * Increment login attempts for an identifier
 */
export const incrementLoginAttempts = async (identifier) => {
  try {
    const key = `login_attempts:${identifier}`;
    const attempts = await cache.incr(key);
    
    if (attempts === 1) {
      // Set expiration on first attempt
      await cache.expire(key, Math.ceil(LOCKOUT_TIME_MS / 1000));
    }
    
    return attempts;
  } catch (error) {
    console.error('Error incrementing login attempts:', error);
    return 1; // Fail open
  }
};

/**
 * Clear login attempts for an identifier (on successful login)
 */
export const clearLoginAttempts = async (identifier) => {
  try {
    const key = `login_attempts:${identifier}`;
    await cache.del(key);
  } catch (error) {
    console.error('Error clearing login attempts:', error);
  }
};

/**
 * Check if account is locked
 */
export const isAccountLocked = async (identifier) => {
  try {
    const attempts = await getLoginAttempts(identifier);
    return attempts >= MAX_LOGIN_ATTEMPTS;
  } catch (error) {
    console.error('Error checking account lock:', error);
    return false; // Fail open for availability
  }
};

/**
 * Get remaining lockout time in minutes
 */
export const getRemainingLockoutTime = async (identifier) => {
  try {
    const key = `login_attempts:${identifier}`;
    const ttl = await cache.ttl(key);
    return ttl > 0 ? Math.ceil(ttl / 60) : 0;
  } catch (error) {
    console.error('Error getting lockout time:', error);
    return 0;
  }
};

/**
 * Middleware to check account lockout before login attempt
 */
export const checkAccountLockout = async (req, res, next) => {
  try {
    const identifier = req.body.email || req.ip;
    
    if (!identifier) {
      return next();
    }

    const locked = await isAccountLocked(identifier);
    
    if (locked) {
      const remainingTime = await getRemainingLockoutTime(identifier);
      
      // Log security event
      console.warn(`Account lockout attempt: ${identifier} at ${new Date().toISOString()}`);
      
      return res.status(423).json({
        error: 'Account temporarily locked due to too many failed login attempts',
        lockoutTime: remainingTime,
        retryAfter: `${remainingTime} minutes`,
        maxAttempts: MAX_LOGIN_ATTEMPTS
      });
    }
    
    next();
  } catch (error) {
    console.error('Account lockout middleware error:', error);
    next(); // Continue on error to maintain availability
  }
};

/**
 * Middleware to handle failed login attempt
 */
export const handleFailedLogin = async (req, res, next) => {
  try {
    const identifier = req.body.email || req.ip;
    
    if (identifier) {
      const attempts = await incrementLoginAttempts(identifier);
      
      // Log security event
      console.warn(`Failed login attempt ${attempts}/${MAX_LOGIN_ATTEMPTS} for ${identifier} at ${new Date().toISOString()}`);
      
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        const remainingTime = await getRemainingLockoutTime(identifier);
        
        // Log account lockout
        console.warn(`Account locked: ${identifier} for ${remainingTime} minutes at ${new Date().toISOString()}`);
        
        return res.status(423).json({
          error: 'Account locked due to too many failed login attempts',
          lockoutTime: remainingTime,
          retryAfter: `${remainingTime} minutes`,
          maxAttempts: MAX_LOGIN_ATTEMPTS
        });
      }
      
      // Add attempt info to response
      req.loginAttempts = {
        current: attempts,
        max: MAX_LOGIN_ATTEMPTS,
        remaining: MAX_LOGIN_ATTEMPTS - attempts
      };
    }
    
    next();
  } catch (error) {
    console.error('Failed login handler error:', error);
    next();
  }
};

/**
 * Middleware to handle successful login
 */
export const handleSuccessfulLogin = async (req, res, next) => {
  try {
    const identifier = req.body.email || req.ip;
    
    if (identifier) {
      await clearLoginAttempts(identifier);
      console.log(`Successful login: ${identifier} at ${new Date().toISOString()}`);
    }
    
    next();
  } catch (error) {
    console.error('Successful login handler error:', error);
    next();
  }
};

export default {
  checkAccountLockout,
  handleFailedLogin,
  handleSuccessfulLogin,
  getLoginAttempts,
  isAccountLocked,
  clearLoginAttempts
};