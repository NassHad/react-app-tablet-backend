const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

/**
 * Convert OSRAM Motorcycle Guide PDF to JSON
 * Extracts motorcycle lamp data and converts to structured JSON format
 */

const PDF_FILE = path.join(__dirname, 'liste_affectation', 'Osram - Guide d\'application moto.pdf');
const OUTPUT_FILE = path.join(__dirname, 'liste_affectation', 'osram-moto-lamps.json');

// Check for limit flag
const LIMIT_ARG = process.argv.find(arg => arg.startsWith('--limit='));
const ROW_LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : null;

/**
 * Generate URL-friendly slug from text
 * @param {string} text - Text to slugify
 * @returns {string} - Slugified text
 */
function generateSlug(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/\s+/g, '-') // Spaces to hyphens
    .replace(/[^\w\-]/g, '') // Remove special chars
    .replace(/\-+/g, '-') // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '') // Trim hyphens
    .substring(0, 50); // Limit length
}

/**
 * Parse construction year string from PDF
 * @param {string} yearString - Format: "MM/YY-MM/YY" or "MM/YY->>"
 * @returns {object} - {start, end}
 */
function parseConstructionYear(yearString) {
  if (!yearString || yearString === '-' || yearString === '—') {
    return { start: '', end: '' };
  }

  // Remove any non-date text (like "Standard" that might still be there)
  yearString = yearString.trim();

  // Format: "01/90-12/93" or "01/90->>" or "01/90-Present"
  const match = yearString.match(/(\d{2}\/\d{2})\s*-\s*([>\d\/]+)/);

  if (!match) {
    // Try to match just start date
    const startMatch = yearString.match(/(\d{2}\/\d{2})/);
    if (startMatch) {
      return { start: startMatch[1], end: '' };
    }
    return { start: yearString.trim(), end: '' };
  }

  let endDate = match[2].trim();
  // Convert >> to "Present"
  if (endDate === '>>' || endDate.includes('>>')) {
    endDate = 'Present';
  }

  return {
    start: match[1],
    end: endDate
  };
}

/**
 * Clean lamp reference from PDF artifacts
 * @param {string} ref - Lamp reference
 * @returns {string|null} - Cleaned reference or null if invalid
 */
function cleanLampReference(ref) {
  if (!ref) return null;

  // Remove extra whitespace
  ref = ref.trim();

  // Skip placeholder values
  if (ref === '-' || ref === '—' || ref === 'N/A' || ref === '' || ref === '**') {
    return null;
  }

  return ref;
}

/**
 * Detect if line is a brand header (all caps, standalone)
 * @param {string} line - Line to check
 * @returns {string|null} - Brand name or null
 */
function detectBrand(line) {
  // Brand names are typically all uppercase and on their own line
  // Example: "APRILIA"
  const trimmed = line.trim();

  // Must be all uppercase letters (possibly with spaces)
  if (!/^[A-Z\s-]+$/.test(trimmed)) return null;

  // Should be reasonable length (not too short, not too long)
  if (trimmed.length < 3 || trimmed.length > 30) return null;

  // Should not contain numbers
  if (/\d/.test(trimmed)) return null;

  return trimmed;
}

/**
 * Lamp position mapping from column index to French categories
 * Based on typical motorcycle lamp layout in OSRAM PDF
 */
const MOTO_LAMP_COLUMNS = [
  { position: 'Feu de croisement', category: 'feu_croisement_moto' },
  { position: 'Feu de route', category: 'feu_route_moto' },
  { position: 'Éclairage jour', category: 'eclairage_jour_moto' },
  { position: 'Feu de position', category: 'feu_position_avant_moto' },
  { position: 'Feu antibrouillard', category: 'feu_antibrouillard_moto' },
  { position: 'Clignotant avant', category: 'clignotant_avant_moto' },
  { position: 'Clignotant arrière', category: 'clignotant_arriere_moto' },
  { position: 'Feu arrière', category: 'feu_arriere_moto' },
  { position: 'Feu de stop', category: 'feu_stop_moto' },
  { position: 'Éclairage plaque', category: 'feu_plaque_immatriculation_moto' }
];

/**
 * Parse a table row from PDF text
 * Expected format: Model \t Year Type \t Lamp1 \t Lamp2 \t ...
 * @param {string} line - Line from PDF
 * @returns {object|null} - Parsed row data or null
 */
