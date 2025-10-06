// Test script to run in Strapi console
// Copy and paste this into the Strapi console

async function testMasterLightPositions() {
  try {
    console.log('🚀 Testing Master LightPosition creation...');
    
    // Master list of all 12 light positions
    const masterPositions = [
      { name: "Feu de croisement", category: "feu_croisement", sort: 1 },
      { name: "Feu de route", category: "feu_route", sort: 2 },
      { name: "Feu de position", category: "feu_position", sort: 3 },
      { name: "Feu antibrouillard", category: "feu_antibrouillard", sort: 4 },
      { name: "Clignotant avant", category: "clignotant_avant_voiture", sort: 5 },
      { name: "Clignotant arrière", category: "clignotant_arriere_voiture", sort: 6 },
      { name: "Feux arrières", category: "feu_arriere", sort: 7 },
      { name: "Feu de stop", category: "feu_stop", sort: 8 },
      { name: "Éclairage plaque", category: "feu_plaque_immatriculation", sort: 9 },
      { name: "Éclairage intérieur", category: "eclairage_interieur", sort: 10 },
      { name: "Éclairage coffre", category: "eclairage_coffre", sort: 11 },
      { name: "Éclairage de jour", category: "eclairage_jour", sort: 12 }
    ];
    
    console.log(`📋 Testing with ${masterPositions.length} master positions`);
    
    // Check existing positions
    const existingPositions = await strapi.entityService.findMany('api::lights-position.lights-position', {
      sort: ['sort:asc'],
      filters: { isActive: true }
    });
    
    console.log(`📊 Current positions in database: ${existingPositions.length}`);
    
    if (existingPositions.length > 0) {
      console.log('\n📋 Current positions:');
      existingPositions.forEach((pos, index) => {
        console.log(`${index + 1}. ${pos.name} (${pos.category}) - Sort: ${pos.sort || 'N/A'}`);
      });
    }
    
    // Test creating one position
    const testPosition = masterPositions[0]; // "Feu de croisement"
    
    console.log(`\n🧪 Testing creation of: ${testPosition.name}`);
    
    // Check if it already exists
    const existing = await strapi.entityService.findMany('api::lights-position.lights-position', {
      filters: { category: testPosition.category }
    });
    
    if (existing.length > 0) {
      console.log(`⏭️  Position "${testPosition.name}" already exists`);
      
      // Test updating it
      const updatedPosition = await strapi.entityService.update('api::lights-position.lights-position', existing[0].id, {
        data: {
          name: testPosition.name,
          slug: testPosition.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          description: `Light position for ${testPosition.name}`,
          category: testPosition.category,
          sort: testPosition.sort,
          isActive: true
        }
      });
      
      console.log(`🔄 Updated: ${updatedPosition.name} (sort: ${updatedPosition.sort})`);
    } else {
      // Test creating it
      const newPosition = await strapi.entityService.create('api::lights-position.lights-position', {
        data: {
          name: testPosition.name,
          slug: testPosition.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          description: `Light position for ${testPosition.name}`,
          category: testPosition.category,
          sort: testPosition.sort,
          isActive: true,
          usageCount: 0
        }
      });
      
      console.log(`✅ Created: ${newPosition.name} (sort: ${newPosition.sort})`);
    }
    
    // Show what the complete list would look like
    console.log('\n📋 Complete master position list:');
    masterPositions.forEach((pos, index) => {
      console.log(`${index + 1}. ${pos.name} (${pos.category}) - Sort: ${pos.sort}`);
    });
    
    return {
      totalPositions: masterPositions.length,
      currentPositions: existingPositions.length,
      masterList: masterPositions
    };
    
  } catch (error) {
    console.error('💥 Error during test:', error);
    return null;
  }
}

// Run the test
testMasterLightPositions();
