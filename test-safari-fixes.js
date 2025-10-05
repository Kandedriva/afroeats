#!/usr/bin/env node

/**
 * Safari Image Loading Test Script
 * Tests the browser compatibility fixes for image loading issues
 */

const testImageUrls = [
  'http://localhost:5001/api/r2-images/dish_images/dish-1752501898635-522011073.JPEG',
  'http://localhost:5001/api/r2-images/restaurant_logos/logo-1752496182432-461945042.JPEG',
  'http://localhost:5001/api/r2-test'
];

async function testImageResponse(url) {
  try {
    console.log(`\n🧪 Testing: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
        'Accept': 'image/webp,image/avif,image/jxl,image/heic,image/heic-sequence,*/*;q=0.8',
      }
    });
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log(`📏 Content-Length: ${response.headers.get('content-length')} bytes`);
    console.log(`🔧 Content-Type: ${response.headers.get('content-type')}`);
    console.log(`💾 Cache-Control: ${response.headers.get('cache-control')}`);
    console.log(`🌐 CORS Origin: ${response.headers.get('access-control-allow-origin')}`);
    console.log(`🔗 Cross-Origin-Resource-Policy: ${response.headers.get('cross-origin-resource-policy')}`);
    
    if (response.ok) {
      console.log('✅ SUCCESS - Image loads correctly');
      
      // Test if response is actually readable
      const arrayBuffer = await response.arrayBuffer();
      console.log(`📦 Response size: ${arrayBuffer.byteLength} bytes`);
      
      if (arrayBuffer.byteLength > 0) {
        console.log('✅ SUCCESS - Image data is readable');
      } else {
        console.log('❌ ERROR - Image data is empty');
      }
    } else {
      console.log('❌ FAILED - HTTP Error');
    }
    
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
  }
}

async function testSafariCompatibility() {
  console.log('🍎 Safari Image Loading Compatibility Test');
  console.log('=' .repeat(50));
  
  for (const url of testImageUrls) {
    await testImageResponse(url);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between tests
  }
  
  console.log('\n🧪 Testing with Safari-specific headers...');
  
  // Test with Safari-specific cache busting
  const safariTestUrl = testImageUrls[0] + '?safari=1&t=' + Date.now();
  console.log(`\n🍎 Safari cache-bust test: ${safariTestUrl}`);
  await testImageResponse(safariTestUrl);
  
  console.log('\n✅ Safari compatibility test completed!');
  console.log('\nNext steps:');
  console.log('1. Test on actual Safari browser');
  console.log('2. Test on iOS devices (iPhone/iPad)');
  console.log('3. Check mobile Safari specifically');
  console.log('4. Verify images persist beyond 30 minutes');
}

// Run the test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testSafariCompatibility().catch(console.error);
}

export { testSafariCompatibility, testImageResponse };