/**
 * Image refresh utility to handle image availability issues
 * Provides mechanisms to refresh images that may have become unavailable
 */

import { getImageUrl } from './imageUtils.js';

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
 * Refresh all images on the page that match a selector
 */
export const refreshImagesOnPage = (selector = 'img[src*="/api/r2-images/"]') => {
  const images = document.querySelectorAll(selector);
  let refreshedCount = 0;
  
  images.forEach(img => {
    if (img.dataset.originalSrc) {
      // Use stored original source to regenerate URL
      const originalImageUrl = img.dataset.originalSrc;
      const fallbackText = img.alt || 'Image';
      const newSrc = getImageUrl(originalImageUrl, fallbackText);
      
      // Add cache-busting parameter
      const separator = newSrc.includes('?') ? '&' : '?';
      img.src = `${newSrc}${separator}refresh=${Date.now()}`;
      refreshedCount++;
    }
  });
  
  logger.log(`🔄 Refreshed ${refreshedCount} images`);
  return refreshedCount;
};

/**
 * Set up automatic image refresh interval
 */
export const setupImageRefreshInterval = (intervalMinutes = 30) => {
  const intervalMs = intervalMinutes * 60 * 1000;
  
  const refreshInterval = setInterval(() => {
    logger.log('🕐 Performing scheduled image refresh');
    refreshImagesOnPage();
  }, intervalMs);
  
  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    clearInterval(refreshInterval);
  });
  
  logger.log(`⏰ Image refresh interval set for every ${intervalMinutes} minutes`);
  return refreshInterval;
};

/**
 * Enhanced image component that stores original source for refresh
 */
export const createRefreshableImage = (originalImageUrl, fallbackText, className = '') => {
  const img = document.createElement('img');
  img.src = getImageUrl(originalImageUrl, fallbackText);
  img.alt = fallbackText;
  img.className = className;
  img.dataset.originalSrc = originalImageUrl;
  
  // Add error handler that can retry
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
  
  img.onload = () => {
    logger.log(`✅ Image loaded successfully: ${fallbackText}`);
    // Reset retry count on successful load
    delete img.dataset.retryCount;
  };
  
  return img;
};

/**
 * Add refresh capability to existing images
 */
export const enhanceExistingImages = () => {
  const images = document.querySelectorAll('img[src*="/api/r2-images/"]');
  
  images.forEach(img => {
    if (!img.dataset.enhanced) {
      img.dataset.enhanced = 'true';
      
      // Try to extract original image URL from src
      const srcMatch = img.src.match(/\/api\/r2-images\/(.+?)(?:\?|$)/);
      if (srcMatch) {
        img.dataset.originalSrc = srcMatch[1];
      }
      
      // Add refresh button for debugging (only in development)
      if (process.env.NODE_ENV === 'development') {
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '🔄';
        refreshBtn.style.cssText = 'position:absolute;top:0;right:0;z-index:1000;background:rgba(0,0,0,0.7);color:white;border:none;padding:2px 6px;font-size:12px;cursor:pointer;';
        refreshBtn.onclick = () => {
          const originalSrc = img.dataset.originalSrc;
          if (originalSrc) {
            const newSrc = getImageUrl(originalSrc, img.alt);
            const separator = newSrc.includes('?') ? '&' : '?';
            img.src = `${newSrc}${separator}manual=${Date.now()}`;
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
  enhanceExistingImages
};