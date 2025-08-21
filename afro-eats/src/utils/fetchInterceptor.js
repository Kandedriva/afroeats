// Global fetch interceptor to ensure credentials are included for API calls
import { API_BASE_URL } from '../config/api';

// Store original fetch
const originalFetch = window.fetch;

// Override global fetch
window.fetch = function(...args) {
  const [resource, config = {}] = args;
  
  // Check if this is an API call to our backend
  if (typeof resource === 'string' && resource.includes(API_BASE_URL)) {
    // Ensure credentials are included for API calls
    config = {
      ...config,
      credentials: 'include',
      headers: {
        ...config.headers,
        // Ensure proper content type if not set
        ...(config.method !== 'GET' && !config.headers?.['Content-Type'] && 
           { 'Content-Type': 'application/json' })
      }
    };
    
    // Debug API calls in development only
    if (process.env.NODE_ENV === 'development') {
      console.log('🌐 API Call:', resource.replace(API_BASE_URL, ''), {
        method: config.method || 'GET',
        credentials: config.credentials
      });
    }
  }
  
  return originalFetch.call(this, resource, config);
};

export default window.fetch;