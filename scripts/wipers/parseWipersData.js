const fs = require('fs');
const path = require('path');

// Read the CSV file
const csvPath = path.join(__dirname, 'Database_PerfectVision_Mai2025.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// Parse CSV content
const lines = csvContent.split('\n');
const data = [];

// Skip header lines (first 5 lines are headers)
for (let i = 5; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line && !line.startsWith(';')) {
    const columns = line.split(';');
    
    if (columns.length >= 18) {
      const entry = {
        id: columns[0],
        brand: columns[1],
        model: columns[2],
        picto1: columns[3],
        picto2: columns[4],
        direction: columns[5],
        startMonth: columns[6],
        startYear: columns[7],
        endMonth: columns[8],
        endYear: columns[9],
        wipers: {
          // Balais plat avant multiconnexion (columns 11-14)
          multiconnexion: {
            kitAvant: columns[10] || null,
            coteConducteur: columns[11] || null,
            monoBalais: columns[12] || null,
            cotePassager: columns[13] || null
          },
          // Balais avant standard (columns 15-17)
          standard: {
            coteConducteur: columns[14] || null,
            monoBalais: columns[15] || null,
            cotePassager: columns[16] || null
          },
          // Arriere (column 18)
          arriere: columns[17] || null
        }
      };
      
      // Only add entries that have at least one wiper reference
      const hasWipers = entry.wipers.multiconnexion.kitAvant || 
                       entry.wipers.multiconnexion.coteConducteur ||
                       entry.wipers.multiconnexion.monoBalais ||
                       entry.wipers.multiconnexion.cotePassager ||
                       entry.wipers.standard.coteConducteur ||
                       entry.wipers.standard.monoBalais ||
                       entry.wipers.standard.cotePassager ||
                       entry.wipers.arriere;
      
      if (hasWipers) {
        data.push(entry);
      }
    }
  }
}

// Organize data by brand
const organizedData = {};

data.forEach(entry => {
  if (!organizedData[entry.brand]) {
    organizedData[entry.brand] = [];
  }
  
  organizedData[entry.brand].push({
    id: entry.id,
    model: entry.model,
    picto1: entry.picto1,
    picto2: entry.picto2,
    direction: entry.direction,
    productionYears: {
      start: entry.startYear ? `${entry.startMonth}/${entry.startYear}` : null,
      end: entry.endYear ? `${entry.endMonth}/${entry.endYear}` : null
    },
    wipers: entry.wipers
  });
});

// Create final JSON structure
const jsonData = {
  metadata: {
    source: "Database_PerfectVision_Mai2025.csv",
    totalVehicles: data.length,
    brands: Object.keys(organizedData).length,
    categories: {
      multiconnexion: "Balais plat avant multiconnexion (columns 11-14)",
      standard: "Balais avant standard (columns 15-17)", 
      arriere: "Arriere (column 18)"
    },
    generatedAt: new Date().toISOString()
  },
  brands: organizedData
};

// Save to JSON file
const outputPath = path.join(__dirname, 'wipers_database.json');
fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), 'utf-8');

console.log(`✅ Successfully parsed ${data.length} vehicles with wiper data`);
console.log(`📊 Found ${Object.keys(organizedData).length} brands`);
console.log(`💾 Saved to: ${outputPath}`);

// Show some statistics
const stats = {
  totalEntries: data.length,
  brands: Object.keys(organizedData).length,
  entriesWithMulticonnexion: data.filter(entry => 
    entry.wipers.multiconnexion.kitAvant || 
    entry.wipers.multiconnexion.coteConducteur ||
    entry.wipers.multiconnexion.monoBalais ||
    entry.wipers.multiconnexion.cotePassager
  ).length,
  entriesWithStandard: data.filter(entry => 
    entry.wipers.standard.coteConducteur ||
    entry.wipers.standard.monoBalais ||
    entry.wipers.standard.cotePassager
  ).length,
  entriesWithArriere: data.filter(entry => entry.wipers.arriere).length
};

console.log('\n📈 Statistics:');
console.log(`- Total vehicles: ${stats.totalEntries}`);
console.log(`- Brands: ${stats.brands}`);
console.log(`- With multiconnexion wipers: ${stats.entriesWithMulticonnexion}`);
console.log(`- With standard wipers: ${stats.entriesWithStandard}`);
console.log(`- With rear wipers: ${stats.entriesWithArriere}`);

// Show sample data for first brand
const firstBrand = Object.keys(organizedData)[0];
if (firstBrand) {
  console.log(`\n🔍 Sample data for ${firstBrand}:`);
  console.log(JSON.stringify(organizedData[firstBrand].slice(0, 2), null, 2));
}
