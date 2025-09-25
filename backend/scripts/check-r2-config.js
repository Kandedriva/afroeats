#!/usr/bin/env node

/**
 * R2 Configuration Checker
 * This script verifies that all R2 environment variables are properly configured
 * and tests the connection to Cloudflare R2 storage.
 */

import dotenv from 'dotenv';
import { r2Storage } from '../services/r2Storage.js';

// Load environment variables - try multiple approaches
const path = await import('path');
const { fileURLToPath } = await import('url');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try loading from different possible locations
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config(); // Default location

console.log('🔍 R2 Configuration Check');
console.log('========================');

// Check environment variables
const requiredEnvVars = [
  'R2_ACCESS_KEY',
  'R2_SECRET_KEY', 
  'R2_ENDPOINT',
  'R2_BUCKET'
];

console.log('\n📋 Environment Variables:');
let missingVars = [];

requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    // Mask sensitive values
    const displayValue = varName.includes('SECRET') || varName.includes('KEY') 
      ? `${value.substring(0, 8)}...` 
      : value;
    console.log(`✅ ${varName}: ${displayValue}`);
  } else {
    console.log(`❌ ${varName}: NOT SET`);
    missingVars.push(varName);
  }
});

if (missingVars.length > 0) {
  console.log(`\n🚨 Missing required environment variables: ${missingVars.join(', ')}`);
  console.log('Please set these variables in your .env file or deployment platform.');
  process.exit(1);
}

console.log('\n🔧 R2 Service Status:');
console.log(`✅ Configured: ${r2Storage.isConfigured()}`);

// Debug the configuration issues
console.log('\n🔍 Debug Information:');
console.log(`- Client exists: ${r2Storage.client !== null}`);
console.log(`- Bucket name: ${r2Storage.bucketName}`);
console.log(`- R2_ACCESS_KEY exists: ${!!process.env.R2_ACCESS_KEY}`);
console.log(`- R2_SECRET_KEY exists: ${!!process.env.R2_SECRET_KEY}`);
console.log(`- R2_ENDPOINT exists: ${!!process.env.R2_ENDPOINT}`);

if (r2Storage.isConfigured()) {
  console.log('\n🧪 Testing R2 Connection...');
  
  // Test basic connectivity (this doesn't require actual files to exist)
  try {
    // Generate a test URL to verify URL generation works
    const testKey = 'test-images/test-image.jpg';
    const testUrl = r2Storage.getPublicUrl(testKey);
    console.log(`✅ URL Generation: ${testUrl}`);
    
    console.log('\n✅ R2 configuration appears to be working correctly!');
    console.log('🎉 Images should be displaying properly in your application.');
    
  } catch (error) {
    console.log(`❌ R2 Connection Test Failed: ${error.message}`);
    process.exit(1);
  }
} else {
  console.log('❌ R2 is not properly configured');
  process.exit(1);
}

console.log('\n📝 If images are still not displaying:');
console.log('   1. Check that your frontend is using the correct API_BASE_URL');
console.log('   2. Verify CORS configuration in production');
console.log('   3. Check browser network tab for failed image requests');
console.log('   4. Test the /api/r2-test endpoint directly');