// Test script to verify Osram data structure
// Run this in Strapi console to check your data

console.log('🧪 Testing Osram Data Structure...');

const fs = require('fs');
const path = require('path');

try {
  const dataPath = path.join(process.cwd(), 'scripts', 'osram_bulbs_parsed.json');
  const rawData = fs.readFileSync(dataPath, 'utf8');
  const osramData = JSON.parse(rawData);
  
  console.log(`✅ Successfully loaded ${osramData.length} records`);
  
  // Check first few records
  console.log('\n📋 Sample records:');
  for (let i = 0; i < Math.min(3, osramData.length); i++) {
    console.log(`\nRecord ${i + 1}:`);
    console.log(`- Brand: ${osramData[i].brand}`);
    console.log(`- Model: ${osramData[i].model}`);
    console.log(`- Construction Year: ${osramData[i].constructionYear.start} - ${osramData[i].constructionYear.end}`);
    console.log(`- Light Type: ${osramData[i].lightType}`);
    console.log(`- Position: ${osramData[i].position}`);
    console.log(`- Category: ${osramData[i].category}`);
    console.log(`- Type Conception: ${osramData[i].typeConception}`);
  }
  
  // Analyze unique values
  const brands = [...new Set(osramData.map(item => item.brand))];
  const positions = [...new Set(osramData.map(item => item.position))];
  const categories = [...new Set(osramData.map(item => item.category))];
  const lightTypes = [...new Set(osramData.map(item => item.lightType))];
  const typeConceptions = [...new Set(osramData.map(item => item.typeConception))];
  
  console.log('\n📊 Data Analysis:');
  console.log(`- Total records: ${osramData.length}`);
  console.log(`- Unique brands: ${brands.length}`);
  console.log(`- Unique positions: ${positions.length}`);
  console.log(`- Unique categories: ${categories.length}`);
  console.log(`- Unique light types: ${lightTypes.length}`);
  console.log(`- Unique type conceptions: ${typeConceptions.length}`);
  
  console.log('\n🏷️ Categories:');
  categories.forEach(cat => console.log(`  - ${cat}`));
  
  console.log('\n🔧 Light Types (first 10):');
  lightTypes.slice(0, 10).forEach(type => console.log(`  - ${type}`));
  
  console.log('\n💡 Type Conceptions:');
  typeConceptions.forEach(type => console.log(`  - ${type}`));
  
  console.log('\n✅ Data structure looks good! Ready for import.');
  
} catch (error) {
  console.error('❌ Error loading or analyzing data:', error.message);
  console.log('Make sure the file exists at: scripts/osram_bulbs_parsed.json');
}
