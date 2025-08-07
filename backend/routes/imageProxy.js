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
  try {
    // Extract the key from the URL path
    const key = req.params[0]; // This gets everything after /r2-images/
    
    if (!key) {
      return res.status(400).json({ error: 'No image key provided' });
    }

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
      return res.status(404).json({ error: 'Image not found' });
    }
    
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

export default router;