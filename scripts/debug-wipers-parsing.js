// Debug script to understand the wipers parsing issue
// Copy and paste this into Strapi console

function debugWipersParsing() {
  try {
    console.log('🔍 Debugging wipers parsing issue...');
    
    // Load wipers data
    const fs = require('fs');
    const path = require('path');
    const WIPERS_DATA_PATH = path.join(process.cwd(), 'scripts', 'wipers', 'wipers_database.json');
    
    const wipersData = JSON.parse(fs.readFileSync(WIPERS_DATA_PATH, 'utf8'));
    
    // Find a specific example with arriere data
    const brands = Object.keys(wipersData.brands);
    let foundExample = null;
    
    for (const brandName of brands.slice(0, 5)) { // Check first 5 brands
      const brandData = wipersData.brands[brandName];
      if (Array.isArray(brandData)) {
        for (const modelData of brandData.slice(0, 2)) { // Check first 2 models
          if (modelData.wipers && modelData.wipers.arriere) {
            foundExample = {
              brand: brandName,
              model: modelData.model,
              wipers: modelData.wipers
            };
            break;
          }
        }
        if (foundExample) break;
      }
    }
    
    if (!foundExample) {
      console.log('❌ No example found with arriere data');
      return;
    }
    
    console.log('📋 Found example:');
    console.log(`   Brand: ${foundExample.brand}`);
    console.log(`   Model: ${foundExample.model}`);
    console.log('📋 Raw wipers data:');
    console.log(JSON.stringify(foundExample.wipers, null, 2));
    
    // Test the current transformWipersToPositions function
    console.log('\n🔍 Testing current transformWipersToPositions function...');
    
    function transformWipersToPositions(wipersData) {
      const positions = [];
      
      console.log('🔍 Processing wipersData keys:', Object.keys(wipersData));
      
      // Process each category (standard, multiconnexion, etc.)
      Object.keys(wipersData).forEach(category => {
        console.log(`🔍 Processing category: ${category}`);
        const categoryData = wipersData[category];
        console.log(`🔍 Category data type: ${typeof categoryData}`);
        console.log(`🔍 Category data:`, categoryData);
        
        if (!categoryData) return;
        
        // Skip description-only categories
        if (category === 'arriereDescription') return;
        
        // Process each position in the category
        Object.keys(categoryData).forEach(positionKey => {
          console.log(`🔍 Processing position: ${positionKey}`);
          const ref = categoryData[positionKey];
          console.log(`🔍 Ref value: "${ref}" (type: ${typeof ref})`);
          
          if (!ref) return;
          
          // Skip description keys
          if (positionKey.endsWith('Description')) return;
          
          // Map position keys to French names
          const positionNames = {
            'kitAvant': 'Kit Avant',
            'coteConducteur': 'Côté Conducteur',
            'monoBalais': 'Mono Balais',
            'cotePassager': 'Côté Passager',
            'arriere': 'Arrière'
          };
          
          const positionName = positionNames[positionKey] || positionKey;
          const descriptionKey = `${positionKey}Description`;
          let description = categoryData[descriptionKey] || null;
          
          console.log(`🔍 Position: ${positionName}, Ref: "${ref}", Description: "${description}"`);
          
          positions.push({
            position: positionName,
            ref: ref,
            description: description,
            category: category
          });
        });
      });
      
      // Handle standalone arriere position (not inside a category)
      if (wipersData.arriere && !positions.some(p => p.position === 'Arrière')) {
        console.log('🔍 Processing standalone arriere...');
        console.log(`🔍 Arriere value: "${wipersData.arriere}" (type: ${typeof wipersData.arriere})`);
        const description = wipersData.arriereDescription || null;
        console.log(`🔍 Arriere description: "${description}"`);
        
        positions.push({
          position: 'Arrière',
          ref: wipersData.arriere,
          description: description,
          category: 'arriere'
        });
      }
      
      return positions;
    }
    
    const result = transformWipersToPositions(foundExample.wipers);
    console.log('\n📋 Final result:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugWipersParsing();
