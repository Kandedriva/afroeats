/**
 * Image refresh utility to handle image availability issues
 * Provides mechanisms to refresh images that may have become unavailable
 */

import { getImageUrl, handleImageError, isSafariOrWebKit, loadImageSafari } from './imageUtils.js';

// Simple logger that respects NODE_ENV
const logger = {
  log: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  },
  info: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  }
};

/**
 * Safari-compatible refresh for all images on the page
 */
export const refreshImagesOnPage = async (selector = 'img[src*="/api/r2-images/"]') => {
  const images = document.querySelectorAll(selector);
  let refreshedCount = 0;
  const isAppleDevice = isSafariOrWebKit();
  
  const refreshPromises = Array.from(images).map(async (img) => {
    if (img.dataset.originalSrc) {
      // Use stored original source to regenerate URL
      const originalImageUrl = img.dataset.originalSrc;
      const fallbackText = img.alt || 'Image';
      const newSrc = getImageUrl(originalImageUrl, fallbackText);
      
      // Enhanced cache-busting for Safari
      let cacheBustSrc;
      if (isAppleDevice) {
        const separator = newSrc.includes('?') ? '&' : '?';
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        cacheBustSrc = `${newSrc}${separator}refresh=${timestamp}&safari=1&r=${random}`;
      } else {
        const separator = newSrc.includes('?') ? '&' : '?';
        cacheBustSrc = `${newSrc}${separator}refresh=${Date.now()}`;
      }
      
      // Reset retry counters
      delete img.dataset.retryCount;
      delete img.dataset.triedFallbacks;
      
      // Use Safari-specific loading for Apple devices
      if (isAppleDevice) {
        try {
          await loadImageSafari(img, cacheBustSrc, fallbackText);
        } catch (error) {
          logger.log(`Safari image refresh failed for ${fallbackText}:`, error.message);
        }
      } else {
        img.src = cacheBustSrc;
      }
      
      refreshedCount++;
    }
  });
  
  // Wait for Safari image loading to complete
  if (isAppleDevice) {
    await Promise.allSettled(refreshPromises);
  }
  
  const deviceType = isAppleDevice ? 'Safari/mobile' : 'desktop';
  logger.log(`🔄 Refreshed ${refreshedCount} images (${deviceType} optimized)`);
  return refreshedCount;
};

/**
 * Set up automatic image refresh interval with Safari optimization
 */
export const setupImageRefreshInterval = (intervalMinutes = null) => {
  // Auto-detect optimal interval based on browser
  const isAppleDevice = isSafariOrWebKit();
  const defaultInterval = isAppleDevice ? 2 : 30; // Safari needs more frequent refresh
  const actualInterval = intervalMinutes || defaultInterval;
  const intervalMs = actualInterval * 60 * 1000;
  
  const refreshInterval = setInterval(async () => {
    logger.log('🕐 Performing scheduled image refresh');
    await refreshImagesOnPage();
  }, intervalMs);
  
  // Enhanced cleanup and visibility handling
  const cleanup = () => clearInterval(refreshInterval);
  window.addEventListener('beforeunload', cleanup);
  
  // Safari-specific: refresh when page becomes visible
  if (isAppleDevice) {
    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden) {
        logger.log('🔄 Page visible - refreshing images (Safari)');
        await refreshImagesOnPage();
      }
    });
    
    // Refresh on orientation change for mobile Safari
    window.addEventListener('orientationchange', async () => {
      setTimeout(async () => {
        logger.log('🔄 Orientation changed - refreshing images (Safari)');
        await refreshImagesOnPage();
      }, 500);
    });
  }
  
  const deviceType = isAppleDevice ? 'Safari/mobile' : 'desktop';
  logger.log(`⏰ Image refresh interval set for every ${actualInterval} minutes (${deviceType} optimized)`);
  return refreshInterval;
};

/**
 * Safari-compatible enhanced image component with retry logic
 */
