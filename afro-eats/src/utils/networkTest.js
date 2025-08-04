// Network connectivity test utility
import { API_BASE_URL } from '../config/api';

export const testBackendConnection = async () => {
  console.log('🔍 Testing backend connection...');
  console.log('API_BASE_URL:', API_BASE_URL);
  
  const results = [];
  
  try {
    // Test 1: Minimal fetch to health endpoint
    console.log('Test 1: Minimal fetch to health endpoint');
    try {
      const healthResponse = await fetch(`${API_BASE_URL}/api/health`);
      console.log('✅ Health response status:', healthResponse.status);
      results.push({ test: 'health-minimal', success: true, status: healthResponse.status });
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        console.log('Health data:', healthData);
      }
    } catch (err) {
      console.error('❌ Health endpoint failed:', err);
      results.push({ test: 'health-minimal', success: false, error: err.message });
    }
    
    // Test 2: Auth endpoint with credentials
    console.log('Test 2: Auth endpoint with credentials');
    try {
      const authResponse = await fetch(`${API_BASE_URL}/api/auth/me`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ Auth response status:', authResponse.status);
      results.push({ test: 'auth-with-credentials', success: true, status: authResponse.status });
      
      if (authResponse.ok || authResponse.status === 401) {
        const authData = await authResponse.json();
        console.log('Auth data:', authData);
      }
    } catch (err) {
      console.error('❌ Auth endpoint failed:', err);
      results.push({ test: 'auth-with-credentials', success: false, error: err.message });
    }
    
    // Test 3: Alternative URL formats
    console.log('Test 3: Alternative URL formats');
    const alternativeUrls = [
      'http://127.0.0.1:5001/api/health',
      'http://localhost:5001/api/health'
    ];
    
    for (const url of alternativeUrls) {
      try {
        console.log(`Testing: ${url}`);
        const response = await fetch(url);
        console.log(`✅ ${url} - Status: ${response.status}`);
        results.push({ test: `alternative-${url}`, success: true, status: response.status });
      } catch (err) {
        console.error(`❌ ${url} failed:`, err);
        results.push({ test: `alternative-${url}`, success: false, error: err.message });
      }
    }
    
    console.log('🎯 All test results:', results);
    return { success: true, message: 'Connection tests completed', results };
  } catch (error) {
    console.error('❌ Network test failed:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return { success: false, error: error.message, results };
  }
};

// Test function to be called from browser console
window.testBackendConnection = testBackendConnection;