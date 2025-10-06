// Test script to run in Strapi console
// Copy and paste this into the Strapi console

async function testLightPositionsPopulation() {
  try {
    console.log('🚀 Testing LightPosition population...');
    
    // Get a sample of LightsProduct records to test with
    const lightsProducts = await strapi.entityService.findMany('api::lights-product.lights-product', {
      filters: { isActive: true },
      limit: 100, // Test with first 100 records
      populate: {
        brand: true,
        model: true
      }
    });
    
    console.log(`📊 Testing with ${lightsProducts.length} LightsProduct records`);
    
    // Extract unique positions from sample
    const positionMap = new Map();
    
    lightsProducts.forEach((product) => {
      const lightPositions = product.lightPositions || [];
      
      lightPositions.forEach((pos) => {
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
    });
    
    console.log(`🔍 Found ${positionMap.size} unique light positions in sample`);
    
    // Show what would be created
    const sortedPositions = Array.from(positionMap.entries())
      .map(([key, data]) => ({ key, ...data }))
      .sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
      });
    
    console.log('\n📋 Sample positions that would be created:');
    sortedPositions.slice(0, 20).forEach((pos, index) => {
      console.log(`${index + 1}. ${pos.name} (${pos.category}) - ${pos.count} products`);
    });
    
    // Test creating one position
    if (sortedPositions.length > 0) {
      const testPosition = sortedPositions[0];
      
      // Check if it already exists
      const existing = await strapi.entityService.findMany('api::lights-position.lights-position', {
        filters: { name: testPosition.name }
      });
      
      if (existing.length > 0) {
        console.log(`\n⏭️  Test position "${testPosition.name}" already exists`);
      } else {
        console.log(`\n🧪 Testing creation of: ${testPosition.name}`);
        
        const newPosition = await strapi.entityService.create('api::lights-position.lights-position', {
          data: {
            name: testPosition.name,
            slug: testPosition.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
            description: `Light position for ${testPosition.name} (${testPosition.category})`,
            isActive: true,
            sortOrder: 1,
            category: testPosition.category,
            ref: testPosition.ref,
            usageCount: testPosition.count
          }
        });
        
        console.log(`✅ Successfully created test position: ${newPosition.name}`);
      }
    }
    
    return {
      totalPositions: positionMap.size,
      samplePositions: sortedPositions.slice(0, 10)
    };
    
  } catch (error) {
    console.error('💥 Error during test:', error);
    return null;
  }
}

// Run the test
testLightPositionsPopulation();