function parseTableRow(line) {
  // Split by tabs (PDF uses tabs for columns)
  const cells = line.split('\t').map(s => s.trim()).filter(Boolean);

  // Need at least: Model, Year/Type, and some lamps
  if (cells.length < 3) return null;

  // First cell should look like a model name (contains letters/numbers)
  if (!/[A-Za-z0-9]/.test(cells[0])) return null;

  // Second cell should contain year information
  const yearTypeCell = cells[1];

  // Skip header rows or invalid rows
  if (yearTypeCell.includes('construction') || yearTypeCell.includes('Année')) return null;

  // Parse year and type from the combined cell
  // Formats: "01/90-12/93 Standard", "10/12->>", "01/90-12/93 > 2003"
  let year = yearTypeCell;
  let type = '';

  // Check if there's text after the year (type conception)
  const yearMatch = yearTypeCell.match(/^(\d{2}\/\d{2}-[>\d\/]+)\s*(.*)$/);
  if (yearMatch) {
    year = yearMatch[1];
    type = yearMatch[2] || 'Standard';
  } else if (cells.length > 2 && !cells[2].match(/^[A-Z0-9-]+$/)) {
    // If cell 2 doesn't look like a lamp ref, it might be the type
    type = cells[2];
    // Lamp refs start at position 3
    return {
      model: cells[0],
      year: year,
      type: type,
      lampRefs: cells.slice(3)
    };
  }

  return {
    model: cells[0],
    year: year,
    type: type || 'Standard',
    lampRefs: cells.slice(2) // Lamp refs start at position 2
  };
}

/**
 * Build lamp record in target JSON format
 * @param {object} rowData - Parsed row data
 * @param {string} brand - Brand name
 * @param {number} recordId - Record ID
 * @returns {object} - Formatted record
 */
function buildLampRecord(rowData, brand, recordId) {
  const { model, year, type, lampRefs } = rowData;

  const constructionYear = parseConstructionYear(year);

  // Build lightType object dynamically
  const lightType = {};
  let positionCounter = 1;

  lampRefs.forEach((ref, idx) => {
    const cleanRef = cleanLampReference(ref);

    // Skip empty references
    if (!cleanRef) return;

    // Get position info (or use generic if we run out of defined positions)
    const posInfo = MOTO_LAMP_COLUMNS[idx] || {
      position: `Position ${idx + 1}`,
      category: `position_${idx + 1}_moto`
    };

    lightType[`position${positionCounter}`] = {
      ref: cleanRef,
      position: posInfo.position,
      category: posInfo.category
    };

    positionCounter++;
  });

  // Only create record if we have at least one lamp position
  if (Object.keys(lightType).length === 0) {
    return null;
  }

  return {
    id: recordId,
    constructionYear,
    typeConception: type,
    lightType,
    position: 'Multiple positions',
    category: 'multiple',
    partNumber: '',
    notes: '',
    source: 'OSRAM Motorcycle Guide PDF',
    brandSlug: generateSlug(brand),
    modelSlug: generateSlug(model),
    originalBrand: brand,
    originalModel: model
  };
}

/**
 * Validate record has required fields
 * @param {object} record - Record to validate
 * @returns {array} - Array of error messages (empty if valid)
 */
function validateRecord(record) {
  const errors = [];

  if (!record.brandSlug || record.brandSlug.length < 2) {
    errors.push('Invalid brandSlug');
  }

  if (!record.modelSlug || record.modelSlug.length < 2) {
    errors.push('Invalid modelSlug');
  }

  if (!record.lightType || Object.keys(record.lightType).length === 0) {
    errors.push('No lamp positions found');
  }

  return errors;
}

/**
 * Display statistics about processed records
 * @param {array} records - All records
 */
function showStatistics(records) {
  console.log('\n📊 Statistics:');

  // Brand distribution
  const brandCounts = {};
  records.forEach(r => {
    brandCounts[r.originalBrand] = (brandCounts[r.originalBrand] || 0) + 1;
  });

  console.log(`\n🏍️  Brands processed: ${Object.keys(brandCounts).length}`);
  Object.entries(brandCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .forEach(([brand, count]) => {
      console.log(`   ${brand}: ${count} models`);
    });

  // Lamp type distribution
  const lampTypes = {};
  records.forEach(r => {
    Object.values(r.lightType).forEach(lamp => {
      lampTypes[lamp.ref] = (lampTypes[lamp.ref] || 0) + 1;
    });
  });

  console.log(`\n💡 Most common lamp types (top 15):`);
  Object.entries(lampTypes)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 15)
    .forEach(([type, count]) => {
      console.log(`   ${type}: ${count} occurrences`);
    });
}

