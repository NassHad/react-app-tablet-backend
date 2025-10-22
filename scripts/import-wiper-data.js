const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration
const API_BASE_URL = 'http://localhost:1338';
const CSV_FILE_PATH = path.join(__dirname, 'wipers', 'BDD_PRODUITS_BEG.csv');

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (error) => reject(error));

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Helper function to extract ref from description based on brand
function extractRef(description, brand, gtiCode) {
  // Special cases: extract ref from GTI code for specific Valeo products
  if (brand.toLowerCase() === 'valeo') {
    const gtiCodeStr = gtiCode.toString();
    
    // Handle specific GTI codes that map to VS codes
    if (gtiCodeStr === '906430') return 'VS90';
    if (gtiCodeStr === '906440') return 'VS91';
    if (gtiCodeStr === '906450') return 'VS92';
    
    // For other Valeo products: extract penultimate word (like VS17, VS32)
    const words = description.split(' ');
    if (words.length >= 2) {
      return words[words.length - 2];
    }
  } else if (brand.toLowerCase() === 'imdicar') {
    // For IMDICAR: extract last 2 words (like "14''", "20''", "28''")
    const words = description.split(' ');
    if (words.length >= 2) {
      return `${words[words.length - 2]} ${words[words.length - 1]}`;
    }
  }
  
  // Fallback: return first word or full description
  return description.split(' ')[0];
}

// Helper function to extract size from description (pattern: 3 digits + MM)
function extractSize(description) {
  // Look for pattern: 3 digits followed by MM, but not part of complex patterns like "680+425MM"
  // Exclude patterns that have "+" before the size (complex sizes)
  const sizeMatch = description.match(/(?<!\+)\d{3}MM(?!\d)/);
  return sizeMatch ? sizeMatch[0] : null;
}

