// Quick verification script to check if positions were created
// Run this in Strapi console: npm run strapi console

async function verifyPositions() {
  try {
    console.log('🔍 Verifying LightPosition data...');
    
    // Get all positions
    const positions = await strapi.entityService.findMany('api::lights-position.lights-position', {
      sort: ['sort:asc'],
      filters: { isActive: true }
    });
    
    console.log(`📊 Found ${positions.length} positions in database`);
    
    if (positions.length > 0) {
      console.log('\n📋 All positions:');
      positions.forEach((pos, index) => {
        console.log(`${index + 1}. ${pos.name} (${pos.category}) - Sort: ${pos.sort || 'N/A'}`);
      });
      
      // Check for specific positions
      const expectedPositions = [
        'Feu de croisement',
        'Feu de route', 
        'Feu de position',
        'Feu antibrouillard',
        'Clignotant avant',
        'Clignotant arrière',
        'Feux arrières',
        'Feu de stop',
        'Éclairage plaque',
        'Éclairage intérieur',
        'Éclairage coffre',
        'Éclairage de jour'
      ];
      
      console.log('\n✅ Checking for expected positions:');
      expectedPositions.forEach(expectedName => {
        const found = positions.find(pos => pos.name === expectedName);
        if (found) {
          console.log(`✅ ${expectedName} - Found (sort: ${found.sort})`);
        } else {
          console.log(`❌ ${expectedName} - Missing`);
        }
      });
    }
    
    return positions;
    
  } catch (error) {
    console.error('💥 Error verifying positions:', error);
    return null;
  }
}

// Run verification
verifyPositions();
