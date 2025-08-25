#!/usr/bin/env node

// Advanced duplicate detection based on image content similarity
const fs = require('fs');
const crypto = require('crypto');

async function detectVisualDuplicates() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🔍 Advanced Visual Duplicate Detection\n');
  
  try {
    // Get all images from API
    const response = await fetch(`${baseUrl}/api/admin/images?category=all`);
    let data;
    
    if (!response.ok) {
      // Try getting both categories separately
      const archResponse = await fetch(`${baseUrl}/api/admin/images?category=architecture`);
      const intResponse = await fetch(`${baseUrl}/api/admin/images?category=interior`);
      
      const archData = await archResponse.json();
      const intData = await intResponse.json();
      
      data = {
        images: [...(archData.images || []), ...(intData.images || [])]
      };
    } else {
      data = await response.json();
    }
    
    if (!data.images || data.images.length === 0) {
      console.log('❌ No images found');
      return;
    }
    
    console.log(`📊 Analyzing ${data.images.length} images for visual duplicates...\n`);
    
    // Group by file size first (quick filter)
    const sizeGroups = {};
    const imageDetails = [];
    
    for (const image of data.images) {
      try {
        // Try to get image binary data
        const imgResponse = await fetch(`${baseUrl}/api/images/${image.id}`);
        if (imgResponse.ok) {
          const buffer = await imgResponse.arrayBuffer();
          const size = buffer.byteLength;
          
          // Create hash of content
          const uint8Array = new Uint8Array(buffer);
          const hash = crypto.createHash('md5').update(uint8Array).digest('hex');
          
          const details = {
            ...image,
            size: size,
            hash: hash
          };
          
          imageDetails.push(details);
          
          if (!sizeGroups[size]) {
            sizeGroups[size] = [];
          }
          sizeGroups[size].push(details);
        }
      } catch (error) {
        console.log(`⚠️  Could not analyze image ${image.id}: ${error.message}`);
      }
    }
    
    console.log(`✅ Successfully analyzed ${imageDetails.length} images\n`);
    
    // Find exact matches by hash
    const hashGroups = {};
    imageDetails.forEach(img => {
      if (!hashGroups[img.hash]) {
        hashGroups[img.hash] = [];
      }
      hashGroups[img.hash].push(img);
    });
    
    const exactDuplicates = Object.values(hashGroups).filter(group => group.length > 1);
    
    if (exactDuplicates.length > 0) {
      console.log(`🎯 Found ${exactDuplicates.length} groups of EXACT duplicates:\n`);
      
      exactDuplicates.forEach((group, index) => {
        const img = group[0];
        console.log(`📸 Group ${index + 1}: ${group.length} identical images`);
        console.log(`   Content Hash: ${img.hash}`);
        console.log(`   File Size: ${(img.size / 1024).toFixed(1)} KB`);
        console.log(`   Style: ${img.style} | Category: ${img.category}`);
        console.log('   Images:');
        
        group.forEach(dupImg => {
          console.log(`     • ID ${dupImg.id}: ${dupImg.filename} (${dupImg.uploaded_at})`);
        });
        
        // Recommend which to keep (oldest)
        const oldest = group.sort((a, b) => new Date(a.uploaded_at) - new Date(b.uploaded_at))[0];
        const toDelete = group.filter(img => img.id !== oldest.id);
        
        console.log(`   ✅ Keep: ID ${oldest.id} (oldest)`);
        console.log(`   ❌ Delete: ${toDelete.map(img => `ID ${img.id}`).join(', ')}`);
        console.log('');
      });
      
      // Offer to clean up
      console.log('🧹 Cleanup Summary:');
      let totalToDelete = 0;
      exactDuplicates.forEach(group => {
        totalToDelete += group.length - 1;
      });
      
      console.log(`   Total groups: ${exactDuplicates.length}`);
      console.log(`   Total images to delete: ${totalToDelete}`);
      console.log(`   Total images to keep: ${exactDuplicates.length}`);
      
    } else {
      console.log('✅ No exact visual duplicates found!');
    }
    
    // Check for size matches but different hashes (similar but not identical)
    const sizeDuplicates = Object.values(sizeGroups)
      .filter(group => group.length > 1)
      .filter(group => {
        // Only flag if same size but different hashes
        const hashes = [...new Set(group.map(img => img.hash))];
        return hashes.length > 1;
      });
    
    if (sizeDuplicates.length > 0) {
      console.log(`\n🔍 Found ${sizeDuplicates.length} groups with same file size but different content:`);
      sizeDuplicates.forEach((group, index) => {
        console.log(`   Group ${index + 1}: ${group.length} images, ${(group[0].size / 1024).toFixed(1)} KB`);
        group.forEach(img => {
          console.log(`     • ${img.filename} (${img.style}/${img.category}) - Hash: ${img.hash.substring(0, 8)}...`);
        });
      });
    }
    
  } catch (error) {
    console.error('❌ Detection failed:', error.message);
  }
}

// Import fetch for Node.js
async function main() {
  const fetch = (await import('node-fetch')).default;
  global.fetch = fetch;
  await detectVisualDuplicates();
}

main().catch(console.error);