// Helper function to parse CSV
function parseCSV(content) {
  const lines = content.split('\n');
  const data = [];
  
  // Skip header lines (first 4 lines are headers/metadata)
  for (let i = 4; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === '') continue;
    
    // Split by semicolon and clean up quotes
    const columns = line.split(';').map(col => col.replace(/"/g, ''));
    
    if (columns.length >= 7) {
      data.push({
        cata: columns[0],
        famille: columns[1],
        sousFamille: columns[2], // This is the category
        marque: columns[3], // This is the brand
        ref: columns[4], // This is the gtiCode
        designation: columns[5], // This is the description
        codeBarres: columns[6] // This is the genCode
      });
    }
  }
  
  return data;
}

// Main import function
async function importWiperData() {
  try {
    console.log('🚀 Starting WiperData import with size extraction...');
    
    // Read CSV file
    console.log('📖 Reading CSV file...');
    const csvContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    const csvData = parseCSV(csvContent);
    
    // Skip the last 3 entries (lines 58-60) as requested - they have complex sizes like "680+425MM"
    const recordsToProcess = csvData.slice(0, -3);
    
    console.log(`📊 Found ${csvData.length} total records, processing ${recordsToProcess.length} (skipping last 3 with complex sizes)`);
    
    let successCount = 0;
    let errorCount = 0;
    let updateCount = 0;
    let createCount = 0;
    
    // Process each record
    for (let i = 0; i < recordsToProcess.length; i++) {
      const record = recordsToProcess[i];
      
      try {
        // Extract ref and size from description
        const extractedRef = extractRef(record.designation, record.marque, record.ref);
        const extractedSize = extractSize(record.designation);
        
        console.log(`\n📝 Processing record ${i + 1}/${recordsToProcess.length}:`);
        console.log(`   Brand: ${record.marque}`);
        console.log(`   Category: ${record.sousFamille}`);
        console.log(`   Description: ${record.designation}`);
        console.log(`   Extracted Ref: ${extractedRef}`);
        console.log(`   Extracted Size: ${extractedSize || 'Not found'}`);
        console.log(`   GTI Code: ${record.ref}`);
        console.log(`   Gen Code: ${record.codeBarres}`);
        
        // Check if record already exists by genCode
        const checkOptions = {
          hostname: 'localhost',
          port: 1338,
          path: `/api/wipers-data?filters[genCode][$eq]=${record.codeBarres}`,
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': '3a107b5963020b0cd02dff627ebe6df6e8549317127ef3d9a7d5d80ed374b1765fd2e9a8bfc40b2b3f747acfe110a7dec9e3f8c953ab78f4060e8e5bdc2ace8584fb3728c8798a2d8aa5e14470f69bb165ab5e59534f3eefc361936a30a71a240f3977afb053167be83b641bae2c8df866f01239c626b3232fad84529621e0de'
          }
        };
        
        const checkResponse = await makeRequest(checkOptions);
        const existingRecords = checkResponse.data?.data || [];
        
        if (existingRecords.length > 0) {
          // Update existing record with size
          const existingRecord = existingRecords[0];
          const updateData = {
            data: {
              size: extractedSize
            }
          };
          
          const updateOptions = {
            hostname: 'localhost',
            port: 1338,
            path: `/api/wipers-data/${existingRecord.documentId}`,
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': '3a107b5963020b0cd02dff627ebe6df6e8549317127ef3d9a7d5d80ed374b1765fd2e9a8bfc40b2b3f747acfe110a7dec9e3f8c953ab78f4060e8e5bdc2ace8584fb3728c8798a2d8aa5e14470f69bb165ab5e59534f3eefc361936a30a71a240f3977afb053167be83b641bae2c8df866f01239c626b3232fad84529621e0de'
            }
          };
          
          const updateResponse = await makeRequest(updateOptions, updateData);
          
          if (updateResponse.status === 200) {
            console.log(`   ✅ Successfully updated existing record with size: ${extractedSize}`);
            updateCount++;
            successCount++;
          } else {
            console.log(`   ❌ Failed to update record: ${updateResponse.status}`);
            console.log(`   Response: ${JSON.stringify(updateResponse.data, null, 2)}`);
            errorCount++;
          }
        } else {
          // Create new record with size
          const wiperData = {
            data: {
              ref: extractedRef,
              brand: record.marque,
              category: record.sousFamille,
              gtiCode: parseInt(record.ref) || 0,
              genCode: parseInt(record.codeBarres) || 0,
              description: record.designation,
              size: extractedSize,
              isActive: true,
              img: null,
              brandImg: null
            }
          };
          
          const createOptions = {
            hostname: 'localhost',
            port: 1338,
            path: '/api/wipers-data',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': '3a107b5963020b0cd02dff627ebe6df6e8549317127ef3d9a7d5d80ed374b1765fd2e9a8bfc40b2b3f747acfe110a7dec9e3f8c953ab78f4060e8e5bdc2ace8584fb3728c8798a2d8aa5e14470f69bb165ab5e59534f3eefc361936a30a71a240f3977afb053167be83b641bae2c8df866f01239c626b3232fad84529621e0de'
            }
          };
          
          const createResponse = await makeRequest(createOptions, wiperData);
          
          if (createResponse.status === 200 || createResponse.status === 201) {
            console.log(`   ✅ Successfully created new WiperData record with size: ${extractedSize}`);
            createCount++;
            successCount++;
          } else {
            console.log(`   ❌ Failed to create record: ${createResponse.status}`);
            console.log(`   Response: ${JSON.stringify(createResponse.data, null, 2)}`);
            errorCount++;
          }
        }
        
        // Add small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`   ❌ Error processing record: ${error.message}`);
        errorCount++;
      }
    }
    
    console.log('\n📊 Import Summary:');
    console.log(`   ✅ Successfully processed: ${successCount}`);
    console.log(`   📝 Records updated: ${updateCount}`);
    console.log(`   🆕 Records created: ${createCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📈 Total processed: ${recordsToProcess.length}`);
    console.log(`   ⏭️  Skipped (complex sizes): 3`);
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
  }
}

// Run the import
if (require.main === module) {
  importWiperData();
}

module.exports = { importWiperData, parseCSV, extractRef, extractSize };
