import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

/**
 * Image optimization service for restaurant logos and dish images
 * Provides resizing, compression, and format conversion
 */
class ImageOptimizationService {
  constructor() {
    this.defaultQuality = 85;
    this.maxWidth = 1200;
    this.maxHeight = 800;
    this.thumbnailSize = 300;
  }

  /**
   * Optimize an uploaded image
   * @param {string} inputPath - Path to the original image
   * @param {string} outputPath - Path where optimized image will be saved
   * @param {Object} options - Optimization options
   * @returns {Promise<Object>} - Optimization results
   */
  async optimizeImage(inputPath, outputPath, options = {}) {
    const {
      quality = this.defaultQuality,
      maxWidth = this.maxWidth,
      maxHeight = this.maxHeight,
      format = 'jpeg',
      createThumbnail = false,
      thumbnailSize = this.thumbnailSize
    } = options;

    try {
      // Get original image info
      const originalStats = fs.statSync(inputPath);
      const originalSize = originalStats.size;

      // Create Sharp instance
      let sharpInstance = sharp(inputPath);
      
      // Get image metadata
      const metadata = await sharpInstance.metadata();
      
      // Resize if image is too large
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Apply format and quality settings
      if (format === 'jpeg') {
        sharpInstance = sharpInstance.jpeg({ quality, progressive: true });
      } else if (format === 'png') {
        sharpInstance = sharpInstance.png({ quality, progressive: true });
      } else if (format === 'webp') {
        sharpInstance = sharpInstance.webp({ quality });
      }

      // Save optimized image
      await sharpInstance.toFile(outputPath);

      // Get optimized image stats
      const optimizedStats = fs.statSync(outputPath);
      const optimizedSize = optimizedStats.size;

      const result = {
        originalSize,
        optimizedSize,
        compressionRatio: ((originalSize - optimizedSize) / originalSize * 100).toFixed(2),
        format,
        width: metadata.width,
        height: metadata.height
      };

      // Create thumbnail if requested
      if (createThumbnail) {
        const thumbnailPath = this.getThumbnailPath(outputPath);
        await sharp(inputPath)
          .resize(thumbnailSize, thumbnailSize, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: 80 })
          .toFile(thumbnailPath);
        
        result.thumbnailPath = thumbnailPath;
      }

      return result;
    } catch (error) {
      throw new Error(`Image optimization failed: ${error.message}`);
    }
  }

  /**
   * Create multiple sizes of an image for responsive design
   * @param {string} inputPath - Path to the original image
   * @param {string} baseOutputPath - Base path for output files
   * @returns {Promise<Object>} - Paths to different sized images
   */
  async createResponsiveImages(inputPath, baseOutputPath) {
    const sizes = [
      { width: 400, suffix: '_small' },
      { width: 800, suffix: '_medium' },
      { width: 1200, suffix: '_large' }
    ];

    const results = {};

    try {
      for (const size of sizes) {
        const outputPath = this.addSuffixToPath(baseOutputPath, size.suffix);
        
        await sharp(inputPath)
          .resize(size.width, null, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: this.defaultQuality, progressive: true })
          .toFile(outputPath);

        results[`${size.width}w`] = outputPath;
      }

      return results;
    } catch (error) {
      throw new Error(`Responsive image creation failed: ${error.message}`);
    }
  }

  /**
   * Get thumbnail path based on original path
   * @param {string} originalPath - Original image path
   * @returns {string} - Thumbnail path
   */
  getThumbnailPath(originalPath) {
    return this.addSuffixToPath(originalPath, '_thumb');
  }

  /**
   * Add suffix to file path before extension
   * @param {string} filePath - Original file path
   * @param {string} suffix - Suffix to add
   * @returns {string} - New file path with suffix
   */
  addSuffixToPath(filePath, suffix) {
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);
    const dirName = path.dirname(filePath);
    return path.join(dirName, `${baseName}${suffix}${ext}`);
  }

  /**
   * Clean up old image files
   * @param {string} filePath - Path to image file to delete
   * @param {boolean} includeThumbnail - Whether to also delete thumbnail
   */
  async cleanupImage(filePath, includeThumbnail = true) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      if (includeThumbnail) {
        const thumbnailPath = this.getThumbnailPath(filePath);
        if (fs.existsSync(thumbnailPath)) {
          fs.unlinkSync(thumbnailPath);
        }
      }
    } catch (error) {
      console.error('Image cleanup failed:', error.message);
    }
  }

  /**
   * Validate image file
   * @param {Object} file - Multer file object
   * @returns {Object} - Validation result
   */
  validateImage(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.mimetype)) {
      return {
        isValid: false,
        error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.'
      };
    }

    if (file.size > maxSize) {
      return {
        isValid: false,
        error: 'File size too large. Maximum size is 10MB.'
      };
    }

    return { isValid: true };
  }
}

export default new ImageOptimizationService();