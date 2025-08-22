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
  
  // If it's a cross-origin R2 image URL from the old domain, proxy it through current API
  if (imageUrl.startsWith('https://api.afoodzone.com/api/r2-images/') || imageUrl.startsWith('https://afoodzone.com/api/r2-images/')) {
    const imagePath = imageUrl.replace(/https:\/\/(api\.)?afoodzone\.com\/api\/r2-images\//, '');
    return `${API_BASE_URL}/api/r2-images/${imagePath}`;
  }
  
  // If it's already our current domain R2 image, return as-is
  if (imageUrl.startsWith(`${API_BASE_URL}/api/r2-images/`)) {
    return imageUrl;
  }
  
  // If it's a local uploads path
  if (imageUrl.startsWith('/uploads/')) {
    // In production, try R2 proxy first, then local uploads
    if (!API_BASE_URL.includes('localhost')) {
      const imagePath = imageUrl.replace('/uploads/', '');
      return `${API_BASE_URL}/api/r2-images/${imagePath}`;
    }
    return `${API_BASE_URL}${imageUrl}`;
  }
  
  // For development: if API_BASE_URL is localhost and imageUrl contains r2-images, try local first
  if (API_BASE_URL.includes('localhost') && imageUrl.includes('r2-images/')) {
    const pathMatch = imageUrl.match(/r2-images\/(.+)$/);
    if (pathMatch) {
      return `${API_BASE_URL}/uploads/${pathMatch[1]}`;
    }
  }
  
  // For production: if imageUrl contains r2-images, ensure it goes through our proxy
  if (!API_BASE_URL.includes('localhost') && imageUrl.includes('r2-images/')) {
    const pathMatch = imageUrl.match(/r2-images\/(.+)$/);
    if (pathMatch) {
      return `${API_BASE_URL}/api/r2-images/${pathMatch[1]}`;
    }
  }
  
  // If it's any other full URL, return as-is
  if (imageUrl.startsWith('http')) {
    return imageUrl;
  }
  
  // For relative paths, construct with API base URL
  const cleanPath = imageUrl.replace(/\\/g, "/");
  
  // In production, assume relative paths are images that should go through R2 proxy
  if (!API_BASE_URL.includes('localhost') && !cleanPath.startsWith('/api/')) {
    const imagePath = cleanPath.replace(/^\//, '');
    return `${API_BASE_URL}/api/r2-images/${imagePath}`;
  }
  
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
  
  // If we're trying R2 images and it fails, try local images as fallback
  if (currentSrc.includes('/api/r2-images/') && !event.target.dataset.triedLocal) {
    const imagePath = currentSrc.split('/api/r2-images/')[1];
    const localImageUrl = `${API_BASE_URL}/api/local-images/${imagePath}`;
    event.target.dataset.triedLocal = 'true';
    event.target.src = localImageUrl;
    return;
  }
  
  // If local-images API fails, try direct uploads path
  if (currentSrc.includes('/api/local-images/') && !event.target.dataset.triedUploads) {
    const imagePath = currentSrc.split('/api/local-images/')[1];
    const uploadsUrl = `${API_BASE_URL}/uploads/${imagePath}`;
    event.target.dataset.triedUploads = 'true';
    event.target.src = uploadsUrl;
    return;
  }
  
  // If direct uploads fails in production, try R2 proxy as final fallback
  if (currentSrc.includes('/uploads/') && !API_BASE_URL.includes('localhost') && !event.target.dataset.triedR2Fallback) {
    const imagePath = currentSrc.split('/uploads/')[1];
    const r2FallbackUrl = `${API_BASE_URL}/api/r2-images/${imagePath}`;
    event.target.dataset.triedR2Fallback = 'true';
    event.target.src = r2FallbackUrl;
    return;
  }
  
  // If all fallbacks fail, show placeholder
  event.target.src = createPlaceholderImage(fallbackText);
};