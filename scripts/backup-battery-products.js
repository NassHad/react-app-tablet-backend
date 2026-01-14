// Backup complete Strapi database
// Usage: node scripts/backup-battery-products.js
// 
// Environment variables:
//   STRAPI_URL - Strapi server URL (default: http://localhost:1338)
//   STRAPI_API_TOKEN - API token for authentication (optional)

const fs = require("fs");
const path = require("path");
const http = require("http");

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

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
    
    if (API_TOKEN) {
      options.headers['Authorization'] = `Bearer ${API_TOKEN}`;
    }
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsedData = JSON.parse(responseData);
            resolve(parsedData);
          } catch (e) {
            resolve({ data: responseData, raw: true });
          }
        } else {
          let parsedData;
          let errorMsg;
          try {
            parsedData = JSON.parse(responseData);
            errorMsg = `HTTP ${res.statusCode}: ${parsedData.message || parsedData.error?.message || responseData}`;
          } catch (e) {
            errorMsg = `HTTP ${res.statusCode}: ${responseData}`;
            parsedData = { message: responseData };
          }
          const fullError = new Error(errorMsg);
          fullError.statusCode = res.statusCode;
          fullError.endpoint = endpoint;
          fullError.method = method;
          fullError.responseData = responseData;
          reject(fullError);
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

async function fetchAllPaginated(endpoint, pageSize = 100) {
  let allItems = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      console.log(`📄 Fetching ${endpoint} page ${page}...`);
      const response = await makeRequest(`${endpoint}?pagination[page]=${page}&pagination[pageSize]=${pageSize}`);

      if (response.data && response.data.length > 0) {
        allItems = allItems.concat(response.data);
        if (response.meta && response.meta.pagination) {
          const { page: currentPage, pageCount } = response.meta.pagination;
          console.log(`   📄 Page ${currentPage}/${pageCount}: Found ${response.data.length} items`);
          if (currentPage >= pageCount) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    } catch (err) {
      console.error(`❌ Error fetching ${endpoint} page ${page}: ${err.message}`);
      hasMore = false;
    }
  }
  return allItems;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// List of all content types to backup
const CONTENT_TYPES = [
  'categories',
  'products',
  'vehicle-types',
  'brands',
  'models',
  'battery-brands',
  'battery-models',
  'battery-products',
  'battery-data',
  'lights-products',
  'lights-positions',
  'light-position-data',
  'light-data',
  'compatibilities',
  'specific-questions',
  'motorisations',
  'filter-products',
  'filter-compatibilities',
  'wipers-products',
  'wipers-positions',
  'wiper-data',
  'tablets',
  'sync'
];

async function backupStrapiDatabase() {
  console.log('💾 Starting complete backup of Strapi database...');
  console.log(`🔗 Strapi URL: ${STRAPI_URL}`);
  
  // Create backup directory if it doesn't exist
  const backupDir = path.join(process.cwd(), 'scripts', 'backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`📁 Created backup directory: ${backupDir}`);
  }
  
  // Generate timestamp for backup files
  const now = new Date();
  const timestamp = now.toISOString().replace(/:/g, '-').split('.')[0]; // Format: YYYY-MM-DD-HH-MM-SS
  
  const backupData = {
    timestamp: timestamp,
    strapiUrl: STRAPI_URL,
    contentTypes: {}
  };
  
  const summary = {
    totalRecords: 0,
    contentTypes: {},
    errors: []
  };
  
  try {
    console.log(`\n📥 Fetching data from ${CONTENT_TYPES.length} content types...\n`);
    
    // Fetch all content types
    for (const contentType of CONTENT_TYPES) {
      try {
        console.log(`📦 Fetching ${contentType}...`);
        const items = await fetchAllPaginated(`/${contentType}`);
        
        backupData.contentTypes[contentType] = items;
        summary.contentTypes[contentType] = items.length;
        summary.totalRecords += items.length;
        
        console.log(`   ✅ Fetched ${items.length} ${contentType}\n`);
      } catch (err) {
        const errorMsg = `Failed to fetch ${contentType}: ${err.message}`;
        console.error(`   ❌ ${errorMsg}\n`);
        summary.errors.push(errorMsg);
        // Continue with other content types even if one fails
        backupData.contentTypes[contentType] = [];
        summary.contentTypes[contentType] = 0;
      }
    }
    
    // Save JSON backup
    const jsonBackupPath = path.join(backupDir, `strapi-backup-${timestamp}.json`);
    fs.writeFileSync(jsonBackupPath, JSON.stringify(backupData, null, 2), 'utf8');
    const jsonStats = fs.statSync(jsonBackupPath);
    console.log(`\n💾 JSON backup saved:`);
    console.log(`   📄 File: ${jsonBackupPath}`);
    console.log(`   📊 Size: ${formatBytes(jsonStats.size)}`);
    
    // Try to backup SQLite database if it exists
    const sqlitePath = path.join(process.cwd(), '.tmp', 'data.db');
    const sqliteBackupPath = path.join(backupDir, `data-backup-${timestamp}.db`);
    
    if (fs.existsSync(sqlitePath)) {
      try {
        fs.copyFileSync(sqlitePath, sqliteBackupPath);
        const dbStats = fs.statSync(sqliteBackupPath);
        console.log(`\n💾 SQLite database backup saved:`);
        console.log(`   📄 File: ${sqliteBackupPath}`);
        console.log(`   📊 Size: ${formatBytes(dbStats.size)}`);
      } catch (err) {
        console.error(`\n⚠️  Could not backup SQLite database: ${err.message}`);
        summary.errors.push(`SQLite backup failed: ${err.message}`);
      }
    } else {
      console.log(`\nℹ️  SQLite database not found at ${sqlitePath} (may be using a different database)`);
    }
    
    // Summary
    console.log(`\n✅ Backup completed successfully!`);
    console.log(`\n📋 Summary:`);
    console.log(`   📦 Total records backed up: ${summary.totalRecords}`);
    console.log(`   📄 JSON backup: ${jsonBackupPath}`);
    if (fs.existsSync(sqliteBackupPath)) {
      console.log(`   💾 SQLite backup: ${sqliteBackupPath}`);
    }
    
    console.log(`\n📊 Content types breakdown:`);
    for (const [contentType, count] of Object.entries(summary.contentTypes)) {
      console.log(`   • ${contentType}: ${count} records`);
    }
    
    if (summary.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered:`);
      summary.errors.forEach(err => console.log(`   • ${err}`));
    }
    
    console.log(`\n💡 You can now safely proceed with modifications.`);
    
  } catch (error) {
    console.error(`\n❌ Error during backup: ${error.message}`);
    if (error.statusCode) {
      console.error(`   HTTP Status: ${error.statusCode}`);
      console.error(`   Endpoint: ${error.endpoint}`);
    }
    process.exit(1);
  }
}

// Run backup
backupStrapiDatabase();

