// Script to manually add battery data entries
// Run this in Strapi console: npx strapi console

async function addBatteryDataEntry(ref, brand, description = null) {
  try {
    console.log(`🔋 Adding battery data entry: ${ref} (${brand})`);
    
    // Check if entry already exists
    const existing = await strapi.entityService.findMany('api::battery-data.battery-data', {
      filters: {
        ref: ref
      }
    });
    
    if (existing && existing.length > 0) {
      console.log(`⚠️  Battery data entry with ref "${ref}" already exists`);
      return existing[0];
    }
    
    // Create new battery data entry
    const batteryData = await strapi.entityService.create('api::battery-data.battery-data', {
      data: {
        ref: ref,
        brand: brand,
        description: description,
        isActive: true,
        category: 'battery'
      }
    });
    
    console.log(`✅ Created battery data entry: ${ref} (${brand}) (ID: ${batteryData.id})`);
    console.log('💡 You can now upload images via Strapi admin panel');
    
    return batteryData;
    
  } catch (error) {
    console.error(`❌ Error creating battery data entry "${ref}":`, error.message);
    throw error;
  }
}

// Helper function to add multiple entries at once
async function addMultipleBatteryDataEntries(entries) {
  try {
    console.log(`🔋 Adding ${entries.length} battery data entries...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const entry of entries) {
      try {
        await addBatteryDataEntry(entry.ref, entry.brand, entry.description);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to add ${entry.ref}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📈 Batch Add Summary:');
    console.log(`✅ Successfully added: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${entries.length}`);
    
  } catch (error) {
    console.error('💥 Fatal error during batch add:', error);
  }
}

// Example usage function
async function addExampleBatteryData() {
  const exampleEntries = [
    { ref: 'F7', brand: 'Fulmen Endurance', description: 'Conventional battery type F7' },
    { ref: 'F1', brand: 'Fulmen Endurance', description: 'Conventional battery type F1' },
    { ref: 'F32', brand: 'Fulmen Endurance', description: 'EFB battery type F32' },
    { ref: 'F30', brand: 'Fulmen Endurance', description: 'EFB battery type F30' },
    { ref: 'F43', brand: 'Fulmen Endurance', description: 'AGM battery type F43' },
    { ref: 'FL1000', brand: 'Fulmen Endurance', description: 'EFB battery type FL1000' },
    { ref: 'FL1050', brand: 'Fulmen Endurance', description: 'EFB battery type FL1050' },
    { ref: 'FL652', brand: 'Fulmen Endurance', description: 'EFB battery type FL652' },
    { ref: 'FL955', brand: 'Fulmen Endurance', description: 'EFB battery type FL955' },
    { ref: 'FL752', brand: 'Fulmen Endurance', description: 'EFB battery type FL752' }
  ];
  
  await addMultipleBatteryDataEntries(exampleEntries);
}

// Export functions for console use
module.exports = { 
  addBatteryDataEntry, 
  addMultipleBatteryDataEntries, 
  addExampleBatteryData 
};
