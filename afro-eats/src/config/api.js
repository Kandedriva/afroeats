// API Configuration
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001';

// Debug: Log to see what's actually being used
console.log('🔧 API_BASE_URL in config:', API_BASE_URL);
console.log('🔧 REACT_APP_API_BASE_URL env var:', process.env.REACT_APP_API_BASE_URL);