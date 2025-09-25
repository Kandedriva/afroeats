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

// Get image URL with proper fallback
export const getImageUrl = (imageUrl, fallbackText = "No Image") => {
  if (!imageUrl) {
    return createPlaceholderImage(fallbackText);
  }
  
  // Clean the imageUrl to remove any potential formatting issues
  const cleanImageUrl = imageUrl.trim();
  
  // If it's already a complete HTTPS URL, return as-is
  if (cleanImageUrl.startsWith('https://')) {
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

// Handle image error events with comprehensive fallback
export const handleImageError = (event, fallbackText = "No Image") => {
  const currentSrc = event.target.src;
  
  // Prevent infinite error loops
  if (currentSrc.startsWith('data:image/svg+xml')) {
    return;
  }
  
  // In development: If we're trying R2 images and it fails, try local images as fallback
  if (API_BASE_URL.includes('localhost')) {
    if (currentSrc.includes('/api/r2-images/') && !event.target.dataset.triedLocal) {
      const imagePath = currentSrc.split('/api/r2-images/')[1];
      const localImageUrl = `${API_BASE_URL}/api/local-images/${imagePath}`;
      event.target.dataset.triedLocal = 'true';
      event.target.src = localImageUrl;
      return;
    }
    
    // If local-images API fails, try direct uploads path (DEVELOPMENT ONLY)
    if (currentSrc.includes('/api/local-images/') && !event.target.dataset.triedUploads) {
      const imagePath = currentSrc.split('/api/local-images/')[1];
      const uploadsUrl = `${API_BASE_URL}/uploads/${imagePath}`;
      event.target.dataset.triedUploads = 'true';
      event.target.src = uploadsUrl;
      return;
    }
  }
  
  // PRODUCTION: Never try /uploads/ fallback - R2 is the only source
  // If R2 image fails in production, show placeholder immediately
  if (!API_BASE_URL.includes('localhost')) {
    event.target.src = createPlaceholderImage(fallbackText);
    return;
  }
  
  // If all fallbacks fail, show placeholder
  event.target.src = createPlaceholderImage(fallbackText);
};