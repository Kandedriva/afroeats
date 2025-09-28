// Global fetch interceptor to ensure credentials are included for API calls
import { API_BASE_URL } from '../config/api';

// Store original fetch
const originalFetch = window.fetch;

// Override global fetch
window.fetch = function(...args) {
  const [resource] = args;
  let config = args[1] || {};
  
  // More robust API call detection
  const isApiCall = typeof resource === 'string' && (
    resource.includes(API_BASE_URL) ||
    resource.includes('/api/') ||
    resource.startsWith('http://localhost') ||
    resource.startsWith('https://api.orderdabaly.com')
  );
  
  // Check if this is an API call to our backend
  if (isApiCall) {
    // Ensure credentials are included for API calls
    config = {
      ...config,
      credentials: 'include',
      headers: {
        ...config.headers,
        // Only set Content-Type to JSON if no body or body is not FormData
        ...(config.method !== 'GET' && 
           !config.headers?.['Content-Type'] && 
           !(config.body instanceof FormData) &&
           { 'Content-Type': 'application/json' })
      }
    };
    
    // Debug API calls in development only
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('🌐 API Call:', resource, {
        method: config.method || 'GET',
        credentials: config.credentials,
        isApiCall: true
      });
    }
  }
  
  return originalFetch.call(this, resource, config);
};

export default window.fetch;