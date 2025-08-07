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
  
  // If it's already a full URL (R2 or other CDN), return as-is
  if (imageUrl.startsWith('http')) {
    return imageUrl;
  }
  
  // For relative paths, construct with API base URL
  const cleanPath = imageUrl.replace(/\\/g, "/");
  const url = `${API_BASE_URL}${cleanPath.startsWith('/') ? '' : '/'}${cleanPath}`;
  return url;
};

// Handle image error events
export const handleImageError = (event, fallbackText = "No Image") => {
  event.target.src = createPlaceholderImage(fallbackText);
};