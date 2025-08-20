import express from 'express';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import r2Storage from '../services/r2Storage.js';
import { logger } from '../services/logger.js';

const router = express.Router();

/**
 * Proxy endpoint to serve images from R2 storage
 * This allows us to serve R2 images even when the bucket is not publicly accessible
 */
router.get('/r2-images/*', async (req, res) => {
  // Extract the key from the URL path (move outside try block)
  const key = req.params[0]; // This gets everything after /r2-images/
  
  if (!key) {
    return res.status(400).json({ error: 'No image key provided' });
  }

  try {
    // Check if R2 is configured
    if (!r2Storage.isConfigured()) {
      return res.status(503).json({ error: 'R2 storage not configured' });
    }

    logger.info(`Serving R2 image: ${key}`);

    // Get the object from R2
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
    });

    const response = await r2Storage.client.send(command);
    
    // Set appropriate headers
    const contentType = response.ContentType || 'image/jpeg';
    const contentLength = response.ContentLength;
    const lastModified = response.LastModified;
    const etag = response.ETag;

    res.set({
      'Content-Type': contentType,
      'Content-Length': contentLength,
      'Last-Modified': lastModified,
      'ETag': etag,
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      'Access-Control-Allow-Origin': '*', // Allow cross-origin requests
    });

    // Stream the image data
    response.Body.pipe(res);

  } catch (error) {
    logger.error('Error serving R2 image:', error);
    
    if (error.name === 'NoSuchKey') {
      // Try to serve from local uploads as fallback
      const fs = await import('fs');
      const path_module = await import('path');
      const url_module = await import('url');
      
      const __filename = url_module.fileURLToPath(import.meta.url);
      const __dirname = path_module.dirname(__filename);
      const fullPath = path_module.join(__dirname, '..', 'uploads', key);
      
      try {
        if (fs.existsSync(fullPath)) {
          logger.info(`Serving local image as fallback: ${fullPath}`);
          
          // Set proper headers for image serving
          res.set({
            'Cache-Control': 'public, max-age=31536000',
            'Access-Control-Allow-Origin': '*'
          });
          
          return res.sendFile(path_module.resolve(fullPath));
        }
      } catch (localError) {
        logger.error('Error serving local fallback image:', localError);
      }
      
      return res.status(404).json({ error: 'Image not found in R2 or local storage', key });
    }
    
    res.status(500).json({ error: 'Failed to serve image', details: error.message });
  }
});

// Direct local image serving for development fallback
router.get('/local-images/*', async (req, res) => {
  try {
    const imagePath = req.params[0];
    const fs = await import('fs');
    const path_module = await import('path');
    const url_module = await import('url');
    
    const __filename = url_module.fileURLToPath(import.meta.url);
    const __dirname = path_module.dirname(__filename);
    const fullPath = path_module.join(__dirname, '..', 'uploads', imagePath);
    
    console.log(`🖼️ Serving local image: ${fullPath}`);
    
    if (fs.existsSync(fullPath)) {
      // Set cache headers
      res.set({
        'Cache-Control': 'public, max-age=31536000',
        'Access-Control-Allow-Origin': '*'
      });
      return res.sendFile(path_module.resolve(fullPath));
    } else {
      return res.status(404).json({ error: 'Local image not found', path: fullPath });
    }
  } catch (error) {
    logger.error('Error serving local image:', error);
    res.status(500).json({ error: 'Failed to serve local image' });
  }
});

// Test endpoint to check R2 connectivity
router.get('/r2-test', async (req, res) => {
  try {
    if (!r2Storage.isConfigured()) {
      return res.status(503).json({ 
        error: 'R2 storage not configured',
        configured: false
      });
    }
    
    res.json({
      message: 'R2 storage is configured and ready',
      configured: true,
      bucket: process.env.R2_BUCKET,
      endpoint: process.env.R2_ENDPOINT
    });
  } catch (error) {
    logger.error('R2 test error:', error);
    res.status(500).json({ 
      error: 'R2 test failed',
      details: error.message 
    });
  }
});

export default router;