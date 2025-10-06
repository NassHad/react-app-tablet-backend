// Check Lights Products and their relationships
// This script verifies that the LightsProduct entities are properly created and linked

async function checkLightsProducts() {
  try {
    console.log('🔍 Checking Lights Products and relationships...');
    
    // Check Brands
    const brands = await strapi.entityService.findMany('api::brand.brand', {
      populate: {
        models: {
          populate: {
            lights_products: {
              populate: {
                lights_position: true
              }
            }
          }
        }
      }
    });
    
    console.log(`\n📊 Database Summary:`);
    console.log(`- Brands: ${brands.length}`);
    
    let totalModels = 0;
    let totalProducts = 0;
    let totalPositions = 0;
    
    const positionSet = new Set();
    
    brands.forEach(brand => {
      const modelCount = brand.models?.length || 0;
      totalModels += modelCount;
      
      brand.models?.forEach(model => {
        const productCount = model.lights_products?.length || 0;
        totalProducts += productCount;
        
        model.lights_products?.forEach(product => {
          if (product.lights_position) {
            positionSet.add(product.lights_position.id);
          }
        });
      });
    });
    
    totalPositions = positionSet.size;
    
    console.log(`- Models: ${totalModels}`);
    console.log(`- Lights Products: ${totalProducts}`);
    console.log(`- Unique Positions: ${totalPositions}`);
    
    // Check specific brand/model combinations
    console.log(`\n🔍 Sample Data:`);
    
    const sampleBrands = brands.slice(0, 3);
    sampleBrands.forEach(brand => {
      console.log(`\n🏷️ Brand: ${brand.name} (${brand.slug})`);
      
      const sampleModels = brand.models?.slice(0, 2) || [];
      sampleModels.forEach(model => {
        console.log(`  🚗 Model: ${model.name} (${model.slug})`);
        
        const sampleProducts = model.lights_products?.slice(0, 3) || [];
        sampleProducts.forEach(product => {
          console.log(`     💡 Product: ${product.ref} - ${product.name}`);
          console.log(`        Position: ${product.lights_position?.name || 'No position'}`);
          console.log(`        Category: ${product.category || 'No category'}`);
        });
        
        if (model.lights_products?.length > 3) {
          console.log(`     ... and ${model.lights_products.length - 3} more products`);
        }
      });
    });
    
    // Check for products without relationships
    console.log(`\n🔍 Checking for orphaned products...`);
    
    const orphanedProducts = await strapi.entityService.findMany('api::lights-product.lights-product', {
      filters: {
        $or: [
          { brand: null },
          { model: null },
          { lights_position: null }
        ]
      }
    });
    
    if (orphanedProducts.length > 0) {
      console.log(`⚠️ Found ${orphanedProducts.length} orphaned products:`);
      orphanedProducts.forEach(product => {
        console.log(`  - ${product.ref} (ID: ${product.id})`);
        console.log(`    Brand: ${product.brand ? 'Linked' : 'Missing'}`);
        console.log(`    Model: ${product.model ? 'Linked' : 'Missing'}`);
        console.log(`    Position: ${product.lights_position ? 'Linked' : 'Missing'}`);
      });
    } else {
      console.log(`✅ All products have proper relationships`);
    }
    
    // Check positions
    console.log(`\n🔍 Checking positions...`);
    
    const positions = await strapi.entityService.findMany('api::lights-position.lights-position', {
      populate: {
        lights_products: {
          populate: {
            brand: true,
            model: {
              populate: {
                brand: true
              }
            }
          }
        }
      }
    });
    
    console.log(`- Total Positions: ${positions.length}`);
    
    const positionsWithProducts = positions.filter(pos => pos.lights_products?.length > 0);
    console.log(`- Positions with products: ${positionsWithProducts.length}`);
    
    // Show sample positions
    const samplePositions = positionsWithProducts.slice(0, 3);
    samplePositions.forEach(position => {
      console.log(`\n📍 Position: ${position.name} (${position.slug})`);
      console.log(`   Products: ${position.lights_products?.length || 0}`);
      
      const sampleProducts = position.lights_products?.slice(0, 2) || [];
      sampleProducts.forEach(product => {
        console.log(`     - ${product.ref} (${product.brand?.name} ${product.model?.name})`);
      });
    });
    
    console.log(`\n✅ Check complete!`);
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

// Run the check
checkLightsProducts();
