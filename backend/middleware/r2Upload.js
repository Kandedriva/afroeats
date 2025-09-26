import multer from 'multer';
import r2Storage from '../services/r2Storage.js';
import imageOptimizationService from '../services/imageOptimization.js';
import { logger } from '../services/logger.js';

// Configure multer to use memory storage for R2 uploads
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file && file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Please upload a valid image file (JPEG, PNG, GIF, WebP, AVIF)'), false);
    }
  }
});

/**
 * Middleware to upload image to R2 storage
 * @param {string} imageType - Type of image (dish, restaurant, profile, general)
 * @param {string} fieldName - Name of the form field containing the image
 * @param {boolean} optimize - Whether to optimize the image before upload
 */
export const uploadToR2 = (imageType = 'general', fieldName = 'image', optimize = true) => {
  return [
    (req, res, next) => {
      upload.single(fieldName)(req, res, (err) => {
        if (err) {
          // Log the specific multer error
          logger.warn('Multer upload error:', err.message, 'for field:', fieldName);
          req.r2UploadError = err.message;
          return next(); // Continue to next middleware but with error set
        }
        next();
      });
    },
    async (req, res, next) => {
      try {
        // Debug logging for multipart form processing
        console.log('R2 Upload middleware - Form data received:', {
          hasFile: !!req.file,
          body: req.body,
          r2UploadError: req.r2UploadError,
          url: req.url
        });
        
        // Skip if there was a multer error or no file uploaded
        if (req.r2UploadError || !req.file) {
          return next();
        }

        // Check if R2 is configured
        if (!r2Storage.isConfigured()) {
          // Fallback to indicate R2 not configured
          req.r2UploadError = 'R2 storage not configured. Please check R2_ACCESS_KEY, R2_SECRET_KEY, R2_ENDPOINT, and R2_BUCKET environment variables.';
          logger.warn('R2 storage not configured, skipping upload');
          return next();
        }

        let imageBuffer = req.file.buffer;
        let mimeType = req.file.mimetype;

        // Optimize image if requested
        if (optimize && imageOptimizationService) {
          try {
            // Create temporary path for optimization
            const tempPath = `/tmp/${req.file.originalname}`;
            const fs = await import('fs/promises');
            
            // Write buffer to temp file
            await fs.writeFile(tempPath, imageBuffer);
            
            // Optimize the image
            const optimizedPath = tempPath.replace(/(\.[^.]+)$/, '_optimized$1');
            await imageOptimizationService.optimizeImage(tempPath, optimizedPath, {
              quality: 85,
              maxWidth: imageType === 'dish' ? 800 : 400,
              maxHeight: imageType === 'dish' ? 600 : 400,
            });

            // Read optimized image back to buffer
            imageBuffer = await fs.readFile(optimizedPath);
            
            // Clean up temp files
            await fs.unlink(tempPath).catch(() => {});
            await fs.unlink(optimizedPath).catch(() => {});
            
            logger.info(`Image optimized for ${imageType}: ${req.file.originalname}`);
          } catch (optimizeError) {
            logger.warn('Image optimization failed, using original:', optimizeError.message);
            // Continue with original buffer if optimization fails
          }
        }

        // Upload to R2
        const uploadResult = await r2Storage.uploadImage(
          imageBuffer,
          req.file.originalname,
          imageType,
          mimeType,
          req
        );

        if (uploadResult.success) {
          // Attach upload result to request for use in route handler
          req.r2Upload = uploadResult;
          logger.info(`Successfully uploaded ${imageType} image to R2: ${uploadResult.url}`);
        } else {
          throw new Error('R2 upload failed');
        }

        next();

      } catch (error) {
        logger.error('R2 upload middleware error:', error);
        req.r2UploadError = `Upload failed: ${error.message}`;
        
        // Don't fail the request, let the route handler decide
        // This allows graceful degradation if R2 is not available
        next();
      }
    }
  ];
};

/**
 * Middleware specifically for dish images
 */
export const uploadDishImage = uploadToR2('dish', 'image', true);

/**
 * Middleware specifically for restaurant logos
 */
export const uploadRestaurantLogo = uploadToR2('restaurant', 'logo', true);

/**
 * Middleware specifically for profile images
 */
export const uploadProfileImage = uploadToR2('profile', 'image', true);

/**
 * Helper function to handle R2 upload result in route handlers
 */
export const handleR2UploadResult = (req) => {
  if (req.r2UploadError) {
    return {
      success: false,
      error: req.r2UploadError,
      imageUrl: null
    };
  }

  if (req.r2Upload) {
    return {
      success: true,
      imageUrl: req.r2Upload.url,
      key: req.r2Upload.key,
      filename: req.r2Upload.filename
    };
  }

  return {
    success: true,
    imageUrl: null // No image uploaded
  };
};

/**
 * Middleware to delete old image from R2 when updating
 */
export const deleteOldR2Image = async (imageUrl) => {
  if (!imageUrl || !r2Storage.isConfigured()) {
    return;
  }

  try {
    const key = r2Storage.extractKeyFromUrl(imageUrl);
    if (key) {
      await r2Storage.deleteImage(key);
      logger.info(`Successfully deleted old image from R2: ${key}`);
    }
  } catch (error) {
    logger.warn('Failed to delete old image from R2:', error.message);
    // Don't throw error as this is cleanup operation
  }
};

export default {
  uploadToR2,
  uploadDishImage,
  uploadRestaurantLogo,
  uploadProfileImage,
  handleR2UploadResult,
  deleteOldR2Image
};