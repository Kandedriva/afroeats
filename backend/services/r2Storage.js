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
    this.initializeClient();
  }

  initializeClient() {
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
    });

    logger.info('R2 Storage service initialized successfully');
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
  async uploadImage(buffer, originalName, imageType = 'general', mimeType = 'image/jpeg') {
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

      const imageUrl = this.getPublicUrl(key);
      
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
   */
  getPublicUrl(key) {
    // Use our backend proxy endpoint to serve R2 images
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.BACKEND_URL || 'https://your-backend.com'
      : `http://localhost:${process.env.PORT || 5001}`;
    
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
   * Check if R2 is properly configured
   */
  isConfigured() {
    return this.client !== null && this.bucketName && process.env.R2_ENDPOINT;
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
   * Get MIME type from file extension
   */
  getMimeType(extension) {
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.avif': 'image/avif'
    };
    return mimeTypes[extension.toLowerCase()] || 'image/jpeg';
  }
}

// Export singleton instance
export const r2Storage = new R2StorageService();
export default r2Storage;