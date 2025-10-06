const fs = require('fs');
const path = require('path');

async function populateMasterLightPositions() {
  try {
    console.log('🚀 Starting Master LightPosition population...');
    
    // Master list of all 12 light positions with proper sorting
    const masterPositions = [
      {
        name: "Feu de croisement",
        category: "feu_croisement",
        description: "Low beam headlights for normal driving at night",
        sort: 1
      },
      {
        name: "Feu de route", 
        category: "feu_route",
        description: "High beam headlights for long distance driving",
        sort: 2
      },
      {
        name: "Feu de position",
        category: "feu_position", 
        description: "Position lights for vehicle visibility",
        sort: 3
      },
      {
        name: "Feu antibrouillard",
        category: "feu_antibrouillard",
        description: "Fog lights for poor visibility conditions",
        sort: 4
      },
      {
        name: "Clignotant avant",
        category: "clignotant_avant_voiture",
        description: "Front turn signal lights",
        sort: 5
      },
      {
        name: "Clignotant arrière",
        category: "clignotant_arriere_voiture", 
        description: "Rear turn signal lights",
        sort: 6
      },
      {
        name: "Feux arrières",
        category: "feu_arriere",
        description: "Rear tail lights for vehicle visibility",
        sort: 7
      },
      {
        name: "Feu de stop",
        category: "feu_stop",
        description: "Brake lights that activate when braking",
        sort: 8
      },
      {
        name: "Éclairage plaque",
        category: "feu_plaque_immatriculation",
        description: "License plate illumination lights",
        sort: 9
      },
      {
        name: "Éclairage intérieur",
        category: "eclairage_interieur",
        description: "Interior cabin lighting",
        sort: 10
      },
      {
        name: "Éclairage coffre",
        category: "eclairage_coffre",
        description: "Trunk/boot interior lighting",
        sort: 11
      },
      {
        name: "Éclairage de jour",
        category: "eclairage_jour",
        description: "Daytime running lights (DRL) for enhanced visibility",
        sort: 12
      }
    ];
    
    console.log(`📋 Creating ${masterPositions.length} master light positions...`);
    
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const position of masterPositions) {
      try {
        // Check if position already exists by category
        const existing = await strapi.entityService.findMany('api::lights-position.lights-position', {
          filters: { category: position.category }
        });
        
        if (existing.length > 0) {
          // Update existing position
          const existingPosition = existing[0];
          const updatedPosition = await strapi.entityService.update('api::lights-position.lights-position', existingPosition.id, {
            data: {
              name: position.name,
              slug: position.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
              description: position.description,
              category: position.category,
              sort: position.sort,
              isActive: true
            }
          });
          
          console.log(`🔄 Updated: ${position.name} (sort: ${position.sort})`);
          updatedCount++;
        } else {
          // Create new position
          const newPosition = await strapi.entityService.create('api::lights-position.lights-position', {
            data: {
              name: position.name,
              slug: position.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
              description: position.description,
              category: position.category,
              sort: position.sort,
              isActive: true,
              usageCount: 0 // Will be updated later if needed
            }
          });
          
          console.log(`✅ Created: ${position.name} (sort: ${position.sort})`);
          createdCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error processing position ${position.name}:`, error.message);
      }
    }
    
    console.log('\n🎉 Master LightPosition population completed!');
    console.log(`📈 Summary:`);
    console.log(`   - Total positions processed: ${masterPositions.length}`);
    console.log(`   - New positions created: ${createdCount}`);
    console.log(`   - Existing positions updated: ${updatedCount}`);
    console.log(`   - Errors: ${masterPositions.length - createdCount - updatedCount}`);
    
    // Verify the results
    console.log('\n🔍 Verifying results...');
    const allPositions = await strapi.entityService.findMany('api::lights-position.lights-position', {
      sort: ['sort:asc'],
      filters: { isActive: true }
    });
    
    console.log(`📊 Total positions in database: ${allPositions.length}`);
    console.log('\n📋 Master position list:');
    allPositions.forEach((pos, index) => {
      console.log(`${index + 1}. ${pos.name} (${pos.category}) - Sort: ${pos.sort}`);
    });
    
  } catch (error) {
    console.error('💥 Error during Master LightPosition population:', error);
  }
}

// Run the script
populateMasterLightPositions()
  .then(() => {
    console.log('✨ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
