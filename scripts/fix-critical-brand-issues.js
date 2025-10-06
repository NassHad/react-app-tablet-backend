// Fix Critical Brand Issues - Fix citron->citroen and other critical problems
// Copy and paste this ENTIRE script into your Strapi console

(async () => {
  try {
    console.log('🔧 Starting Critical Brand Issues Fix...');
    
    // 1. Fix citron -> citroen brand name
    console.log('\n1. Fixing citron -> citroen brand...');
    
    const citronBrand = await strapi.entityService.findMany('api::brand.brand', {
      filters: { slug: 'citron' }
    });
    
    if (citronBrand.length > 0) {
      console.log(`Found citron brand with ${citronBrand[0].models?.length || 0} models`);
      
      // Update the brand name and slug
      await strapi.entityService.update('api::brand.brand', citronBrand[0].id, {
        data: {
          name: 'CITROEN',
          slug: 'citroen'
        }
      });
      
      console.log('✅ Updated citron -> citroen');
    } else {
      console.log('❌ citron brand not found');
    }
    
    // 2. Create missing brands
    console.log('\n2. Creating missing brands...');
    
    const missingBrands = [
      { name: 'AUTOBIANCHI', slug: 'autobianchi' },
      { name: 'IRMSCHER', slug: 'irmscher' }
    ];
    
    for (const brandData of missingBrands) {
      const existingBrand = await strapi.entityService.findMany('api::brand.brand', {
        filters: { slug: brandData.slug }
      });
      
      if (existingBrand.length === 0) {
        await strapi.entityService.create('api::brand.brand', {
          data: {
            name: brandData.name,
            slug: brandData.slug,
            isActive: true,
            publishedAt: new Date()
          }
        });
        console.log(`✅ Created brand: ${brandData.name}`);
      } else {
        console.log(`ℹ️ Brand already exists: ${brandData.name}`);
      }
    }
    
    // 3. Check for models with corrupted names
    console.log('\n3. Checking for corrupted model names...');
    
    const allModels = await strapi.entityService.findMany('api::model.model', {
      populate: { brand: true }
    });
    
    const corruptedModels = allModels.filter(model => 
      !model.slug || 
      model.slug.length < 2 || 
      model.slug.includes('_') ||
      model.slug === ',' ||
      /[^a-zA-Z0-9\-]/.test(model.slug)
    );
    
    console.log(`Found ${corruptedModels.length} models with potentially corrupted names`);
    
    if (corruptedModels.length > 0) {
      console.log('Sample corrupted models:');
      corruptedModels.slice(0, 10).forEach((model, index) => {
        console.log(`${index + 1}. ${model.brand?.name || 'NO BRAND'} - "${model.slug}" (${model.name})`);
      });
    }
    
    // 4. Check for models without brand relationships
    console.log('\n4. Checking for models without brand relationships...');
    
    const modelsWithoutBrands = allModels.filter(model => !model.brand);
    console.log(`Found ${modelsWithoutBrands.length} models without brand relationships`);
    
    if (modelsWithoutBrands.length > 0) {
      console.log('Sample models without brands:');
      modelsWithoutBrands.slice(0, 10).forEach((model, index) => {
        console.log(`${index + 1}. "${model.slug}" (${model.name})`);
      });
    }
    
    // 5. Verify the fixes
    console.log('\n5. Verifying fixes...');
    
    const updatedCitroen = await strapi.entityService.findMany('api::brand.brand', {
      filters: { slug: 'citroen' }
    });
    
    if (updatedCitroen.length > 0) {
      console.log(`✅ CITROEN brand now exists with ${updatedCitroen[0].models?.length || 0} models`);
    }
    
    const autobianchi = await strapi.entityService.findMany('api::brand.brand', {
      filters: { slug: 'autobianchi' }
    });
    
    if (autobianchi.length > 0) {
      console.log(`✅ AUTOBIANCHI brand now exists`);
    }
    
    const irmscher = await strapi.entityService.findMany('api::brand.brand', {
      filters: { slug: 'irmscher' }
    });
    
    if (irmscher.length > 0) {
      console.log(`✅ IRMSCHER brand now exists`);
    }
    
    console.log('\n✅ Critical brand issues fix complete!');
    console.log('\nNext steps:');
    console.log('1. Run the import script again to see improved results');
    console.log('2. Consider cleaning up corrupted model names');
    console.log('3. Fix models without brand relationships');
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
})();
