// Delete all models and reset ID counter
const http = require("http");

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';

function makeRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${STRAPI_URL}/api${endpoint}`);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsedData);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${parsedData.message || responseData}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function deleteAllModelsAndResetIds() {
  try {
    console.log('🗑️  Deleting all models and resetting ID counter...');
    
    // Step 1: Get all existing models
    console.log('📊 Fetching all existing models...');
    let allModels = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;
    
    while (hasMore) {
      try {
        const response = await makeRequest(`/models?pagination[page]=${page}&pagination[pageSize]=${pageSize}`);
        
        if (response.data && response.data.length > 0) {
          allModels = allModels.concat(response.data);
          console.log(`📊 Fetched page ${page}: ${response.data.length} models (total: ${allModels.length})`);
          
          if (response.meta && response.meta.pagination) {
            const { page: currentPage, pageCount } = response.meta.pagination;
            if (currentPage >= pageCount) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
          
          page++;
        } else {
          hasMore = false;
        }
      } catch (err) {
        console.log(`⚠️  Error fetching page ${page}: ${err.message}`);
        hasMore = false;
      }
    }
    
    console.log(`📊 Found ${allModels.length} models to delete`);
    
    if (allModels.length === 0) {
      console.log('✅ No models found to delete');
      return;
    }
    
    // Step 2: Delete all models in batches
    console.log('🗑️  Deleting all models...');
    let deleted = 0;
    let deleteErrors = 0;
    
    // Process in batches of 50
    for (let i = 0; i < allModels.length; i += 50) {
      const batch = allModels.slice(i, i + 50);
      
      // Delete batch in parallel
      const deletePromises = batch.map(async (model) => {
        try {
          await makeRequest(`/models/${model.id}`, 'DELETE');
          return { success: true, model };
        } catch (err) {
          return { success: false, model, error: err.message };
        }
      });
      
      const results = await Promise.all(deletePromises);
      
      for (const result of results) {
        if (result.success) {
          deleted++;
        } else {
          console.log(`⚠️  Could not delete model ${result.model.name}: ${result.error}`);
          deleteErrors++;
        }
      }
      
      console.log(`📊 Deleted batch ${Math.floor(i/50) + 1}: ${deleted} deleted, ${deleteErrors} errors`);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ Deletion complete: ${deleted} deleted, ${deleteErrors} errors`);
    
    // Step 3: Wait for database to process deletions
    console.log('⏳ Waiting for database to process deletions...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 4: Verify deletion
    console.log('🔍 Verifying deletion...');
    try {
      const verifyResponse = await makeRequest('/models?pagination[limit]=1');
      if (verifyResponse.data && verifyResponse.data.length > 0) {
        console.log(`⚠️  Still ${verifyResponse.data.length} models remaining`);
      } else {
        console.log('✅ All models successfully deleted');
      }
    } catch (err) {
      console.log(`⚠️  Error verifying deletion: ${err.message}`);
    }
    
    // Step 5: Reset ID counter (if using SQLite/PostgreSQL)
    console.log('🔄 Attempting to reset ID counter...');
    try {
      // This is a database-specific operation
      // For SQLite, we can try to reset the auto-increment counter
      // For PostgreSQL, we can reset the sequence
      
      // Note: This might not work depending on your database setup
      // You may need to do this manually in your database
      console.log('⚠️  ID counter reset requires manual database operation');
      console.log('📝 For SQLite: DELETE FROM sqlite_sequence WHERE name="models";');
      console.log('📝 For PostgreSQL: ALTER SEQUENCE models_id_seq RESTART WITH 1;');
      console.log('📝 For MySQL: ALTER TABLE models AUTO_INCREMENT = 1;');
      
    } catch (err) {
      console.log(`⚠️  Could not reset ID counter: ${err.message}`);
    }
    
    console.log('\n🎉 Model deletion completed!');
    console.log(`📊 Summary: ${deleted} models deleted, ${deleteErrors} errors`);
    
    // Step 6: Check final state
    const finalResponse = await makeRequest('/models?pagination[limit]=1');
    if (finalResponse.data && finalResponse.data.length > 0) {
      console.log(`⚠️  ${finalResponse.data.length} models still remain`);
    } else {
      console.log('✅ Database is now empty of models');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

deleteAllModelsAndResetIds();
