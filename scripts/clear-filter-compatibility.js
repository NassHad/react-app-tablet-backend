const fs = require('fs');
const path = require('path');

/**
 * Clear all FilterCompatibility records from Strapi
 * This script will delete all existing filter compatibility records
 */

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

// Helper function to make API calls to Strapi
async function strapiRequest(endpoint, method = 'GET', data = null) {
  const url = `${STRAPI_URL}/api${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(API_TOKEN && { 'Authorization': `Bearer ${API_TOKEN}` })
    }
  };

  if (data) {
    options.body = JSON.stringify({ data });
  }

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

// Get all filter compatibility records with pagination
async function getAllFilterCompatibilities() {
  console.log('📥 Fetching all filter compatibility records...');
  
  try {
    let allRecords = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      console.log(`📄 Fetching page ${page}...`);
      const response = await strapiRequest(`/filter-compatibilities?pagination[page]=${page}&pagination[pageSize]=100`);
      const records = response.data;
      const pagination = response.meta?.pagination;
      
      if (records && records.length > 0) {
        allRecords = allRecords.concat(records);
        console.log(`   ✅ Found ${records.length} records on page ${page}`);
        
        // Check if there are more pages
        if (pagination && page < pagination.pageCount) {
          page++;
        } else {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }
    
    console.log(`✅ Total found: ${allRecords.length} filter compatibility records`);
    return allRecords;
  } catch (error) {
    console.error('❌ Failed to fetch filter compatibility records:', error.message);
    throw error;
  }
}

// Delete all filter compatibility records
async function clearAllFilterCompatibilities() {
  console.log('🗑️  Starting to clear all filter compatibility records...');
  
  try {
    // Get all records first
    const records = await getAllFilterCompatibilities();
    
    if (records.length === 0) {
      console.log('✅ No filter compatibility records to delete');
      return { deleted: 0, errors: [] };
    }
    
    console.log(`📊 Found ${records.length} records to delete`);
    console.log(`📈 ID range: ${Math.min(...records.map(r => r.id))} to ${Math.max(...records.map(r => r.id))}`);
    
    const deleted = [];
    const errors = [];
    
    // Delete records one by one with proper error handling
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        console.log(`🗑️  Deleting record ${i + 1}/${records.length} (ID: ${record.id}, documentId: ${record.documentId})...`);
        
        // Use documentId for deletion (Strapi v5+ uses documentId for delete operations)
        const deleteResponse = await fetch(`${STRAPI_URL}/api/filter-compatibilities/${record.documentId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(API_TOKEN && { 'Authorization': `Bearer ${API_TOKEN}` })
          }
        });
        
        if (deleteResponse.ok) {
          deleted.push(record.id);
          console.log(`   ✅ Deleted record ${record.id}`);
        } else {
          const errorText = await deleteResponse.text();
          console.error(`   ❌ Failed to delete record ${record.id}: HTTP ${deleteResponse.status} - ${errorText}`);
          errors.push({ id: record.id, error: `HTTP ${deleteResponse.status}: ${errorText}` });
        }
        
        // Small delay between deletions
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error) {
        console.error(`❌ Failed to delete record ${record.id}:`, error.message);
        errors.push({ id: record.id, error: error.message });
      }
    }
    
    console.log(`\n📊 Deletion Summary:`);
    console.log(`   ✅ Successfully deleted: ${deleted.length}`);
    console.log(`   ❌ Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Deletion errors:');
      errors.slice(0, 10).forEach(error => {
        console.log(`   - Record ${error.id}: ${error.error}`);
      });
      if (errors.length > 10) {
        console.log(`   ... and ${errors.length - 10} more errors`);
      }
    }
    
    return { deleted: deleted.length, errors: errors.length };
  } catch (error) {
    console.error('❌ Failed to clear filter compatibility records:', error.message);
    throw error;
  }
}

// Verify that all records are deleted
async function verifyDeletion() {
  console.log('🔍 Verifying deletion...');
  
  try {
    const records = await getAllFilterCompatibilities();
    
    if (records.length === 0) {
      console.log('✅ Verification successful: No filter compatibility records found');
      return true;
    } else {
      console.log(`⚠️  Warning: ${records.length} filter compatibility records still exist`);
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to verify deletion:', error.message);
    return false;
  }
}

// Main clear function
async function runClearFilterCompatibility() {
  console.log('🎯 Starting FilterCompatibility Table Cleanup');
  console.log('=' .repeat(60));
  
  try {
    // Confirm with user
    console.log('⚠️  WARNING: This will delete ALL filter compatibility records!');
    console.log('   This action cannot be undone.');
    console.log('   Make sure you have a backup if needed.');
    console.log('');
    
    // Clear all records
    const results = await clearAllFilterCompatibilities();
    
    // Verify deletion
    const verified = await verifyDeletion();
    
    console.log('\n🎉 FilterCompatibility Cleanup Complete!');
    console.log('=' .repeat(60));
    console.log(`✅ Records deleted: ${results.deleted}`);
    console.log(`❌ Errors: ${results.errors}`);
    console.log(`🔍 Verification: ${verified ? 'PASSED' : 'FAILED'}`);
    
    if (verified) {
      console.log('\n🚀 FilterCompatibility table is now clean and ready for fresh import!');
    } else {
      console.log('\n⚠️  Some records may still exist. Please check manually.');
    }
    
  } catch (error) {
    console.error('\n💥 Cleanup failed:', error.message);
    process.exit(1);
  }
}

// Run the clear if this script is executed directly
if (require.main === module) {
  runClearFilterCompatibility()
    .then(() => {
      console.log('\n🎉 FilterCompatibility clear script finished!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 FilterCompatibility clear script failed:', error);
      process.exit(1);
    });
}

module.exports = { 
  runClearFilterCompatibility, 
  clearAllFilterCompatibilities, 
  getAllFilterCompatibilities,
  verifyDeletion 
};
