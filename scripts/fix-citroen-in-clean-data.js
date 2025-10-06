// Fix CITROEN character in cleaned data - Replace citron with citroen
// Copy and paste this ENTIRE script into your Strapi console

const fs = require('fs');
const path = require('path');

(async () => {
  try {
    console.log('🔧 Fixing CITROEN character in cleaned data...');
    
    // Read the cleaned data
    const cleanDataPath = path.join(process.cwd(), 'scripts', 'osram_bulbs_cleaned.json');
    const cleanData = fs.readFileSync(cleanDataPath, 'utf8');
    const data = JSON.parse(cleanData);
    
    console.log(`📊 Original records: ${data.length}`);
    
    // Fix CITROEN brand name
    let fixedCount = 0;
    data.forEach(record => {
      if (record.brandSlug === 'citron') {
        record.brandSlug = 'citroen';
        fixedCount++;
      }
      if (record.originalBrand && record.originalBrand.includes('CITRON')) {
        record.originalBrand = record.originalBrand.replace(/CITRON/g, 'CITROEN');
        fixedCount++;
      }
    });
    
    console.log(`📊 Fixed ${fixedCount} CITROEN references`);
    
    // Save the fixed data
    fs.writeFileSync(cleanDataPath, JSON.stringify(data, null, 2));
    
    console.log('✅ Fixed data saved to osram_bulbs_cleaned.json');
    
    // Verify the fix
    const citroenRecords = data.filter(record => record.brandSlug === 'citroen');
    console.log(`📊 CITROEN records after fix: ${citroenRecords.length}`);
    
    if (citroenRecords.length > 0) {
      console.log('Sample CITROEN records:');
      citroenRecords.slice(0, 5).forEach((record, index) => {
        console.log(`  ${index + 1}. ${record.brandSlug}/${record.modelSlug} (${record.originalBrand})`);
      });
    }
    
    console.log('\n✅ CITROEN character fix complete!');
    console.log('Now you can run the import script again and CITROEN models should be found.');
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
})();
