const fs = require('fs');
const path = require('path');

// Use native fetch (Node 18+) or http/https for compatibility
const http = require('http');
const https = require('https');
const { URL } = require('url');

// Simple fetch implementation using http/https
async function simpleFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = protocol.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const responseObj = {
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          _data: data,
          json: async () => {
            try {
              return JSON.parse(data);
            } catch (e) {
              throw new Error(`Failed to parse JSON: ${e.message}. Response: ${data.substring(0, 200)}`);
            }
          },
          text: async () => data
        };
        
        resolve(responseObj);
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

// Configuration
const CSV_FILE_PATH = path.join(__dirname, 'liste_affectation', 'Liste affectations BEG PLATS IMDICAR_200825.csv');
const BATCH_SIZE = 50;
const DELAY_BETWEEN_BATCHES = 1000;
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

// Helper function to create slug
function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

// Helper function to delay execution
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to deduplicate wiper positions
// Keeps the first occurrence based on ref+position+brand (or position+brand+size+description if no ref)
function deduplicatePositions(positions) {
  const seen = new Set();
  return positions.filter(pos => {
    const ref = (pos.ref || '').toString().trim().toLowerCase();
    const position = (pos.position || '').toString().trim().toLowerCase();
    const brand = (pos.brand || '').toString().trim().toLowerCase();

    let key;
    if (ref) {
      key = `${ref}|${position}|${brand}`;
    } else {
      const size = (pos.size || '').toString().trim().toLowerCase();
      const description = (pos.description || '').toString().trim().toLowerCase();
      key = `${position}|${brand}|${size}|${description}`;
    }

    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

// Helper function to make API calls to Strapi
async function strapiRequest(endpoint, method = 'GET', data = null) {
  const url = `${STRAPI_URL}/api${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Node-Import-Script',
      ...(API_TOKEN && { 'Authorization': `Bearer ${API_TOKEN}` })
    }
  };

  if (data) {
    options.body = JSON.stringify({ data });
  }

  try {
    const response = await simpleFetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      console.error(`   URL: ${url}`);
      console.error(`   Response: ${errorText.substring(0, 500)}`);
      throw new Error(`${errorMsg} - ${errorText.substring(0, 200)}`);
    }
    
    const responseData = await response.json();
    return responseData;
  } catch (error) {
    console.error(`❌ API Error for ${endpoint}:`, error.message);
    throw error;
  }
}

// Parse size from formats like "24''(600mm)" or "13"(340mm)" or "600mm"
function parseSize(sizeStr) {
  if (!sizeStr || !sizeStr.trim()) return null;
  
  const cleaned = sizeStr.trim();
  
  // Pattern 1: "24''(600mm)" or "13"(340mm)" - extract both inch and mm with parentheses
  // Handles both single quotes '' and double quotes "
  const pattern1 = cleaned.match(/(\d+)\s*['"]*\s*\((\d+)\s*mm\)/i);
  if (pattern1) {
    const inch = pattern1[1];
    const mm = pattern1[2];
    return {
      mm: `${mm}mm`,
      inch: `${inch}''`,
      description: `BEG PLAT ${mm}MM ${inch}''`
    };
  }
  
  // Pattern 2: "24''(600mm)" without parentheses but with quotes - extract both
  const pattern2 = cleaned.match(/(\d+)\s*['"]+\s*(\d+)\s*mm/i);
  if (pattern2) {
    const inch = pattern2[1];
    const mm = pattern2[2];
    return {
      mm: `${mm}mm`,
      inch: `${inch}''`,
      description: `BEG PLAT ${mm}MM ${inch}''`
    };
  }
  
  // Pattern 3: Just mm value like "(600mm)" or "600mm"
  const mmMatch = cleaned.match(/(\d+)\s*mm/i);
  if (mmMatch) {
    const mm = mmMatch[1];
    return {
      mm: `${mm}mm`,
      inch: null,
      description: `BEG PLAT ${mm}MM`
    };
  }
  
  return null;
}

// Extract brand names from variations like "ABARTH (FIAT)"
function extractBrandNames(brandStr) {
  if (!brandStr) return [];
  
  const cleaned = brandStr.trim();
  const names = [];
  
  // Try exact match first
  names.push(cleaned);
  
  // Extract primary brand (before parentheses)
  const primaryMatch = cleaned.match(/^([^(]+)/);
  if (primaryMatch) {
    const primary = primaryMatch[1].trim();
    if (primary !== cleaned) {
      names.push(primary);
    }
  }
  
  // Extract secondary brand (in parentheses)
  const parenMatch = cleaned.match(/\(([^)]+)\)/);
  if (parenMatch) {
    names.push(parenMatch[1].trim());
  }
  
  return [...new Set(names)]; // Remove duplicates
}

// Parse CSV line (semicolon-delimited)
function parseCSVLine(line) {
  const parts = line.split(';');
  if (parts.length < 7) return null;
  
  // Helper to clean quoted strings
  const clean = (str) => {
    if (!str) return '';
    str = str.trim();
    // Remove surrounding quotes and unescape double quotes
    if (str.startsWith('"') && str.endsWith('"')) {
      str = str.slice(1, -1).replace(/""/g, '"');
    }
    return str.trim();
  };
  
  return {
    marque: clean(parts[0]) || '',
    modele: clean(parts[1]) || '',
    version: clean(parts[2]) || '',
    annee: clean(parts[3]) || '',
    conducteur: clean(parts[4]) || '',
    passager: clean(parts[5]) || '',
    arriere: clean(parts[6]) || ''
  };
}

async function importImdicarWipersPositions() {
  try {
    console.log('🚀 Starting IMDICAR wipers positions import...');
    
    // Check if CSV file exists
    if (!fs.existsSync(CSV_FILE_PATH)) {
      throw new Error(`CSV file not found at: ${CSV_FILE_PATH}`);
    }
    
    // Read CSV file
    console.log('📖 Reading CSV file...');
    const csvContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 3) {
      throw new Error('CSV file appears to be empty or invalid');
    }
    
    // Skip header lines (first 2 lines)
    const dataLines = lines.slice(2);
    console.log(`📊 Found ${dataLines.length} data rows in CSV`);
    
    // Load existing brands and models
    console.log('🔍 Fetching existing brands and models...');
    
    // Load brands with pagination
    const existingBrands = [];
    let brandPage = 1;
    const brandPageSize = 100;
    let hasMoreBrands = true;
    
    while (hasMoreBrands) {
      const brandResponse = await strapiRequest(`/brands?pagination[page]=${brandPage}&pagination[pageSize]=${brandPageSize}`);
      const brands = brandResponse.data || [];
      
      if (brands.length === 0) {
        hasMoreBrands = false;
      } else {
        existingBrands.push(...brands);
        if (brands.length < brandPageSize) {
          hasMoreBrands = false;
        } else {
          brandPage++;
        }
      }
    }
    
    // Load models with pagination
    const existingModels = [];
    let modelPage = 1;
    const modelPageSize = 100;
    let hasMoreModels = true;
    
    while (hasMoreModels) {
      const modelResponse = await strapiRequest(`/models?pagination[page]=${modelPage}&pagination[pageSize]=${modelPageSize}&populate=brand`);
      const models = modelResponse.data || [];
      
      if (models.length === 0) {
        hasMoreModels = false;
      } else {
        existingModels.push(...models);
        if (models.length < modelPageSize) {
          hasMoreModels = false;
        } else {
          modelPage++;
        }
      }
    }
    
    // Create lookup maps
    const brandMap = new Map();
    const brandSlugMap = new Map();
    
    existingBrands.forEach(brand => {
      const name = brand.attributes?.name || brand.name;
      const slug = brand.attributes?.slug || brand.slug;
      const id = brand.id;
      const brandObj = { id, name, slug };
      
      const nameUpper = name.toUpperCase();
      brandMap.set(nameUpper, brandObj);
      brandSlugMap.set(slug, brandObj);
      // Also map by slugified name
      brandSlugMap.set(slugify(name), brandObj);
    });
    
    const modelMap = new Map();
    existingModels.forEach(model => {
      const modelName = model.attributes?.name || model.name;
      const modelId = model.id;
      const brandData = model.attributes?.brand?.data || model.brand?.data || model.brand;
      const brandName = brandData?.attributes?.name || brandData?.name;
      const brandId = brandData?.id || brandData;
      
      if (brandName) {
        const brandNameUpper = brandName.toUpperCase();
        const modelNameUpper = modelName.toUpperCase();
        const key = `${brandNameUpper}-${modelNameUpper}`;
        modelMap.set(key, { id: modelId, name: modelName, brand: { id: brandId, name: brandName } });
      }
    });
    
    console.log(`📋 Loaded ${existingBrands.length} brands and ${existingModels.length} models`);
    
    // Statistics
    let totalProcessed = 0;
    let totalMatched = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    // Logging arrays
    const missingBrands = [];
    const missingModels = [];
    const failedPositions = [];
    
    // Process CSV rows
    console.log('\n📦 Processing CSV rows...');
    
    for (let i = 0; i < dataLines.length; i += BATCH_SIZE) {
      const batch = dataLines.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(dataLines.length / BATCH_SIZE);
      
      console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} rows)`);
      
      for (let j = 0; j < batch.length; j++) {
        const csvRow = i + j + 3; // +3 because we start from row 3 (after 2 headers)
        const line = batch[j];
        
        try {
          const row = parseCSVLine(line);
          if (!row || !row.marque || !row.modele) {
            totalSkipped++;
            continue;
          }
          
          totalProcessed++;
          
          // Try to find brand
          const brandNames = extractBrandNames(row.marque);
          let matchedBrand = null;
          
          for (const brandName of brandNames) {
            const brandNameUpper = brandName.toUpperCase();
            matchedBrand = brandMap.get(brandNameUpper);
            
            if (!matchedBrand) {
              // Try by slug
              const brandSlug = slugify(brandName);
              matchedBrand = brandSlugMap.get(brandSlug);
            }
            
            if (matchedBrand) break;
          }
          
          if (!matchedBrand) {
            missingBrands.push({
              brand: row.marque,
              model: row.modele,
              csvRow: csvRow,
              reason: 'Brand not found'
            });
            totalSkipped++;
            continue;
          }
          
          // Try to find model
          const modelNameUpper = row.modele.toUpperCase();
          const brandNameUpper = matchedBrand.name.toUpperCase();
          const modelKey = `${brandNameUpper}-${modelNameUpper}`;
          let matchedModel = modelMap.get(modelKey);
          
          if (!matchedModel) {
            // Try to find model by slug within the brand - fetch models for this brand
            const modelSlug = slugify(row.modele);
            let modelsForBrand = [];
            
            // Fetch models for this brand via API
            let modelPage = 1;
            let hasMore = true;
            while (hasMore) {
              const response = await strapiRequest(`/models?filters[brand][id][$eq]=${matchedBrand.id}&pagination[page]=${modelPage}&pagination[pageSize]=100&populate=brand`);
              const models = response.data || [];
              
              modelsForBrand.push(...models);
              
              if (models.length === 0 || models.length < 100) {
                hasMore = false;
              } else {
                modelPage++;
              }
            }
            
            // Try to match by slug
            for (const m of modelsForBrand) {
              const mName = m.attributes?.name || m.name;
              const mSlug = m.attributes?.slug || m.slug;
              const mId = m.id;
              
              if (mSlug === modelSlug || slugify(mName) === modelSlug) {
                matchedModel = { id: mId, name: mName, brand: { id: matchedBrand.id, name: matchedBrand.name } };
                break;
              }
            }
          }
          
          if (!matchedModel) {
            missingModels.push({
              brand: row.marque,
              model: row.modele,
              csvRow: csvRow,
              reason: 'Model not found'
            });
            totalSkipped++;
            continue;
          }
          
          // Find existing wipersProduct
          let wipersProducts = [];
          let productPage = 1;
          let hasMoreProducts = true;
          
          while (hasMoreProducts) {
            const response = await strapiRequest(`/wipers-products?filters[brand][id][$eq]=${matchedBrand.id}&filters[model][id][$eq]=${matchedModel.id}&pagination[page]=${productPage}&pagination[pageSize]=100`);
            const products = response.data || [];
            
            wipersProducts.push(...products);
            
            if (products.length === 0 || products.length < 100) {
              hasMoreProducts = false;
            } else {
              productPage++;
            }
          }
          
          if (wipersProducts.length === 0) {
            // Log all positions that couldn't be added
            if (row.conducteur) {
              const sizeData = parseSize(row.conducteur);
              if (sizeData) {
                failedPositions.push({
                  brand: row.marque,
                  model: row.modele,
                  position: 'Driver',
                  size: sizeData.mm,
                  csvRow: csvRow,
                  reason: 'No wipersProduct found'
                });
              }
            }
            if (row.passager) {
              const sizeData = parseSize(row.passager);
              if (sizeData) {
                failedPositions.push({
                  brand: row.marque,
                  model: row.modele,
                  position: 'Passenger',
                  size: sizeData.mm,
                  csvRow: csvRow,
                  reason: 'No wipersProduct found'
                });
              }
            }
            if (row.arriere) {
              const sizeData = parseSize(row.arriere);
              if (sizeData) {
                failedPositions.push({
                  brand: row.marque,
                  model: row.modele,
                  position: 'Back',
                  size: sizeData.mm,
                  csvRow: csvRow,
                  reason: 'No wipersProduct found'
                });
              }
            }
            totalSkipped++;
            continue;
          }
          
          // Process positions for each wipersProduct found
          const newPositions = [];
          
          // Driver position
          if (row.conducteur) {
            const sizeData = parseSize(row.conducteur);
            if (sizeData) {
              newPositions.push({
                position: 'Driver',
                size: sizeData.mm,
                description: sizeData.description,
                brand: 'Imdicar'
              });
            }
          }
          
          // Passenger position
          if (row.passager) {
            const sizeData = parseSize(row.passager);
            if (sizeData) {
              newPositions.push({
                position: 'Passenger',
                size: sizeData.mm,
                description: sizeData.description,
                brand: 'Imdicar'
              });
            }
          }
          
          // Back position
          if (row.arriere) {
            const sizeData = parseSize(row.arriere);
            if (sizeData) {
              newPositions.push({
                position: 'Back',
                size: sizeData.mm,
                description: sizeData.description,
                brand: 'Imdicar'
              });
            }
          }
          
          if (newPositions.length === 0) {
            totalSkipped++;
            continue;
          }
          
          // Update each wipersProduct
          let updatedCount = 0;
          for (const product of wipersProducts) {
            try {
              // Strapi v5 uses documentId, not id
              const productId = product.documentId || product.id;
              const currentPositions = product.attributes?.wipersPositions || product.wipersPositions || [];
              const mergedPositions = [...currentPositions, ...newPositions];
              const updatedPositions = deduplicatePositions(mergedPositions);

              const duplicatesRemoved = mergedPositions.length - updatedPositions.length;
              if (duplicatesRemoved > 0) {
                console.log(`   Removed ${duplicatesRemoved} duplicate position(s) for product ${productId}`);
              }
              
              // strapiRequest already wraps data in { data: ... }, so pass the fields directly
              await strapiRequest(`/wipers-products/${productId}`, 'PUT', {
                wipersPositions: updatedPositions
              });
              
              updatedCount++;
              totalUpdated++;
              totalMatched++;
            } catch (updateError) {
              const productId = product.documentId || product.id;
              console.error(`❌ Error updating wipersProduct ${productId}:`, updateError.message);
              totalErrors++;
            }
          }
          
          if (updatedCount > 0) {
            console.log(`✅ Updated ${updatedCount} wipersProduct(s) for ${matchedBrand.name} ${matchedModel.name} (${newPositions.length} positions)`);
          }
          
        } catch (rowError) {
          console.error(`❌ Error processing row ${csvRow}:`, rowError.message);
          totalErrors++;
        }
      }
      
      // Delay between batches
      if (i + BATCH_SIZE < dataLines.length) {
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }
    
    // Generate summary report
    console.log('\n' + '='.repeat(80));
    console.log('🎉 Import completed!');
    console.log('='.repeat(80));
    console.log('\n📊 Summary:');
    console.log(`   - Total processed: ${totalProcessed}`);
    console.log(`   - Matched & updated: ${totalMatched}`);
    console.log(`   - Products updated: ${totalUpdated}`);
    console.log(`   - Skipped: ${totalSkipped}`);
    console.log(`   - Errors: ${totalErrors}`);
    console.log(`\n📋 Missing brands: ${missingBrands.length}`);
    console.log(`📋 Missing models: ${missingModels.length}`);
    console.log(`📋 Failed positions: ${failedPositions.length}`);
    
    // Log missing brands
    if (missingBrands.length > 0) {
      console.log('\n⚠️  Missing Brands:');
      const uniqueBrands = [...new Set(missingBrands.map(b => b.brand))];
      uniqueBrands.slice(0, 20).forEach(brand => {
        console.log(`   - ${brand}`);
      });
      if (uniqueBrands.length > 20) {
        console.log(`   ... and ${uniqueBrands.length - 20} more`);
      }
    }
    
    // Log missing models
    if (missingModels.length > 0) {
      console.log('\n⚠️  Missing Models (first 20):');
      missingModels.slice(0, 20).forEach(item => {
        console.log(`   - ${item.brand} / ${item.model} (row ${item.csvRow})`);
      });
      if (missingModels.length > 20) {
        console.log(`   ... and ${missingModels.length - 20} more`);
      }
    }
    
    // Log failed positions
    if (failedPositions.length > 0) {
      console.log('\n⚠️  Failed Positions (first 20):');
      failedPositions.slice(0, 20).forEach(item => {
        console.log(`   - ${item.brand} / ${item.model} / ${item.position} / ${item.size} (row ${item.csvRow})`);
      });
      if (failedPositions.length > 20) {
        console.log(`   ... and ${failedPositions.length - 20} more`);
      }
    }
    
    // Save detailed logs to JSON file
    const logData = {
      summary: {
        totalProcessed,
        totalMatched,
        totalUpdated,
        totalSkipped,
        totalErrors,
        missingBrandsCount: missingBrands.length,
        missingModelsCount: missingModels.length,
        failedPositionsCount: failedPositions.length
      },
      missingBrands,
      missingModels,
      failedPositions
    };
    
    const logFilePath = path.join(__dirname, 'import-imdicar-log.json');
    fs.writeFileSync(logFilePath, JSON.stringify(logData, null, 2));
    console.log(`\n📄 Detailed logs saved to: ${logFilePath}`);
    
  } catch (error) {
    console.error('💥 Import failed:', error);
    throw error;
  }
}

// Run the import if this script is executed directly
if (require.main === module) {
  importImdicarWipersPositions()
    .then(() => {
      console.log('\n✅ Import completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Import failed:', error);
      process.exit(1);
    });
}

module.exports = { importImdicarWipersPositions };

