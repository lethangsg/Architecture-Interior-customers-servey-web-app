#!/usr/bin/env node

// Script to restore missing interior images
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

async function restoreInteriorImages() {
  const baseUrl = 'http://localhost:3000';
  const interiorSamplesDir = './public/static/interior-samples';
  
  console.log('🔄 Restoring missing interior images...\n');
  
  // Helper function to upload an image
  async function uploadImage(imagePath, category) {
    try {
      const filename = path.basename(imagePath);
      const style = filename.replace(/\.(jpg|jpeg|png)$/i, '').toLowerCase();
      
      // Read image file
      const imageBuffer = fs.readFileSync(imagePath);
      
      // Create form data
      const formData = new FormData();
      
      formData.append('image', imageBuffer, {
        filename: filename,
        contentType: 'image/jpeg'
      });
      formData.append('category', category);
      
      // Upload to server
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`${baseUrl}/api/admin/upload`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders()
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Restored: ${filename} (${category}/${style})`);
      } else {
        console.log(`❌ Failed: ${filename} - ${result.error}`);
      }
      
    } catch (error) {
      console.log(`❌ Error uploading ${imagePath}: ${error.message}`);
    }
  }
  
  // Upload missing interior images
  if (fs.existsSync(interiorSamplesDir)) {
    const interiorFiles = fs.readdirSync(interiorSamplesDir)
      .filter(file => file.match(/\.(jpg|jpeg|png)$/i))
      .map(file => path.join(interiorSamplesDir, file));
    
    for (const imagePath of interiorFiles) {
      await uploadImage(imagePath, 'interior');
      await new Promise(resolve => setTimeout(resolve, 200)); // Small delay
    }
  }
  
  console.log('\n🎉 Interior images restoration completed!');
  
  // Check final stats
  try {
    const fetch = (await import('node-fetch')).default;
    const statsResponse = await fetch(`${baseUrl}/api/admin/stats`);
    const stats = await statsResponse.json();
    
    console.log('\n📊 Updated Statistics:');
    if (stats.imagesByCategory) {
      stats.imagesByCategory.forEach(cat => {
        console.log(`   ${cat.category}: ${cat.total_images} images (${cat.active_images} active)`);
      });
    }
  } catch (error) {
    console.log('Could not fetch final stats:', error.message);
  }
}

// Run the restoration
restoreInteriorImages().catch(console.error);