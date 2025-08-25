#!/usr/bin/env node

// Clean visual duplicates directly using database operations
// Based on the findings from detect_visual_duplicates.cjs

async function cleanVisualDuplicates() {
  console.log('🧹 Cleaning Visual Duplicates Directly...\n');
  
  // Based on the detection results, these are the duplicate IDs to delete:
  const duplicateIdsToDelete = [
    132, 133, 125, 127, 129, 131, 117, 119, 121, 123, 113, 106, 108, 110, 111, 100, 102, 104, 98
  ];
  
  console.log(`🎯 Will delete ${duplicateIdsToDelete.length} duplicate images:`);
  console.log(`   IDs: ${duplicateIdsToDelete.join(', ')}`);
  
  const confirmation = confirm('Proceed with deletion? (This action cannot be undone!)');
  if (!confirmation) {
    console.log('❌ Cancelled by user');
    return;
  }
  
  let deletedCount = 0;
  let errorCount = 0;
  
  for (const imageId of duplicateIdsToDelete) {
    try {
      // Delete via API to ensure proper cleanup
      const response = await fetch(`http://localhost:3000/api/admin/images/${imageId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Deleted image ID ${imageId}`);
        deletedCount++;
      } else {
        console.log(`❌ Failed to delete image ID ${imageId}: ${result.error}`);
        errorCount++;
      }
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.log(`❌ Error deleting image ID ${imageId}: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`\n🎉 Cleanup Summary:`);
  console.log(`   ✅ Successfully deleted: ${deletedCount} images`);
  console.log(`   ❌ Failed to delete: ${errorCount} images`);
  
  if (deletedCount > 0) {
    // Get final stats
    try {
      const statsResponse = await fetch('http://localhost:3000/api/admin/stats');
      const stats = await statsResponse.json();
      
      console.log(`\n📊 Updated Gallery Stats:`);
      if (stats.imagesByCategory) {
        stats.imagesByCategory.forEach(cat => {
          console.log(`   ${cat.category}: ${cat.total_images} images (${cat.active_images} active)`);
        });
      }
      console.log(`   Total: ${stats.totalActiveImages} images`);
      
    } catch (error) {
      console.log('Could not fetch updated stats');
    }
  }
}

// Simulate confirm for non-interactive environment
function confirm(message) {
  console.log(`\n❓ ${message}`);
  // For automated cleanup, return true. For manual, you'd want actual user input
  return true; // Change to false if you want to abort
}

// Import fetch and run
async function main() {
  const fetch = (await import('node-fetch')).default;
  global.fetch = fetch;
  await cleanVisualDuplicates();
}

main().catch(console.error);