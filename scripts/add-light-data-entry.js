/**
 * Script to add light data entries to the LightData entity
 * Run this in the Strapi console: node scripts/add-light-data-entry.js
 */

const path = require('path');
const fs = require('fs');

async function addLightDataEntry() {
  try {
    console.log('🚀 Starting LightData entry creation...');

    // Example light data entry
    const lightDataEntry = {
      ref: 'H7',
      brand: 'Osram',
      description: 'H7 halogen bulb for headlights',
      category: 'light',
      isActive: true,
      // Note: img and brandImg will need to be uploaded manually through the admin panel
    };

    // Create the entry
    const entry = await strapi.entityService.create('api::light-data.light-data', {
      data: lightDataEntry
    });

    console.log('✅ LightData entry created successfully:', entry);
    console.log('📝 Entry ID:', entry.id);
    console.log('🔍 Reference:', entry.ref);
    console.log('🏷️ Brand:', entry.brand);

    // You can add more entries by repeating this process
    // or modify the script to add multiple entries at once

  } catch (error) {
    console.error('❌ Error creating LightData entry:', error);
  }
}

// Run the function
addLightDataEntry();
