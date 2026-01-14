const fs = require('fs');
const path = require('path');

/**
 * Add vehicleType property to model JSON files
 *
 * Usage: node scripts/add-vehicle-type-to-models.js
 */

// File paths
const CAR_MODELS_FILE = path.join(__dirname, 'json_data', 'cleaned_models.json');
const MOTO_MODELS_FILE = path.join(__dirname, 'json_data', 'moto_models.json');

/**
 * Add vehicleType to models
 */
function addVehicleType(filePath, vehicleType) {
  console.log(`\nProcessing ${path.basename(filePath)}...`);

  // Read the file
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  console.log(`Found ${data.length} models`);

  // Add vehicleType to each model
  const updatedData = data.map(model => ({
    ...model,
    vehicleType: vehicleType
  }));

  // Write back to file
  fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2), 'utf8');

  console.log(`✅ Added vehicleType: "${vehicleType}" to ${updatedData.length} models`);
}

// Main execution
try {
  console.log('🚗 Adding vehicleType to model JSON files...\n');

  // Update car models
  addVehicleType(CAR_MODELS_FILE, 'car');

  // Update moto models
  addVehicleType(MOTO_MODELS_FILE, 'moto');

  console.log('\n✅ All done! Both files have been updated.');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
