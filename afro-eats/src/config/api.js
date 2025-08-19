// API Configuration
console.log('🔧 API Config Debug:', {
  REACT_APP_API_BASE_URL: process.env.REACT_APP_API_BASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  all_env: Object.keys(process.env).filter(key => key.startsWith('REACT_APP'))
});

export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://orderdabaly.com';

console.log('📡 Final API_BASE_URL:', API_BASE_URL);