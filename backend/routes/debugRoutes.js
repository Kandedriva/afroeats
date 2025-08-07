import express from 'express';
import r2Storage from '../services/r2Storage.js';

const router = express.Router();

/**
 * Debug endpoint to test R2 URL generation
 * This endpoint helps verify that R2 URLs are being generated correctly in production
 */
router.get('/r2-url-test', (req, res) => {
  try {
    // Test URL generation with different scenarios
    const testKey = 'dish_images/test-image.jpg';
    
    const urlWithRequest = r2Storage.getPublicUrl(testKey, req);
    const urlWithoutRequest = r2Storage.getPublicUrl(testKey);
    
    const debugInfo = {
      environment: process.env.NODE_ENV,
      testKey: testKey,
      urlWithRequest: urlWithRequest,
      urlWithoutRequest: urlWithoutRequest,
      requestHeaders: {
        host: req.headers.host,
        'x-forwarded-host': req.headers['x-forwarded-host'],
        'x-forwarded-proto': req.headers['x-forwarded-proto'],
        origin: req.headers.origin,
        referer: req.headers.referer
      },
      environmentVars: {
        BACKEND_URL: process.env.BACKEND_URL || 'not set',
        RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL || 'not set',
        RAILWAY_STATIC_URL: process.env.RAILWAY_STATIC_URL || 'not set',
        HEROKU_APP_NAME: process.env.HEROKU_APP_NAME || 'not set',
        PORT: process.env.PORT || 'not set'
      },
      r2Config: {
        isConfigured: r2Storage.isConfigured(),
        bucketName: r2Storage.bucketName
      }
    };
    
    res.json(debugInfo);
  } catch (error) {
    res.status(500).json({
      error: 'Debug endpoint failed',
      message: error.message
    });
  }
});

export default router;