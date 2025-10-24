const fs = require('fs');
const path = require('path');

/**
 * Export all brands and models from Strapi database
 */

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

// Helper function to make API calls to Strapi
async function strapiRequest(endpoint, method = 'GET') {
  const url = `${STRAPI_URL}/api${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(API_TOKEN && { 'Authorization': `Bearer ${API_TOKEN}` })
    }
  };

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`❌ API Error for ${endpoint}:`, error.message);
    throw error;
  }
}

// Export brands
async function exportBrands() {
  console.log('📥 Fetching all brands from Strapi...');
  
  try {
    const response = await strapiRequest('/brands?pagination[limit]=1000&populate=*');
    const brands = response.data;
    
    console.log(`✅ Found ${brands.length} brands`);
    
    // Create a simple list (handle both nested and flat structures)
    const brandList = brands.map(brand => ({
      id: brand.id,
      name: brand.attributes?.name || brand.name,
      slug: brand.attributes?.slug || brand.slug
    })).filter(brand => brand.name); // Filter out any invalid entries
    
    // Save to file
    const outputPath = path.join(__dirname, 'export-brands.json');
    fs.writeFileSync(outputPath, JSON.stringify(brandList, null, 2));
    console.log(`💾 Brands exported to: ${outputPath}`);
    
    // Also create a CSV
    const csvPath = path.join(__dirname, 'export-brands.csv');
    const csvContent = 'id;name;slug\n' + brandList.map(b => `${b.id};${b.name};${b.slug}`).join('\n');
    fs.writeFileSync(csvPath, csvContent);
    console.log(`💾 Brands exported to CSV: ${csvPath}`);
    
    return brandList;
  } catch (error) {
    console.error('❌ Failed to export brands:', error.message);
    throw error;
  }
}

// Export models
async function exportModels() {
  console.log('\n📥 Fetching all models from Strapi...');
  
  try {
    const response = await strapiRequest('/models?pagination[limit]=10000&populate=brand');
    const models = response.data;
    
    console.log(`✅ Found ${models.length} models`);
    
    // Create a detailed list (handle both nested and flat structures)
    const modelList = models.map(model => ({
      id: model.id,
      name: model.attributes?.name || model.name,
      slug: model.attributes?.slug || model.slug,
      brandId: model.attributes?.brand?.data?.id || model.brand?.id || null,
      brandName: model.attributes?.brand?.data?.attributes?.name || model.brand?.name || null
    })).filter(model => model.name); // Filter out any invalid entries
    
    // Save to file
    const outputPath = path.join(__dirname, 'export-models.json');
    fs.writeFileSync(outputPath, JSON.stringify(modelList, null, 2));
    console.log(`💾 Models exported to: ${outputPath}`);
    
    // Also create a CSV
    const csvPath = path.join(__dirname, 'export-models.csv');
    const csvContent = 'id;name;slug;brandId;brandName\n' + 
      modelList.map(m => `${m.id};${m.name};${m.slug};${m.brandId || ''};${m.brandName || ''}`).join('\n');
    fs.writeFileSync(csvPath, csvContent);
    console.log(`💾 Models exported to CSV: ${csvPath}`);
    
    return modelList;
  } catch (error) {
    console.error('❌ Failed to export models:', error.message);
    throw error;
  }
}

// Export filter compatibilities
async function exportFilterCompatibilities() {
  console.log('\n📥 Fetching all filter compatibilities from Strapi...');
  
  try {
    const response = await strapiRequest('/filter-compatibilities?pagination[limit]=10000&populate=*');
    const compatibilities = response.data;
    
    console.log(`✅ Found ${compatibilities.length} filter compatibilities`);
    
    // Create a detailed list
    const compatList = compatibilities.map(compat => ({
      id: compat.id,
      vehicleModel: compat.attributes.vehicleModel,
      vehicleVariant: compat.attributes.vehicleVariant,
      engineCode: compat.attributes.engineCode,
      brandId: compat.attributes.brand?.data?.id || null,
      brandName: compat.attributes.brand?.data?.attributes?.name || null,
      modelId: compat.attributes.model?.data?.id || null,
      modelName: compat.attributes.model?.data?.attributes?.name || null
    }));
    
    // Save to file
    const outputPath = path.join(__dirname, 'export-filter-compatibilities.json');
    fs.writeFileSync(outputPath, JSON.stringify(compatList, null, 2));
    console.log(`💾 Filter compatibilities exported to: ${outputPath}`);
    
    // Also create a CSV
    const csvPath = path.join(__dirname, 'export-filter-compatibilities.csv');
    const csvContent = 'id;vehicleModel;vehicleVariant;engineCode;brandId;brandName;modelId;modelName\n' + 
      compatList.map(c => `${c.id};${c.vehicleModel || ''};${c.vehicleVariant || ''};${c.engineCode || ''};${c.brandId || ''};${c.brandName || ''};${c.modelId || ''};${c.modelName || ''}`).join('\n');
    fs.writeFileSync(csvPath, csvContent);
    console.log(`💾 Filter compatibilities exported to CSV: ${csvPath}`);
    
    return compatList;
  } catch (error) {
    console.error('❌ Failed to export filter compatibilities:', error.message);
    throw error;
  }
}

// Main export function
async function runExport() {
  console.log('🎯 Starting Database Export');
  console.log('='.repeat(60));
  
  try {
    const brands = await exportBrands();
    const models = await exportModels();
    const compatibilities = await exportFilterCompatibilities();
    
    console.log('\n📊 Export Summary:');
    console.log(`   ✅ Brands: ${brands.length}`);
    console.log(`   ✅ Models: ${models.length}`);
    console.log(`   ✅ Filter Compatibilities: ${compatibilities.length}`);
    
    console.log('\n✅ Export complete! Check the scripts folder for the exported files.');
    
  } catch (error) {
    console.error('\n💥 Export failed:', error.message);
    process.exit(1);
  }
}

// Run the export if this script is executed directly
if (require.main === module) {
  runExport()
    .then(() => {
      console.log('\n🎉 Export script finished!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Export script failed:', error);
      process.exit(1);
    });
}

module.exports = { runExport, exportBrands, exportModels, exportFilterCompatibilities };

