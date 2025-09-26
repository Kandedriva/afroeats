import express from 'express';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import r2Storage from '../services/r2Storage.js';
import { logger } from '../services/logger.js';

const router = express.Router();

/**
 * Generate a placeholder SVG image
 */
const generatePlaceholderSVG = (text, width = 300, height = 200) => {
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'>
      <rect width='${width}' height='${height}' fill='#f3f4f6'/>
      <text x='50%' y='45%' dominant-baseline='middle' text-anchor='middle' font-family='system-ui' font-size='14' fill='#374151'>🍽️</text>
      <text x='50%' y='60%' dominant-baseline='middle' text-anchor='middle' font-family='system-ui' font-size='12' fill='#6b7280'>${text}</text>
    </svg>
  `;
  return svg;
};

/**
 * Serve a placeholder image when the original is not found
 */
const serveImagePlaceholder = (res, key) => {
  let placeholderText = 'No Image';
  let width = 300;
  let height = 200;
  
  // Customize placeholder based on image type
  if (key.includes('dish_images')) {
    placeholderText = 'Dish Image';
    width = 400;
    height = 300;
  } else if (key.includes('restaurant_logos')) {
    placeholderText = 'Restaurant Logo';
    width = 200;
    height = 200;
  } else if (key.includes('profile_images')) {
    placeholderText = 'Profile Image';
    width = 150;
    height = 150;
  }
  
  const svg = generatePlaceholderSVG(placeholderText, width, height);
  
  res.set({
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'public, max-age=3600', // Cache placeholder for 1 hour
    'Access-Control-Allow-Origin': '*',
  });
  
  res.send(svg);
};

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
      
      // If no local fallback exists, serve a placeholder image
      logger.info(`Serving placeholder for missing image: ${key}`);
      return serveImagePlaceholder(res, key);
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
      // Serve placeholder for missing local image
      logger.info(`Serving placeholder for missing local image: ${imagePath}`);
      return serveImagePlaceholder(res, imagePath);
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