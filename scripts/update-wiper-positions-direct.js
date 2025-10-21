const http = require('http');

// Configuration
const API_BASE_URL = 'http://localhost:1338';

// Position mapping from French to English
const POSITION_MAPPING = {
  'Côté Conducteur': 'Driver',
  'Côté Passager': 'Passenger', 
  'Arrière': 'Back'
};

// Function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (e) => {
      console.error('Request error:', e.message);
      reject(e);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Function to update a single wiper product using Strapi's entity service approach
async function updateWiperProductDirect(product) {
  console.log(`\nUpdating product: ${product.name} (ID: ${product.id})`);
  
  let hasChanges = false;
  const updatedPositions = product.wipersPositions.map(position => {
    const originalPosition = position.position;
    const newPosition = POSITION_MAPPING[originalPosition] || originalPosition;
    
    if (originalPosition !== newPosition) {
      console.log(`  - Changing "${originalPosition}" to "${newPosition}"`);
      hasChanges = true;
      return {
        ...position,
        position: newPosition
      };
    }
    
    return position;
  });

  if (!hasChanges) {
    console.log('  - No changes needed');
    return { success: true, message: 'No changes needed' };
  }

  // Use Strapi's internal API endpoint for updates
  const updateData = {
    data: {
      wipersPositions: updatedPositions
    }
  };

  // Try different endpoint formats
  const endpoints = [
    `/api/wipers-products/${product.documentId}`,
    `/api/wipers-products/${product.id}`,
    `/api/wipers-products/${product.documentId}?populate=*`
  ];

  for (const endpoint of endpoints) {
    console.log(`  - Trying endpoint: ${endpoint}`);
    
    const options = {
      hostname: 'localhost',
      port: 1338,
      path: endpoint,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    try {
      const response = await makeRequest(options, updateData);
      
      if (response.status === 200) {
        console.log('  ✅ Successfully updated');
        return { success: true, message: 'Updated successfully' };
      } else {
        console.log(`  ❌ Failed with status ${response.status}: ${JSON.stringify(response.data).substring(0, 100)}`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }

  return { success: false, message: 'All endpoints failed' };
}

// Main function
async function updateAllWiperProducts() {
  console.log('🚀 Starting wiper products position update...\n');
  
  try {
    // Get all wiper products
    console.log('📥 Fetching all wiper products...');
    const getOptions = {
      hostname: 'localhost',
      port: 1338,
      path: '/api/wipers-products?pagination[pageSize]=5',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const response = await makeRequest(getOptions);
    
    if (response.status !== 200) {
      console.error('Response status:', response.status);
      console.error('Response data:', response.data);
      throw new Error(`Failed to fetch products: HTTP ${response.status}`);
    }

    const products = response.data.data || [];
    console.log(`📊 Found ${products.length} wiper products\n`);

    if (products.length === 0) {
      console.log('ℹ️  No products found to update');
      return;
    }

    // Update each product
    let successCount = 0;
    let errorCount = 0;
    const results = [];

    for (const product of products) {
      const result = await updateWiperProductDirect(product);
      results.push({ product: product.name, ...result });
      
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
      }
      
      // Add a small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Summary
    console.log('\n📈 Update Summary:');
    console.log(`✅ Successfully updated: ${successCount}`);
    console.log(`❌ Failed to update: ${errorCount}`);
    console.log(`📊 Total processed: ${products.length}`);

    // Show failed updates
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      console.log('\n❌ Failed updates:');
      failed.forEach(f => {
        console.log(`  - ${f.product}: ${f.message}`);
      });
    }

    console.log('\n🎉 Update process completed!');

  } catch (error) {
    console.error('💥 Error during update process:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  updateAllWiperProducts();
}

module.exports = { updateAllWiperProducts, updateWiperProductDirect, POSITION_MAPPING };
