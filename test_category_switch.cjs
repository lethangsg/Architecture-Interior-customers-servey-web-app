#!/usr/bin/env node

// Test script to verify category switching works correctly
async function testCategorySwitch() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 Testing Category Switch Functionality\n');
  
  try {
    // Test Architecture images
    console.log('📋 Testing Architecture images...');
    const archResponse = await fetch(`${baseUrl}/api/admin/images?category=architecture`);
    const archData = await archResponse.json();
    
    console.log(`✅ Architecture: ${archData.images?.length || 0} images`);
    if (archData.images?.length > 0) {
      const styles = [...new Set(archData.images.map(img => img.style))];
      console.log(`   Styles: ${styles.slice(0, 5).join(', ')}${styles.length > 5 ? '...' : ''}`);
      console.log(`   First image: ${archData.images[0].filename} (${archData.images[0].style})`);
    }
    
    console.log('');
    
    // Test Interior images  
    console.log('📋 Testing Interior images...');
    const intResponse = await fetch(`${baseUrl}/api/admin/images?category=interior`);
    const intData = await intResponse.json();
    
    console.log(`✅ Interior: ${intData.images?.length || 0} images`);
    if (intData.images?.length > 0) {
      const styles = [...new Set(intData.images.map(img => img.style))];
      console.log(`   Styles: ${styles.slice(0, 5).join(', ')}${styles.length > 5 ? '...' : ''}`);
      console.log(`   First image: ${intData.images[0].filename} (${intData.images[0].style})`);
    }
    
    console.log('');
    
    // Compare images
    if (archData.images && intData.images) {
      const archFilenames = archData.images.map(img => img.filename);
      const intFilenames = intData.images.map(img => img.filename);
      
      const overlap = archFilenames.filter(name => intFilenames.includes(name));
      
      if (overlap.length === 0) {
        console.log('✅ Categories are properly separated - no overlapping images');
      } else {
        console.log(`⚠️  Found ${overlap.length} overlapping images:`, overlap.slice(0, 3));
      }
      
      if (archFilenames.length === intFilenames.length && 
          archFilenames.every(name => intFilenames.includes(name))) {
        console.log('❌ PROBLEM: Both categories return identical images!');
      } else {
        console.log('✅ Categories return different images sets');
      }
    }
    
    console.log('\n🎯 Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Import fetch for Node.js
async function main() {
  const fetch = (await import('node-fetch')).default;
  global.fetch = fetch;
  await testCategorySwitch();
}

main().catch(console.error);