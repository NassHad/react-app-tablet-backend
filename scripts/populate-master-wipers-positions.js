const fs = require('fs');
const path = require('path');

// Configuration
const WIPERS_DATA_PATH = path.join(__dirname, 'wipers', 'wipers_database.json');

// Helper function to create slug
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

// Helper function to delay execution
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function populateMasterWipersPositions() {
  try {
    console.log('🚀 Starting master wipers positions population...');
    
    // Check if wipers data file exists
    if (!fs.existsSync(WIPERS_DATA_PATH)) {
      throw new Error(`Wipers data file not found at: ${WIPERS_DATA_PATH}`);
    }
    
    // Load wipers data
    console.log('📖 Loading wipers data...');
    const wipersData = JSON.parse(fs.readFileSync(WIPERS_DATA_PATH, 'utf8'));
    
    if (!wipersData.brands) {
      throw new Error('Invalid wipers data format: brands property not found');
    }
    
    // Define master positions based on the wipers data structure
    const masterPositions = [
      // Multiconnexion positions
      {
        name: 'Kit Avant',
        category: 'multiconnexion',
        ref: 'kitAvant',
        sortOrder: 1,
        description: 'Kit avant multiconnexion'
      },
      {
        name: 'Côté Conducteur',
        category: 'multiconnexion',
        ref: 'coteConducteur',
        sortOrder: 2,
        description: 'Côté conducteur multiconnexion'
      },
      {
        name: 'Mono Balais',
        category: 'multiconnexion',
        ref: 'monoBalais',
        sortOrder: 3,
        description: 'Mono balais multiconnexion'
      },
      {
        name: 'Côté Passager',
        category: 'multiconnexion',
        ref: 'cotePassager',
        sortOrder: 4,
        description: 'Côté passager multiconnexion'
      },
      
      // Standard positions
      {
        name: 'Côté Conducteur Standard',
        category: 'standard',
        ref: 'coteConducteur',
        sortOrder: 5,
        description: 'Côté conducteur standard'
      },
      {
        name: 'Mono Balais Standard',
        category: 'standard',
        ref: 'monoBalais',
        sortOrder: 6,
        description: 'Mono balais standard'
      },
      {
        name: 'Côté Passager Standard',
        category: 'standard',
        ref: 'cotePassager',
        sortOrder: 7,
        description: 'Côté passager standard'
      },
      
      // Rear position
      {
        name: 'Arrière',
        category: 'arriere',
        ref: 'arriere',
        sortOrder: 8,
        description: 'Balai arrière'
      }
    ];
    
    console.log(`📋 Found ${masterPositions.length} master positions to create`);
    
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    // Process each master position
    for (const positionData of masterPositions) {
      try {
        // Check if position already exists
        const existingPositions = await strapi.entityService.findMany('api::wipers-position.wipers-position', {
          filters: {
            name: positionData.name,
            category: positionData.category
          }
        });
        
        if (existingPositions.length > 0) {
          console.log(`⏭️  Skipping position "${positionData.name}" (${positionData.category}): already exists`);
          totalSkipped++;
          continue;
        }
        
        // Create position
        const positionToCreate = {
          name: positionData.name,
          slug: slugify(positionData.name),
          description: positionData.description,
          category: positionData.category,
          ref: positionData.ref,
          sortOrder: positionData.sortOrder,
          sort: positionData.sortOrder,
          usageCount: 0,
          isActive: true,
          publishedAt: new Date()
        };
        
        const createdPosition = await strapi.entityService.create('api::wipers-position.wipers-position', {
          data: positionToCreate
        });
        
        console.log(`✅ Created position: "${positionData.name}" (${positionData.category})`);
        totalCreated++;
        
        // Small delay to avoid overwhelming the database
        await delay(100);
        
      } catch (error) {
        console.error(`❌ Error creating position "${positionData.name}":`, error.message);
        totalErrors++;
      }
    }
    
    console.log('\n🎉 Master wipers positions population completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Created: ${totalCreated}`);
    console.log(`   - Skipped: ${totalSkipped}`);
    console.log(`   - Errors: ${totalErrors}`);
    
    // Display all created positions
    console.log('\n📋 All wipers positions:');
    const allPositions = await strapi.entityService.findMany('api::wipers-position.wipers-position', {
      sort: ['sortOrder:asc']
    });
    
    allPositions.forEach(position => {
      console.log(`   - ${position.name} (${position.category}) - Sort: ${position.sortOrder}`);
    });
    
  } catch (error) {
    console.error('💥 Population failed:', error);
    throw error;
  }
}

// Run the population if this script is executed directly
if (require.main === module) {
  populateMasterWipersPositions()
    .then(() => {
      console.log('✅ Population completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Population failed:', error);
      process.exit(1);
    });
}

module.exports = { populateMasterWipersPositions };
