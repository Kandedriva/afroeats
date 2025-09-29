import { API_BASE_URL } from "../config/api";

// Create placeholder SVG data URL
export const createPlaceholderImage = (text = "No Image", width = 300, height = 200) => {
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'>
      <rect width='${width}' height='${height}' fill='#f3f4f6'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='system-ui' font-size='14' fill='#374151'>${text}</text>
    </svg>
  `;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

// Get image URL with Safari compatibility enhancements
export const getImageUrl = (imageUrl, fallbackText = "No Image") => {
  // Handle null, undefined, empty string, or whitespace-only strings
  if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
    return createPlaceholderImage(fallbackText);
  }
  
  // Clean the imageUrl to remove any potential formatting issues
  const cleanImageUrl = imageUrl.trim().replace(/\\/g, "/");
  
  // If it's already a complete HTTPS URL, add Safari-specific cache-busting in production
  if (cleanImageUrl.startsWith('https://')) {
    // For Safari compatibility, add cache-busting parameter in production
    if (!API_BASE_URL.includes('localhost') && isSafariOrWebKit()) {
      const separator = cleanImageUrl.includes('?') ? '&' : '?';
      return `${cleanImageUrl}${separator}safari=1`;
    }
    return cleanImageUrl;
  }
  
  // If it's already a complete HTTP URL, return as-is
  if (cleanImageUrl.startsWith('http://')) {
    return cleanImageUrl;
  }
  
  // Handle relative API paths (e.g., "/api/r2-images/...") - HIGHEST PRIORITY
  if (cleanImageUrl.startsWith('/api/r2-images/')) {
    return `${API_BASE_URL}${cleanImageUrl}`;
  }
  
  // Handle other API paths
  if (cleanImageUrl.startsWith('/api/')) {
    return `${API_BASE_URL}${cleanImageUrl}`;
  }
  
  // CRITICAL FIX: Handle legacy /uploads/ paths - convert to R2
  if (cleanImageUrl.startsWith('/uploads/')) {
    // Always convert /uploads/ to /api/r2-images/ regardless of environment
    const imagePath = cleanImageUrl.replace('/uploads/', '');
    return `${API_BASE_URL}/api/r2-images/${imagePath}`;
  }
  
  // If it's a cross-origin R2 image URL from the old domain, proxy it through current API
  if (cleanImageUrl.startsWith('https://api.afoodzone.com/api/r2-images/') || cleanImageUrl.startsWith('https://afoodzone.com/api/r2-images/')) {
    const imagePath = cleanImageUrl.replace(/https:\/\/(api\.)?afoodzone\.com\/api\/r2-images\//, '');
    return `${API_BASE_URL}/api/r2-images/${imagePath}`;
  }
  
  // If imageUrl contains r2-images path without leading slash, add API base
  if (cleanImageUrl.includes('r2-images/') && !cleanImageUrl.startsWith('/')) {
    const pathMatch = cleanImageUrl.match(/r2-images\/(.+)$/);
    if (pathMatch) {
      return `${API_BASE_URL}/api/r2-images/${pathMatch[1]}`;
    }
  }
  
  // For other relative paths, construct with API base URL
  const cleanPath = cleanImageUrl.replace(/\\/g, "/");
  
  // In production, assume relative paths are images that should go through R2 proxy
  if (!API_BASE_URL.includes('localhost') && !cleanPath.startsWith('/')) {
    return `${API_BASE_URL}/api/r2-images/${cleanPath}`;
  }
  
  // Default: prepend API base URL
  const url = `${API_BASE_URL}${cleanPath.startsWith('/') ? '' : '/'}${cleanPath}`;
  return url;
};

// Safari-compatible image error handler with enhanced retry logic
export const handleImageError = (event, fallbackText = "No Image") => {
  const currentSrc = event.target.src;
  
  // Prevent infinite error loops
  if (currentSrc.startsWith('data:image/svg+xml')) {
    return;
  }

  // Enhanced retry logic for Safari/mobile browsers
  const maxRetries = 2;
  const currentRetries = parseInt(event.target.dataset.retryCount || '0');
  
  if (currentRetries < maxRetries) {
    const newRetryCount = currentRetries + 1;
    event.target.dataset.retryCount = newRetryCount;
    
    // Progressive retry strategy with different cache-busting approaches
    let retrySrc;
    if (newRetryCount === 1) {
      // First retry: Add timestamp cache-bust
      const separator = currentSrc.includes('?') ? '&' : '?';
      retrySrc = `${currentSrc}${separator}t=${Date.now()}`;
    } else {
      // Second retry: Add random parameter for Safari
      const separator = currentSrc.includes('?') ? '&' : '?';
      retrySrc = `${currentSrc}${separator}r=${Math.random().toString(36).substring(7)}&safari=1`;
    }
    
    // Log retry attempt only in development
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log(`🔄 Safari-compatible retry ${newRetryCount}/${maxRetries} for "${fallbackText}": ${retrySrc}`);
    }
    
    // Retry loading the image with progressive delay
    setTimeout(() => {
      event.target.src = retrySrc;
    }, newRetryCount * 1500); // Increase delay for each retry (1.5s, 3s)
    
    return;
  }
  
  // After max retries, try fallback strategies
  if (!event.target.dataset.triedFallbacks) {
    event.target.dataset.triedFallbacks = 'true';
    
    // In development: Try local images as fallback
    if (API_BASE_URL.includes('localhost') && currentSrc.includes('/api/r2-images/')) {
      const imagePath = currentSrc.split('/api/r2-images/')[1]?.split('?')[0]; // Remove query params
      if (imagePath) {
        const localImageUrl = `${API_BASE_URL}/api/local-images/${imagePath}`;
        event.target.src = localImageUrl;
        return;
      }
    }
  }
  
  // Final fallback: show placeholder
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log(`❌ All image loading attempts failed for "${fallbackText}", showing placeholder`);
  }
  event.target.src = createPlaceholderImage(fallbackText);
};

// Safari-specific image loading helper
export const loadImageSafari = (imgElement, src, fallbackText = "No Image") => {
  return new Promise((resolve, reject) => {
    // Reset retry counters
    imgElement.dataset.retryCount = '0';
    imgElement.dataset.triedFallbacks = 'false';
    
    // Set up error handler
    const errorHandler = (event) => {
      handleImageError(event, fallbackText);
      resolve(false); // Image failed to load
    };
    
    // Set up success handler
    const loadHandler = () => {
      imgElement.removeEventListener('error', errorHandler);
      imgElement.removeEventListener('load', loadHandler);
      resolve(true); // Image loaded successfully
    };
    
    // Add event listeners
    imgElement.addEventListener('error', errorHandler, { once: false });
    imgElement.addEventListener('load', loadHandler, { once: true });
    
    // Start loading
    imgElement.src = src;
    
    // Timeout after 30 seconds
    setTimeout(() => {
      imgElement.removeEventListener('error', errorHandler);
      imgElement.removeEventListener('load', loadHandler);
      reject(new Error('Image load timeout'));
    }, 30000);
  });
};

// Check if current browser is Safari/WebKit
export const isSafariOrWebKit = () => {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent;
  return (
    /Safari/.test(userAgent) && !/Chrome/.test(userAgent) ||
    /WebKit/.test(userAgent) && !/Chrome/.test(userAgent) ||
    /iPad|iPhone|iPod/.test(userAgent)
  );
};