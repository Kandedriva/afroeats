import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import crypto from 'crypto';
import path from 'path';
import { logger } from './logger.js';

class R2StorageService {
  constructor() {
    this.client = null;
    this.bucketName = process.env.R2_BUCKET;
    this.publicUrl = process.env.R2_PUBLIC_URL;
    this.lastInitialization = null;
    this.initializationErrors = 0;
    this.tokenRefreshTimer = null;
    this.initializeClient();
    this.setupTokenRefresh();
  }

  initializeClient() {
    try {
      // R2 initialization check
      logger.info(`R2 initialization: bucket=${process.env.R2_BUCKET}, endpoint configured=${!!process.env.R2_ENDPOINT}`);
      
      if (!process.env.R2_ACCESS_KEY || !process.env.R2_SECRET_KEY || !process.env.R2_ENDPOINT) {
        logger.warn('R2 credentials not configured, falling back to local storage');
        return;
      }

      this.client = new S3Client({
        region: 'auto', // Cloudflare R2 uses 'auto' region
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY,
          secretAccessKey: process.env.R2_SECRET_KEY,
        },
        forcePathStyle: true, // Required for R2
        maxAttempts: 5, // Increased retry attempts for better reliability
        retryMode: 'adaptive',
        // Additional configuration for Safari/mobile compatibility
        requestHandler: {
          requestTimeout: 30000, // 30 second timeout
          httpsAgent: undefined, // Let SDK manage connections
        },
        // Force fresh connections to prevent timeout issues
        tls: true,
        logger: {
          debug: (msg) => logger.debug(`R2 SDK: ${msg}`),
          info: (msg) => logger.info(`R2 SDK: ${msg}`),
          warn: (msg) => logger.warn(`R2 SDK: ${msg}`),
          error: (msg) => logger.error(`R2 SDK: ${msg}`)
        }
      });

      this.lastInitialization = new Date();
      this.initializationErrors = 0;
      logger.info('R2 Storage service initialized successfully');
    } catch (error) {
      this.initializationErrors++;
      logger.error('Failed to initialize R2 client:', error);
      throw error;
    }
  }

  /**
   * Setup automatic token refresh to prevent 30-minute timeout issues
   */
  setupTokenRefresh() {
    // Clear existing timer
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer);
    }
    
    // Refresh client every 25 minutes (before 30min AWS token expiration)
    this.tokenRefreshTimer = setInterval(() => {
      logger.info('Proactive R2 client refresh (preventing token expiration)');
      this.reinitializeClient();
    }, 25 * 60 * 1000); // 25 minutes
  }
  
  /**
   * Reinitialize client if needed (e.g., after authentication errors)
   */
  async reinitializeClient() {
    logger.info('Reinitializing R2 client due to potential token expiration');
    
    // Clear old client
    if (this.client) {
      try {
        this.client.destroy();
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
    
    this.client = null;
    this.initializeClient();
    
    // Reset the refresh timer
    this.setupTokenRefresh();
  }

  /**
   * Check if R2 is properly configured
   */
  isConfigured() {
    return this.client !== null && 
           this.bucketName && 
           process.env.R2_ACCESS_KEY && 
           process.env.R2_SECRET_KEY && 
           process.env.R2_ENDPOINT;
  }

  /**
   * Generate a unique filename with proper extension
   */
  generateFileName(originalName, type = 'general') {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalName);
    return `${type}-${timestamp}-${randomId}${extension}`;
  }

  /**
   * Get the organized folder path based on image type
   */
  getImagePath(type, filename) {
    const folders = {
      'dish': 'dish_images',
      'restaurant': 'restaurant_logos',
      'profile': 'profile_images',
      'general': 'general_images'
    };
    
    const folder = folders[type] || folders.general;
    return `${folder}/${filename}`;
  }

  /**
   * Upload image to R2 bucket
   */
  async uploadImage(buffer, originalName, imageType = 'general', mimeType = 'image/jpeg', req = null) {
    if (!this.client) {
      throw new Error('R2 client not initialized. Check your R2 credentials.');
    }

    try {
      const filename = this.generateFileName(originalName, imageType);
      const key = this.getImagePath(imageType, filename);

      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          CacheControl: 'max-age=31536000', // Cache for 1 year
          Metadata: {
            'original-name': originalName,
            'image-type': imageType,
            'upload-date': new Date().toISOString(),
          },
        },
      });

      await upload.done();

      const imageUrl = this.getPublicUrl(key, req);
      
      logger.info(`Image uploaded successfully to R2: ${key}`);
      
      return {
        success: true,
        filename: filename,
        key: key,
        url: imageUrl,
        type: imageType
      };

    } catch (error) {
      logger.error('Error uploading to R2:', error);
      throw new Error(`Failed to upload image to R2: ${error.message}`);
    }
  }

  /**
   * Delete image from R2 bucket
   */
  async deleteImage(key) {
    if (!this.client) {
      throw new Error('R2 client not initialized. Check your R2 credentials.');
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
      logger.info(`Image deleted successfully from R2: ${key}`);
      
      return { success: true };

    } catch (error) {
      logger.error('Error deleting from R2:', error);
      throw new Error(`Failed to delete image from R2: ${error.message}`);
    }
  }

  /**
   * Get public URL for an image
   * @param {string} key - The R2 object key
   * @param {Object} req - Optional request object to get the base URL from
   */
  getPublicUrl(key, req = null) {
    // Use our backend proxy endpoint to serve R2 images
    let baseUrl;
    
    if (req && req.headers) {
      // Get base URL from request headers (works in both dev and production)
      const protocol = req.headers['x-forwarded-proto'] || (req.connection.encrypted ? 'https' : 'http');
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      baseUrl = `${protocol}://${host}`;
    } else if (process.env.NODE_ENV === 'production') {
      // Production fallbacks - try multiple environment variables
      baseUrl = process.env.BACKEND_URL || 
                process.env.RENDER_EXTERNAL_URL || 
                process.env.RAILWAY_STATIC_URL || 
                (process.env.HEROKU_APP_NAME ? `https://${process.env.HEROKU_APP_NAME}.herokuapp.com` : null) ||
                'https://api.orderdabaly.com'; // Updated production URL
    } else {
      // Development
      baseUrl = `http://localhost:${process.env.PORT || 5001}`;
    }
    
    return `${baseUrl}/api/r2-images/${key}`;
  }

  /**
   * Extract key from URL for deletion
   */
  extractKeyFromUrl(url) {
    if (!url) return null;

    try {
      // Handle our backend proxy URLs
      if (url.includes('/api/r2-images/')) {
        const parts = url.split('/api/r2-images/');
        return parts[1];
      }
      
      // Handle custom domain URLs (if R2_PUBLIC_URL is used)
      if (this.publicUrl && url.startsWith(this.publicUrl)) {
        return url.replace(`${this.publicUrl}/`, '');
      } 
      
      // Handle direct R2 URLs
      if (url.includes(this.bucketName)) {
        const urlParts = url.split(`${this.bucketName}/`);
        return urlParts[1];
      }
      
      return null;
    } catch (error) {
      logger.error('Error extracting key from URL:', error);
      return null;
    }
  }


  /**
   * Migrate local image to R2 (utility function for migration)
   */
  async migrateLocalImage(localPath, imageType = 'general') {
    if (!this.isConfigured()) {
      throw new Error('R2 not configured for migration');
    }

    try {
      const fs = await import('fs/promises');
      const buffer = await fs.readFile(localPath);
      const originalName = path.basename(localPath);
      const mimeType = this.getMimeType(path.extname(localPath));

      const result = await this.uploadImage(buffer, originalName, imageType, mimeType);
      
      logger.info(`Successfully migrated ${localPath} to R2: ${result.url}`);
      return result;

    } catch (error) {
      logger.error(`Failed to migrate ${localPath}:`, error);
      throw error;
    }
  }

  /**
   * Get MIME type from file extension with enhanced Safari compatibility
   */
  getMimeType(extension) {
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.avif': 'image/avif',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
      '.ico': 'image/x-icon'
    };
    return mimeTypes[extension.toLowerCase()] || 'image/jpeg';
  }
  
  /**
   * Cleanup method to clear timers
   */
  destroy() {
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
    
    if (this.client) {
      try {
        this.client.destroy();
      } catch (e) {
        // Ignore cleanup errors
      }
      this.client = null;
    }
  }
}

// Export singleton instance
export const r2Storage = new R2StorageService();
export default r2Storage;