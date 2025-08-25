#!/usr/bin/env node

// Quick cleanup of remaining duplicates
async function quickClean() {
  console.log('🚀 Quick cleanup of remaining duplicates...\n');
  
  // Remaining IDs from the detection (those that weren't deleted yet)
  const remainingIds = [121, 123, 113, 106, 108, 110, 111, 100, 102, 104, 98];
  
  console.log(`Deleting ${remainingIds.length} remaining duplicates...`);
  
  const fetch = (await import('node-fetch')).default;
  
  for (const id of remainingIds) {
    try {
      const response = await fetch(`http://localhost:3000/api/admin/images/${id}`, {
        method: 'DELETE',
        timeout: 5000
      });
      
      if (response.ok) {
        console.log(`✅ ${id}`);
      } else {
        console.log(`❌ ${id} (${response.status})`);
      }
    } catch (error) {
      console.log(`❌ ${id} (error)`);
    }
    
    // Short delay
    await new Promise(r => setTimeout(r, 200));
  }
  
  // Check final stats
  setTimeout(async () => {
    try {
      const statsResponse = await fetch('http://localhost:3000/api/admin/stats');
      const stats = await statsResponse.json();
      
      console.log(`\n📊 Final Stats: ${stats.totalActiveImages} total images`);
      if (stats.imagesByCategory) {
        stats.imagesByCategory.forEach(cat => {
          console.log(`   ${cat.category}: ${cat.total_images} images`);
        });
      }
      
      const expectedAfterCleanup = 121 - 19; // Original - duplicates
      if (stats.totalActiveImages <= expectedAfterCleanup) {
        console.log('✅ Cleanup successful!');
      } else {
        console.log(`⚠️  Still have ${stats.totalActiveImages - expectedAfterCleanup} extra images`);
      }
      
    } catch (error) {
      console.log('Could not get final stats');
    }
  }, 2000);
}

quickClean().catch(console.error);