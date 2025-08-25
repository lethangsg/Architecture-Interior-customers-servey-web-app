#!/usr/bin/env node

// Script to upload all sample images to the database
// This will populate the image gallery with all available sample images

const fs = require('fs');
const path = require('path');

async function uploadSampleImages() {
  const baseUrl = 'http://localhost:3000';
  
  // Architecture samples
  const archSamplesDir = './public/static/samples';
  const interiorSamplesDir = './public/static/interior-samples';
  
  console.log('🚀 Starting sample images upload...\n');
  
  // Helper function to upload an image
  async function uploadImage(imagePath, category) {
    try {
      const filename = path.basename(imagePath);
      const style = filename.replace(/\.(jpg|jpeg|png)$/i, '').toLowerCase();
      
      // Skip symlinks for now
      const stats = fs.lstatSync(imagePath);
      if (stats.isSymbolicLink()) {
        console.log(`⏩ Skipping symlink: ${filename}`);
        return;
      }
      
      // Read image file
      const imageBuffer = fs.readFileSync(imagePath);
      
      // Create form data
      const FormData = require('form-data');
      const formData = new FormData();
      
      formData.append('image', imageBuffer, {
        filename: filename,
        contentType: 'image/jpeg'
      });
      formData.append('category', category);
      
      // Upload to server
      const response = await fetch(`${baseUrl}/api/admin/upload`, {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Uploaded: ${filename} (${category}/${style})`);
      } else {
        console.log(`❌ Failed: ${filename} - ${result.error}`);
      }
      
    } catch (error) {
      console.log(`❌ Error uploading ${imagePath}: ${error.message}`);
    }
  }
  
  // Upload architecture samples
  console.log('📁 Uploading Architecture samples...');
  if (fs.existsSync(archSamplesDir)) {
    const archFiles = fs.readdirSync(archSamplesDir)
      .filter(file => file.match(/\.(jpg|jpeg|png)$/i))
      .map(file => path.join(archSamplesDir, file));
    
    for (const imagePath of archFiles) {
      await uploadImage(imagePath, 'architecture');
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
    }
  }
  
  console.log('\n📁 Uploading Interior samples...');
  // Upload interior samples
  if (fs.existsSync(interiorSamplesDir)) {
    const interiorFiles = fs.readdirSync(interiorSamplesDir)
      .filter(file => file.match(/\.(jpg|jpeg|png)$/i))
      .map(file => path.join(interiorSamplesDir, file));
    
    for (const imagePath of interiorFiles) {
      await uploadImage(imagePath, 'interior');
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
    }
  }
  
  console.log('\n🎉 Upload completed!');
  
  // Check final stats
  try {
    const statsResponse = await fetch(`${baseUrl}/api/admin/stats`);
    const stats = await statsResponse.json();
    
    console.log('\n📊 Final Statistics:');
    if (stats.imagesByCategory) {
      stats.imagesByCategory.forEach(cat => {
        console.log(`   ${cat.category}: ${cat.total_images} images (${cat.active_images} active)`);
      });
    }
  } catch (error) {
    console.log('Could not fetch final stats');
  }
}

// Run the upload
uploadSampleImages().catch(console.error);