export const createRefreshableImage = (originalImageUrl, fallbackText, className = '') => {
  const img = document.createElement('img');
  img.src = getImageUrl(originalImageUrl, fallbackText);
  img.alt = fallbackText;
  img.className = className;
  img.dataset.originalSrc = originalImageUrl;
  
  const isAppleDevice = isSafariOrWebKit();
  
  // Safari-specific optimizations
  if (isAppleDevice) {
    img.loading = 'lazy';
    img.decoding = 'async';
    
    // Use enhanced error handler for Safari
    img.addEventListener('error', (event) => {
      handleImageError(event, fallbackText);
    });
  } else {
    // Standard error handler for other browsers
    img.onerror = (_event) => {
      if (!img.dataset.retryCount) {
        img.dataset.retryCount = '0';
      }
      
      const retryCount = parseInt(img.dataset.retryCount);
      const maxRetries = 3;
      
      if (retryCount < maxRetries) {
        img.dataset.retryCount = (retryCount + 1).toString();
        
        setTimeout(() => {
          const newSrc = getImageUrl(originalImageUrl, fallbackText);
          const separator = newSrc.includes('?') ? '&' : '?';
          img.src = `${newSrc}${separator}retry=${retryCount + 1}&t=${Date.now()}`;
          logger.log(`🔄 Retrying image load (attempt ${retryCount + 1}/${maxRetries}): ${fallbackText}`);
        }, Math.pow(2, retryCount) * 1000); // Exponential backoff
      } else {
        logger.log(`❌ Image failed to load after ${maxRetries} retries: ${fallbackText}`);
        // Fall back to placeholder
        img.src = getImageUrl(null, fallbackText);
      }
    };
  }
  
  img.onload = () => {
    logger.log(`✅ Image loaded successfully: ${fallbackText}`);
    // Reset retry count on successful load
    delete img.dataset.retryCount;
  };
  
  return img;
};

/**
 * Add Safari-compatible refresh capability to existing images
 */
export const enhanceExistingImages = () => {
  const images = document.querySelectorAll('img[src*="/api/r2-images/"]');
  const isAppleDevice = isSafariOrWebKit();
  
  images.forEach(img => {
    if (!img.dataset.enhanced) {
      img.dataset.enhanced = 'true';
      
      // Try to extract original image URL from src
      const srcMatch = img.src.match(/\/api\/r2-images\/(.+?)(?:\?|$)/);
      if (srcMatch) {
        img.dataset.originalSrc = srcMatch[1];
      }
      
      // Safari-specific enhancements
      if (isAppleDevice) {
        img.loading = 'lazy';
        img.decoding = 'async';
        
        // Add intersection observer for Safari preloading
        if ('IntersectionObserver' in window) {
          const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting && entry.target === img) {
                const originalSrc = img.dataset.originalSrc;
                if (originalSrc && !img.src.includes('safari=1')) {
                  const newSrc = getImageUrl(originalSrc, img.alt);
                  const separator = newSrc.includes('?') ? '&' : '?';
                  img.src = `${newSrc}${separator}safari=1`;
                }
                observer.unobserve(img);
              }
            });
          }, { threshold: 0.1 });
          observer.observe(img);
        }
      }
      
      // Add refresh button for debugging (only in development)
      if (process.env.NODE_ENV === 'development') {
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = isAppleDevice ? '🍎🔄' : '🔄';
        refreshBtn.style.cssText = 'position:absolute;top:0;right:0;z-index:1000;background:rgba(0,0,0,0.7);color:white;border:none;padding:2px 6px;font-size:12px;cursor:pointer;';
        refreshBtn.onclick = async () => {
          const originalSrc = img.dataset.originalSrc;
          if (originalSrc) {
            const newSrc = getImageUrl(originalSrc, img.alt);
            let cacheBustSrc;
            
            if (isAppleDevice) {
              const separator = newSrc.includes('?') ? '&' : '?';
              const timestamp = Date.now();
              const random = Math.random().toString(36).substring(7);
              cacheBustSrc = `${newSrc}${separator}manual=${timestamp}&safari=1&r=${random}`;
              
              try {
                await loadImageSafari(img, cacheBustSrc, img.alt || 'Image');
              } catch (error) {
                logger.log('Manual Safari refresh failed:', error);
              }
            } else {
              const separator = newSrc.includes('?') ? '&' : '?';
              cacheBustSrc = `${newSrc}${separator}manual=${Date.now()}`;
              img.src = cacheBustSrc;
            }
          }
        };
        
        // Add relative positioning to parent if needed
        if (img.parentElement && getComputedStyle(img.parentElement).position === 'static') {
          img.parentElement.style.position = 'relative';
        }
        
        img.parentElement?.appendChild(refreshBtn);
      }
    }
  });
};

export default {
  refreshImagesOnPage,
  setupImageRefreshInterval,
  createRefreshableImage,
  enhanceExistingImages,
  // Safari-specific exports
  isSafariOrWebKit,
  loadImageSafari
};