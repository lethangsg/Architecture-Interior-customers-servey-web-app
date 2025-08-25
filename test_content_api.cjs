#!/usr/bin/env node

// Test content duplicates API
async function testContentAPI() {
  console.log('🧪 Testing Content Duplicates API...\n');
  
  try {
    const fetch = (await import('node-fetch')).default;
    
    console.log('📡 Calling /api/admin/content-duplicates...');
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/admin/content-duplicates', {
      timeout: 60000 // 60 second timeout
    });
    
    const endTime = Date.now();
    console.log(`⏱️  Response time: ${endTime - startTime}ms`);
    
    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers));
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n✅ Success! Response:');
      console.log(`   Total groups: ${data.total_groups || 0}`);
      console.log(`   Total duplicates: ${data.total_duplicates || 0}`);
      console.log(`   Detection method: ${data.detection_method || 'unknown'}`);
      
      if (data.duplicates && data.duplicates.length > 0) {
        console.log(`\n📋 First few duplicate groups:`);
        data.duplicates.slice(0, 3).forEach((group, i) => {
          console.log(`   Group ${i + 1}: ${group.count} images, ${group.style} style`);
          console.log(`     Hash: ${group.hash}`);
          console.log(`     Size: ${(group.size / 1024).toFixed(1)} KB`);
          console.log(`     Files: ${group.filenames?.slice(0, 2).join(', ')}...`);
        });
      }
      
    } else {
      const errorText = await response.text();
      console.log(`❌ Error ${response.status}:`, errorText);
    }
    
  } catch (error) {
    if (error.type === 'request-timeout') {
      console.log('⏰ Request timeout - API is taking too long');
    } else {
      console.log('❌ Request failed:', error.message);
    }
  }
}

testContentAPI().catch(console.error);