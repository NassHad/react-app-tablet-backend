// Debug script to identify the exact issue with battery-product entity
// Run this in Strapi console: npx strapi console

async function debugBatteryProductEntity() {
  try {
    console.log('🔍 Debugging battery-product entity...');
    
    // Test 1: Check if entity exists in content types
    console.log('\nTest 1: Checking content types...');
    const contentType = strapi.contentTypes['api::battery-product.battery-product'];
    console.log('Content type exists:', !!contentType);
    
    if (contentType) {
      console.log('Content type details:', {
        kind: contentType.kind,
        collectionName: contentType.collectionName,
        displayName: contentType.info?.displayName,
        attributes: Object.keys(contentType.attributes || {})
      });
    }
    
    // Test 2: Check if entity service exists
    console.log('\nTest 2: Checking entity service...');
    console.log('Entity service exists:', !!strapi.entityService);
    console.log('Entity service methods:', Object.keys(strapi.entityService || {}));
    
    // Test 3: Try to access the entity service directly
    console.log('\nTest 3: Testing entity service access...');
    try {
      const service = strapi.entityService;
      console.log('Service object:', !!service);
      console.log('Service.findMany method:', !!service?.findMany);
      
      if (service?.findMany) {
        console.log('Attempting to call findMany...');
        const result = await service.findMany('api::battery-product.battery-product', {
          filters: {}
        });
        console.log('✅ findMany succeeded, found:', result.length, 'items');
      }
    } catch (error) {
      console.error('❌ Entity service error:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    // Test 4: Check database connection
    console.log('\nTest 4: Checking database...');
    try {
      const db = strapi.db;
      console.log('Database exists:', !!db);
      console.log('Database connection:', !!db?.connection);
      
      if (db?.connection) {
        console.log('Database type:', db.connection.options?.type);
        console.log('Database name:', db.connection.options?.database);
      }
    } catch (error) {
      console.error('❌ Database error:', error.message);
    }
    
    // Test 5: Check if table exists
    console.log('\nTest 5: Checking if table exists...');
    try {
      const db = strapi.db;
      if (db?.connection) {
        const tableName = 'battery_products';
        const tableExists = await db.connection.schema.hasTable(tableName);
        console.log(`Table '${tableName}' exists:`, tableExists);
        
        if (tableExists) {
          const tableInfo = await db.connection.schema.getTableInfo(tableName);
          console.log('Table info:', tableInfo);
        }
      }
    } catch (error) {
      console.error('❌ Table check error:', error.message);
    }
    
    console.log('\n🎯 Debug completed!');
    
  } catch (error) {
    console.error('💥 Fatal debug error:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Export the function for console use
module.exports = { debugBatteryProductEntity };
