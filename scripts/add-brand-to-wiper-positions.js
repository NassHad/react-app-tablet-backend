const http = require('http');

// Configuration
const API_BASE_URL = 'http://localhost:1338';

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

// Function to update a single wiper product to add brand to each position
async function updateWiperProductBrands(product) {
  console.log(`\nUpdating product: ${product.name} (ID: ${product.id})`);
  
  const positions = product.wipersPositions || [];
  const wiperBrand = product.wiperBrand || 'Valeo';
  
  let hasChanges = false;
  const updatedPositions = positions.map(position => {
    // Check if brand is already present
    if (position.brand && position.brand === wiperBrand) {
      return position; // No change needed
    }
    
    hasChanges = true;
    console.log(`  - Adding brand "${wiperBrand}" to position "${position.position}"`);
    
    return {
      ...position,
      brand: wiperBrand
    };
  });

  if (!hasChanges) {
    console.log('  - No changes needed (brands already present)');
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
      'Content-Type': 'application/json'
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
async function updateAllWiperProductBrands() {
  console.log('🚀 Starting wiper products brand update...\n');
  
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
      const result = await updateWiperProductBrands(product);
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
    console.log(`📊 Total processed: ${allProducts.length}`);

    // Show failed updates
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      console.log('\n❌ Failed updates:');
      failed.forEach(f => {
        console.log(`  - ${f.product}: ${f.message}`);
      });
    }

    console.log('\n🎉 Brand update process completed!');

  } catch (error) {
    console.error('💥 Error during update process:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  updateAllWiperProductBrands();
}

module.exports = { updateAllWiperProductBrands, updateWiperProductBrands };
