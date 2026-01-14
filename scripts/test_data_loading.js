// Test script to verify data loading works
// Copy and paste this into your Strapi console

(async () => {
  console.log('🧪 Testing data loading...');
  
  const fs = require('fs');
  const path = require('path');
  
  try {
    const dataPath = path.join(process.cwd(), 'scripts', 'osram_bulbs_parsed.json');
    console.log('📂 Looking for file at:', dataPath);
    
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const osramData = JSON.parse(rawData);
    
    console.log(`✅ Successfully loaded ${osramData.length} records`);
    console.log('📋 Sample record:', osramData[0]);
    
    // Test unique values
    const brands = [...new Set(osramData.map(item => item.brand))];
    const positions = [...new Set(osramData.map(item => item.position))];
    
    console.log(`📊 Found ${brands.length} unique brands`);
    console.log(`📊 Found ${positions.length} unique positions`);
    console.log('🏷️ Sample brands:', brands.slice(0, 5));
    console.log('🔧 Sample positions:', positions.slice(0, 5));
    
    console.log('✅ Data loading test successful!');
    
  } catch (error) {
    console.error('❌ Data loading failed:', error.message);
    console.log('Make sure the file exists at: scripts/osram_bulbs_parsed.json');
  }
})();