/**
 * Display sample records
 * @param {array} records - All records
 */
function showSampleRecords(records) {
  console.log('\n🔍 Sample records (first 3):');
  records.slice(0, 3).forEach((record, idx) => {
    console.log(`\n--- Record ${idx + 1} ---`);
    console.log(`Brand: ${record.originalBrand} (${record.brandSlug})`);
    console.log(`Model: ${record.originalModel} (${record.modelSlug})`);
    console.log(`Year: ${record.constructionYear.start} - ${record.constructionYear.end}`);
    console.log(`Type: ${record.typeConception}`);
    console.log(`Lamp positions: ${Object.keys(record.lightType).length}`);

    Object.entries(record.lightType).slice(0, 3).forEach(([pos, lamp]) => {
      console.log(`  ${pos}: ${lamp.ref} (${lamp.category})`);
    });
    if (Object.keys(record.lightType).length > 3) {
      console.log(`  ... and ${Object.keys(record.lightType).length - 3} more`);
    }
  });
}

/**
 * Extract text from PDF
 * @returns {Promise<string>} - Extracted text
 */
async function extractPDFData() {
  const dataBuffer = fs.readFileSync(PDF_FILE);
  const parser = new PDFParse({ data: dataBuffer });
  const result = await parser.getText();
  return result.text;
}

/**
 * Main conversion function
 */
async function convertPDFToJSON() {
  console.log('🏍️  Starting OSRAM Motorcycle PDF to JSON conversion...');
  console.log(`📁 Reading PDF: ${PDF_FILE}`);
  console.log(`📄 Output file: ${OUTPUT_FILE}\n`);

  if (ROW_LIMIT) {
    console.log(`🧪 LIMIT MODE: Processing first ${ROW_LIMIT} records only\n`);
  }

  const records = [];
  let currentBrand = null;
  let recordId = 1;

  let processedRows = 0;
  let skippedRows = 0;
  let errorCount = 0;

  try {
    // Extract text from PDF
    const pdfText = await extractPDFData();
    const lines = pdfText.split('\n');

    console.log(`📄 Extracted ${lines.length} lines from PDF\n`);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) continue;

      try {
        // Detect brand header
        const brand = detectBrand(line);
        if (brand) {
          currentBrand = brand;
          console.log(`🏷️  Processing brand: ${currentBrand}`);
          continue;
        }

        // Parse data row
        if (currentBrand) {
          const rowData = parseTableRow(line);

          if (!rowData) {
            continue;
          }

          const record = buildLampRecord(rowData, currentBrand, recordId);

          if (!record) {
            skippedRows++;
            continue;
          }

          // Validate record
          const errors = validateRecord(record);
          if (errors.length > 0) {
            console.warn(`⚠️  Validation errors for ${record.originalModel}: ${errors.join(', ')}`);
            errorCount++;
            continue;
          }

          records.push(record);
          recordId++;
          processedRows++;

          // Check limit
          if (ROW_LIMIT && records.length >= ROW_LIMIT) {
            console.log(`\n⚠️  Reached limit of ${ROW_LIMIT} records\n`);
            break;
          }

          // Progress logging
          if (processedRows % 50 === 0) {
            console.log(`📊 Processed ${processedRows} motorcycle models...`);
          }
        }

      } catch (error) {
        console.error(`❌ Error on line ${i}: ${error.message}`);
        errorCount++;
      }
    }

    // Summary
    console.log(`\n📈 Conversion Summary:`);
    console.log(`   📥 Total valid records: ${records.length}`);
    console.log(`   ⏭️  Skipped rows: ${skippedRows}`);
    console.log(`   ❌ Errors: ${errorCount}`);

    if (records.length === 0) {
      console.log('\n⚠️  No records extracted. Check PDF format.');
      return;
    }

    // Write output
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(records, null, 2), 'utf-8');
    console.log(`\n✅ JSON file created successfully!`);
    console.log(`📄 Output: ${OUTPUT_FILE}`);

    // Display statistics and samples
    showSampleRecords(records);
    showStatistics(records);

  } catch (error) {
    console.error('\n💥 Conversion failed:', error);
    throw error;
  }
}

// Run conversion
if (require.main === module) {
  convertPDFToJSON()
    .then(() => {
      console.log('\n✨ Conversion completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { convertPDFToJSON, generateSlug, parseConstructionYear };
