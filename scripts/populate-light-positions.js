const fs = require('fs');
const path = require('path');

async function populateLightPositions() {
  try {
    console.log('🚀 Starting LightPosition population...');
    
    // First, let's get all existing LightsProduct records
    const lightsProducts = await strapi.entityService.findMany('api::lights-product.lights-product', {
      filters: { isActive: true },
      populate: {
        brand: true,
        model: true
      }
    });
    
    console.log(`📊 Found ${lightsProducts.length} LightsProduct records`);
    
    // Extract all unique positions
    const positionMap = new Map();
    
    lightsProducts.forEach((product, productIndex) => {
      const lightPositions = product.lightPositions || [];
      
      lightPositions.forEach((pos, posIndex) => {
        if (pos.position && pos.category) {
          const key = pos.position.toLowerCase().trim();
          
          if (!positionMap.has(key)) {
            positionMap.set(key, {
              name: pos.position,
              category: pos.category,
              ref: pos.ref,
              count: 1
            });
          } else {
            positionMap.get(key).count++;
          }
        }
      });
      
      if (productIndex % 1000 === 0) {
        console.log(`📝 Processed ${productIndex + 1}/${lightsProducts.length} products...`);
      }
    });
    
    console.log(`🔍 Found ${positionMap.size} unique light positions`);
    
    // Sort positions by category and name for logical ordering
    const sortedPositions = Array.from(positionMap.entries())
      .map(([key, data]) => ({ key, ...data }))
      .sort((a, b) => {
        // First sort by category
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        // Then by name
        return a.name.localeCompare(b.name);
      });
    
    // Assign sort orders
    let sortOrder = 1;
    sortedPositions.forEach(pos => {
      pos.sortOrder = sortOrder++;
    });
    
    // Create LightPosition entries
    console.log('💾 Creating LightPosition entries...');
    
    let createdCount = 0;
    let skippedCount = 0;
    
    for (const position of sortedPositions) {
      try {
        // Check if position already exists
        const existing = await strapi.entityService.findMany('api::lights-position.lights-position', {
          filters: { name: position.name }
        });
        
        if (existing.length > 0) {
          console.log(`⏭️  Skipping existing position: ${position.name}`);
          skippedCount++;
          continue;
        }
        
        // Create new position
        const newPosition = await strapi.entityService.create('api::lights-position.lights-position', {
          data: {
            name: position.name,
            slug: position.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
            description: `Light position for ${position.name} (${position.category})`,
            isActive: true,
            sortOrder: position.sortOrder,
            category: position.category,
            ref: position.ref,
            usageCount: position.count
          }
        });
        
        console.log(`✅ Created: ${position.name} (${position.category}) - Used in ${position.count} products`);
        createdCount++;
        
      } catch (error) {
        console.error(`❌ Error creating position ${position.name}:`, error.message);
      }
    }
    
    console.log('\n🎉 LightPosition population completed!');
    console.log(`📈 Summary:`);
    console.log(`   - Total unique positions found: ${positionMap.size}`);
    console.log(`   - New positions created: ${createdCount}`);
    console.log(`   - Existing positions skipped: ${skippedCount}`);
    
    // Show some examples
    console.log('\n📋 Sample positions created:');
    const samplePositions = sortedPositions.slice(0, 10);
    samplePositions.forEach(pos => {
      console.log(`   - ${pos.name} (${pos.category}) - ${pos.count} products`);
    });
    
  } catch (error) {
    console.error('💥 Error during LightPosition population:', error);
  }
}

// Run the script
populateLightPositions()
  .then(() => {
    console.log('✨ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
