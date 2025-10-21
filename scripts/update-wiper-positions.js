const http = require('http');

// Configuration
const API_BASE_URL = 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || ''; // Add your API token if needed

// Position mapping from French to English
const POSITION_MAPPING = {
  'Côté Conducteur': 'Driver',
  'Côté Passager': 'Passenger', 
  'Arrière': 'Back',
  'côté-conducteur': 'driver',
  'côté-passager': 'passenger',
  'arrière': 'back'
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

// Function to update a single wiper product
async function updateWiperProduct(product) {
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

  // Prepare update data
  const updateData = {
    data: {
      wipersPositions: updatedPositions
    }
  };

  // Make the update request using documentId for Strapi v5
  const options = {
    hostname: 'localhost',
    port: 1338,
    path: `/api/wipers-products/${product.documentId}`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(API_TOKEN && { 'Authorization': `Bearer ${API_TOKEN}` })
    }
  };

  try {
    const response = await makeRequest(options, updateData);
    
    if (response.status === 200) {
      console.log('  ✅ Successfully updated');
      return { success: true, message: 'Updated successfully' };
    } else {
      console.log(`  ❌ Failed to update: ${response.status}`);
      return { success: false, message: `HTTP ${response.status}` };
    }
  } catch (error) {
    console.log(`  ❌ Error updating: ${error.message}`);
    return { success: false, message: error.message };
  }
}

// Main function
async function updateAllWiperProducts() {
  console.log('🚀 Starting wiper products position update...\n');
  
  try {
    // Get all wiper products with pagination
    console.log('📥 Fetching all wiper products...');
    let allProducts = [];
    let page = 1;
    const pageSize = 100;
    let hasMorePages = true;

    while (hasMorePages) {
      console.log(`📄 Fetching page ${page}...`);
      const getOptions = {
        hostname: 'localhost',
        port: 1338,
        path: `/api/wipers-products?pagination[page]=${page}&pagination[pageSize]=${pageSize}`,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(API_TOKEN && { 'Authorization': `Bearer ${API_TOKEN}` })
        }
      };

      const response = await makeRequest(getOptions);
      
      if (response.status !== 200) {
        console.error('Response status:', response.status);
        console.error('Response data:', response.data);
        throw new Error(`Failed to fetch products: HTTP ${response.status}`);
      }

      const products = response.data.data || [];
      allProducts = allProducts.concat(products);
      
      console.log(`📊 Found ${products.length} products on page ${page}`);
      
      // Check if there are more pages
      hasMorePages = products.length === pageSize;
      page++;
    }

    console.log(`📊 Total products found: ${allProducts.length}\n`);

    if (allProducts.length === 0) {
      console.log('ℹ️  No products found to update');
      return;
    }

    // Update all products
    console.log(`🔄 Processing all ${allProducts.length} products\n`);

    // Update each product
    let successCount = 0;
    let errorCount = 0;
    const results = [];

    for (const product of allProducts) {
      const result = await updateWiperProduct(product);
      results.push({ product: product.name, ...result });
      
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
      }
      
      // Add a small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
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

module.exports = { updateAllWiperProducts, updateWiperProduct, POSITION_MAPPING };
