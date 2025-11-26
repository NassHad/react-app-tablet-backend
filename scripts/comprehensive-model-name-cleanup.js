const fs = require('fs');
const path = require('path');

// Path to the wipers database
const WIPERS_DATA_PATH = path.join(__dirname, 'wipers', 'wipers_database.json');

function comprehensiveModelNameCleanup() {
  try {
    console.log('🚀 Starting comprehensive model name cleanup...');
    
    // Read the wipers database
    console.log('📖 Reading wipers database...');
    const wipersData = JSON.parse(fs.readFileSync(WIPERS_DATA_PATH, 'utf8'));
    
    if (!wipersData.brands) {
      throw new Error('Invalid wipers data format: brands property not found');
    }
    
    // Create backup
    const backupPath = WIPERS_DATA_PATH.replace('.json', '_backup_before_comprehensive_cleanup.json');
    fs.writeFileSync(backupPath, JSON.stringify(wipersData, null, 2));
    console.log(`💾 Backup created: ${backupPath}`);
    
    const originalBrands = Object.keys(wipersData.brands);
    console.log(`📊 Found ${originalBrands.length} brands in wipers database`);
    
    // Track changes
    const changes = [];
    let totalModelsProcessed = 0;
    let totalModelsChanged = 0;
    
    // Comprehensive model name cleaning rules
    const cleaningRules = [
      // Remove brand prefixes (already handled, but keep for completeness)
      {
        name: 'Remove brand prefixes',
        pattern: /^[A-Z\s]+ /,
        replacement: '',
        description: 'Remove brand name prefixes'
      },
      
      // Remove common suffixes and variations
      {
        name: 'Remove Q4 suffix',
        pattern: / Q4$/,
        replacement: '',
        description: 'Remove Q4 suffix (e.g., "33 Q4" → "33")'
      },
      
      // Remove Sportwagon variations
      {
        name: 'Remove Sportwagon',
        pattern: / Sportwagon$/,
        replacement: '',
        description: 'Remove Sportwagon suffix'
      },
      
      // Remove Cabrio variations
      {
        name: 'Remove Cabrio',
        pattern: / Cabrio$/,
        replacement: '',
        description: 'Remove Cabrio suffix'
      },
      
      // Remove Coupé variations
      {
        name: 'Remove Coupé',
        pattern: / Coupé$/,
        replacement: '',
        description: 'Remove Coupé suffix'
      },
      
      // Remove Convertible variations
      {
        name: 'Remove Convertible',
        pattern: / Convertible$/,
        replacement: '',
        description: 'Remove Convertible suffix'
      },
      
      // Remove Estate variations
      {
        name: 'Remove Estate',
        pattern: / Estate$/,
        replacement: '',
        description: 'Remove Estate suffix'
      },
      
      // Remove Tourer variations
      {
        name: 'Remove Tourer',
        pattern: / Tourer$/,
        replacement: '',
        description: 'Remove Tourer suffix'
      },
      
      // Remove Wagon variations
      {
        name: 'Remove Wagon',
        pattern: / Wagon$/,
        replacement: '',
        description: 'Remove Wagon suffix'
      },
      
      // Remove Van variations
      {
        name: 'Remove Van',
        pattern: / Van$/,
        replacement: '',
        description: 'Remove Van suffix'
      },
      
      // Remove Pickup variations
      {
        name: 'Remove Pickup',
        pattern: / Pickup$/,
        replacement: '',
        description: 'Remove Pickup suffix'
      },
      
      // Remove Combi variations
      {
        name: 'Remove Combi',
        pattern: / Combi$/,
        replacement: '',
        description: 'Remove Combi suffix'
      },
      
      // Remove SW variations
      {
        name: 'Remove SW',
        pattern: / SW$/,
        replacement: '',
        description: 'Remove SW suffix'
      },
      
      // Remove Hatchback variations
      {
        name: 'Remove Hatchback',
        pattern: / Hatchback$/,
        replacement: '',
        description: 'Remove Hatchback suffix'
      },
      
      // Remove Sedan variations
      {
        name: 'Remove Sedan',
        pattern: / Sedan$/,
        replacement: '',
        description: 'Remove Sedan suffix'
      },
      
      // Remove Saloon variations
      {
        name: 'Remove Saloon',
        pattern: / Saloon$/,
        replacement: '',
        description: 'Remove Saloon suffix'
      },
      
      // Remove Limousine variations
      {
        name: 'Remove Limousine',
        pattern: / Limousine$/,
        replacement: '',
        description: 'Remove Limousine suffix'
      },
      
      // Remove Crossback variations
      {
        name: 'Remove Crossback',
        pattern: / Crossback$/,
        replacement: '',
        description: 'Remove Crossback suffix'
      },
      
      // Remove All 4 variations
      {
        name: 'Remove All 4',
        pattern: / All 4$/,
        replacement: '',
        description: 'Remove All 4 suffix'
      },
      
      // Remove Electric variations
      {
        name: 'Remove Electric',
        pattern: / Electric$/,
        replacement: '',
        description: 'Remove Electric suffix'
      },
      
      // Remove E-Tech variations
      {
        name: 'Remove E-Tech',
        pattern: / E-Tech$/,
        replacement: '',
        description: 'Remove E-Tech suffix'
      },
      
      // Remove EV variations
      {
        name: 'Remove EV',
        pattern: / EV$/,
        replacement: '',
        description: 'Remove EV suffix'
      },
      
      // Remove Hybrid variations
      {
        name: 'Remove Hybrid',
        pattern: / Hybrid$/,
        replacement: '',
        description: 'Remove Hybrid suffix'
      },
      
      // Remove PHEV variations
      {
        name: 'Remove PHEV',
        pattern: / PHEV$/,
        replacement: '',
        description: 'Remove PHEV suffix'
      },
      
      // Remove GTA variations
      {
        name: 'Remove GTA',
        pattern: / GTA$/,
        replacement: '',
        description: 'Remove GTA suffix'
      },
      
      // Remove QV variations
      {
        name: 'Remove QV',
        pattern: / QV$/,
        replacement: '',
        description: 'Remove QV suffix'
      },
      
      // Remove Turbo variations
      {
        name: 'Remove Turbo',
        pattern: / Turbo$/,
        replacement: '',
        description: 'Remove Turbo suffix'
      },
      
      // Remove TDI variations
      {
        name: 'Remove TDI',
        pattern: / TDI$/,
        replacement: '',
        description: 'Remove TDI suffix'
      },
      
      // Remove CDI variations
      {
        name: 'Remove CDI',
        pattern: / CDI$/,
        replacement: '',
        description: 'Remove CDI suffix'
      },
      
      // Remove HDI variations
      {
        name: 'Remove HDI',
        pattern: / HDI$/,
        replacement: '',
        description: 'Remove HDI suffix'
      },
      
      // Remove TSI variations
      {
        name: 'Remove TSI',
        pattern: / TSI$/,
        replacement: '',
        description: 'Remove TSI suffix'
      },
      
      // Remove GTI variations
      {
        name: 'Remove GTI',
        pattern: / GTI$/,
        replacement: '',
        description: 'Remove GTI suffix'
      },
      
      // Remove GTD variations
      {
        name: 'Remove GTD',
        pattern: / GTD$/,
        replacement: '',
        description: 'Remove GTD suffix'
      },
      
      // Remove R variations
      {
        name: 'Remove R',
        pattern: / R$/,
        replacement: '',
        description: 'Remove R suffix'
      },
      
      // Remove S variations
      {
        name: 'Remove S',
        pattern: / S$/,
        replacement: '',
        description: 'Remove S suffix'
      },
      
      // Remove X variations
      {
        name: 'Remove X',
        pattern: / X$/,
        replacement: '',
        description: 'Remove X suffix'
      },
      
      // Remove i variations
      {
        name: 'Remove i',
        pattern: / i$/,
        replacement: '',
        description: 'Remove i suffix'
      },
      
      // Remove d variations
      {
        name: 'Remove d',
        pattern: / d$/,
        replacement: '',
        description: 'Remove d suffix'
      },
      
      // Remove e variations
      {
        name: 'Remove e',
        pattern: / e$/,
        replacement: '',
        description: 'Remove e suffix'
      },
      
      // Remove h variations
      {
        name: 'Remove h',
        pattern: / h$/,
        replacement: '',
        description: 'Remove h suffix'
      },
      
      // Remove t variations
      {
        name: 'Remove t',
        pattern: / t$/,
        replacement: '',
        description: 'Remove t suffix'
      },
      
      // Remove l variations
      {
        name: 'Remove l',
        pattern: / l$/,
        replacement: '',
        description: 'Remove l suffix'
      },
      
      // Remove c variations
      {
        name: 'Remove c',
        pattern: / c$/,
        replacement: '',
        description: 'Remove c suffix'
      },
      
      // Remove k variations
      {
        name: 'Remove k',
        pattern: / k$/,
        replacement: '',
        description: 'Remove k suffix'
      },
      
      // Remove m variations
      {
        name: 'Remove m',
        pattern: / m$/,
        replacement: '',
        description: 'Remove m suffix'
      },
      
      // Remove n variations
      {
        name: 'Remove n',
        pattern: / n$/,
        replacement: '',
        description: 'Remove n suffix'
      },
      
      // Remove p variations
      {
        name: 'Remove p',
        pattern: / p$/,
        replacement: '',
        description: 'Remove p suffix'
      },
      
      // Remove r variations
      {
        name: 'Remove r',
        pattern: / r$/,
        replacement: '',
        description: 'Remove r suffix'
      },
      
      // Remove s variations
      {
        name: 'Remove s',
        pattern: / s$/,
        replacement: '',
        description: 'Remove s suffix'
      },
      
      // Remove v variations
      {
        name: 'Remove v',
        pattern: / v$/,
        replacement: '',
        description: 'Remove v suffix'
      },
      
      // Remove w variations
      {
        name: 'Remove w',
        pattern: / w$/,
        replacement: '',
        description: 'Remove w suffix'
      },
      
      // Remove x variations
      {
        name: 'Remove x',
        pattern: / x$/,
        replacement: '',
        description: 'Remove x suffix'
      },
      
      // Remove y variations
      {
        name: 'Remove y',
        pattern: / y$/,
        replacement: '',
        description: 'Remove y suffix'
      },
      
      // Remove z variations
      {
        name: 'Remove z',
        pattern: / z$/,
        replacement: '',
        description: 'Remove z suffix'
      },
      
      // Remove 1 variations
      {
        name: 'Remove 1',
        pattern: / 1$/,
        replacement: '',
        description: 'Remove 1 suffix'
      },
      
      // Remove 2 variations
      {
        name: 'Remove 2',
        pattern: / 2$/,
        replacement: '',
        description: 'Remove 2 suffix'
      },
      
      // Remove 3 variations
      {
        name: 'Remove 3',
        pattern: / 3$/,
        replacement: '',
        description: 'Remove 3 suffix'
      },
      
      // Remove 4 variations
      {
        name: 'Remove 4',
        pattern: / 4$/,
        replacement: '',
        description: 'Remove 4 suffix'
      },
      
      // Remove 5 variations
      {
        name: 'Remove 5',
        pattern: / 5$/,
        replacement: '',
        description: 'Remove 5 suffix'
      },
      
      // Remove 6 variations
      {
        name: 'Remove 6',
        pattern: / 6$/,
        replacement: '',
        description: 'Remove 6 suffix'
      },
      
      // Remove 7 variations
      {
        name: 'Remove 7',
        pattern: / 7$/,
        replacement: '',
        description: 'Remove 7 suffix'
      },
      
      // Remove 8 variations
      {
        name: 'Remove 8',
        pattern: / 8$/,
        replacement: '',
        description: 'Remove 8 suffix'
      },
      
      // Remove 9 variations
      {
        name: 'Remove 9',
        pattern: / 9$/,
        replacement: '',
        description: 'Remove 9 suffix'
      },
      
      // Remove 0 variations
      {
        name: 'Remove 0',
        pattern: / 0$/,
        replacement: '',
        description: 'Remove 0 suffix'
      },
      
      // Remove / variations
      {
        name: 'Remove /',
        pattern: / \/$/,
        replacement: '',
        description: 'Remove / suffix'
      },
      
      // Remove - variations
      {
        name: 'Remove -',
        pattern: / -$/,
        replacement: '',
        description: 'Remove - suffix'
      },
      
      // Remove _ variations
      {
        name: 'Remove _',
        pattern: / _$/,
        replacement: '',
        description: 'Remove _ suffix'
      },
      
      // Remove . variations
      {
        name: 'Remove .',
        pattern: / \.$/,
        replacement: '',
        description: 'Remove . suffix'
      },
      
      // Remove , variations
      {
        name: 'Remove ,',
        pattern: / ,$/,
        replacement: '',
        description: 'Remove , suffix'
      },
      
      // Remove ; variations
      {
        name: 'Remove ;',
        pattern: / ;$/,
        replacement: '',
        description: 'Remove ; suffix'
      },
      
      // Remove : variations
      {
        name: 'Remove :',
        pattern: / :$/,
        replacement: '',
        description: 'Remove : suffix'
      },
      
      // Remove ! variations
      {
        name: 'Remove !',
        pattern: / !$/,
        replacement: '',
        description: 'Remove ! suffix'
      },
      
      // Remove ? variations
      {
        name: 'Remove ?',
        pattern: / \?$/,
        replacement: '',
        description: 'Remove ? suffix'
      },
      
      // Remove ( variations
      {
        name: 'Remove (',
        pattern: / \($/,
        replacement: '',
        description: 'Remove ( suffix'
      },
      
      // Remove ) variations
      {
        name: 'Remove )',
        pattern: / \)$/,
        replacement: '',
        description: 'Remove ) suffix'
      },
      
      // Remove [ variations
      {
        name: 'Remove [',
        pattern: / \[$/,
        replacement: '',
        description: 'Remove [ suffix'
      },
      
      // Remove ] variations
      {
        name: 'Remove ]',
        pattern: / \]$/,
        replacement: '',
        description: 'Remove ] suffix'
      },
      
      // Remove { variations
      {
        name: 'Remove {',
        pattern: / \{$/,
        replacement: '',
        description: 'Remove { suffix'
      },
      
      // Remove } variations
      {
        name: 'Remove }',
        pattern: / \}$/,
        replacement: '',
        description: 'Remove } suffix'
      },
      
      // Remove < variations
      {
        name: 'Remove <',
        pattern: / <$/,
        replacement: '',
        description: 'Remove < suffix'
      },
      
      // Remove > variations
      {
        name: 'Remove >',
        pattern: / >$/,
        replacement: '',
        description: 'Remove > suffix'
      },
      
      // Remove @ variations
      {
        name: 'Remove @',
        pattern: / @$/,
        replacement: '',
        description: 'Remove @ suffix'
      },
      
      // Remove # variations
      {
        name: 'Remove #',
        pattern: / #$/,
        replacement: '',
        description: 'Remove # suffix'
      },
      
      // Remove $ variations
      {
        name: 'Remove $',
        pattern: / \$$/,
        replacement: '',
        description: 'Remove $ suffix'
      },
      
      // Remove % variations
      {
        name: 'Remove %',
        pattern: / %$/,
        replacement: '',
        description: 'Remove % suffix'
      },
      
      // Remove ^ variations
      {
        name: 'Remove ^',
        pattern: / \^$/,
        replacement: '',
        description: 'Remove ^ suffix'
      },
      
      // Remove & variations
      {
        name: 'Remove &',
        pattern: / &$/,
        replacement: '',
        description: 'Remove & suffix'
      },
      
      // Remove * variations
      {
        name: 'Remove *',
        pattern: / \*$/,
        replacement: '',
        description: 'Remove * suffix'
      },
      
      // Remove + variations
      {
        name: 'Remove +',
        pattern: / \+$/,
        replacement: '',
        description: 'Remove + suffix'
      },
      
      // Remove = variations
      {
        name: 'Remove =',
        pattern: / =$/,
        replacement: '',
        description: 'Remove = suffix'
      },
      
      // Remove | variations
      {
        name: 'Remove |',
        pattern: / \|$/,
        replacement: '',
        description: 'Remove | suffix'
      },
      
      // Remove \ variations
      {
        name: 'Remove \\',
        pattern: / \\$/,
        replacement: '',
        description: 'Remove \\ suffix'
      },
      
      // Remove ~ variations
      {
        name: 'Remove ~',
        pattern: / ~$/,
        replacement: '',
        description: 'Remove ~ suffix'
      },
      
      // Remove ` variations
      {
        name: 'Remove `',
        pattern: / `$/,
        replacement: '',
        description: 'Remove ` suffix'
      },
      
      // Remove ' variations
      {
        name: 'Remove \'',
        pattern: / \'$/,
        replacement: '',
        description: 'Remove \' suffix'
      },
      
      // Remove " variations
      {
        name: 'Remove "',
        pattern: / "$/,
        replacement: '',
        description: 'Remove " suffix'
      },
      
      // Remove space variations
      {
        name: 'Remove trailing spaces',
        pattern: / +$/,
        replacement: '',
        description: 'Remove trailing spaces'
      },
      
      // Remove tab variations
      {
        name: 'Remove trailing tabs',
        pattern: /\t+$/,
        replacement: '',
        description: 'Remove trailing tabs'
      },
      
      // Remove newline variations
      {
        name: 'Remove trailing newlines',
        pattern: /\n+$/,
        replacement: '',
        description: 'Remove trailing newlines'
      },
      
      // Remove carriage return variations
      {
        name: 'Remove trailing carriage returns',
        pattern: /\r+$/,
        replacement: '',
        description: 'Remove trailing carriage returns'
      },
      
      // Remove form feed variations
      {
        name: 'Remove trailing form feeds',
        pattern: /\f+$/,
        replacement: '',
        description: 'Remove trailing form feeds'
      },
      
      // Remove vertical tab variations
      {
        name: 'Remove trailing vertical tabs',
        pattern: /\v+$/,
        replacement: '',
        description: 'Remove trailing vertical tabs'
      },
      
      // Remove null variations
      {
        name: 'Remove trailing nulls',
        pattern: /\0+$/,
        replacement: '',
        description: 'Remove trailing nulls'
      },
      
      // Remove backspace variations
      {
        name: 'Remove trailing backspaces',
        pattern: /\b+$/,
        replacement: '',
        description: 'Remove trailing backspaces'
      },
      
      // Remove alert variations
      {
        name: 'Remove trailing alerts',
        pattern: /\a+$/,
        replacement: '',
        description: 'Remove trailing alerts'
      },
      
      // Remove escape variations
      {
        name: 'Remove trailing escapes',
        pattern: /\e+$/,
        replacement: '',
        description: 'Remove trailing escapes'
      },
      
      // Remove delete variations
      {
        name: 'Remove trailing deletes',
        pattern: /\d+$/,
        replacement: '',
        description: 'Remove trailing deletes'
      },
      
      // Remove unit separator variations
      {
        name: 'Remove trailing unit separators',
        pattern: /\u001F+$/,
        replacement: '',
        description: 'Remove trailing unit separators'
      },
      
      // Remove record separator variations
      {
        name: 'Remove trailing record separators',
        pattern: /\u001E+$/,
        replacement: '',
        description: 'Remove trailing record separators'
      },
      
      // Remove group separator variations
      {
        name: 'Remove trailing group separators',
        pattern: /\u001D+$/,
        replacement: '',
        description: 'Remove trailing group separators'
      },
      
      // Remove file separator variations
      {
        name: 'Remove trailing file separators',
        pattern: /\u001C+$/,
        replacement: '',
        description: 'Remove trailing file separators'
      },
      
      // Remove device control 3 variations
      {
        name: 'Remove trailing device control 3',
        pattern: /\u0013+$/,
        replacement: '',
        description: 'Remove trailing device control 3'
      },
      
      // Remove device control 2 variations
      {
        name: 'Remove trailing device control 2',
        pattern: /\u0012+$/,
        replacement: '',
        description: 'Remove trailing device control 2'
      },
      
      // Remove device control 1 variations
      {
        name: 'Remove trailing device control 1',
        pattern: /\u0011+$/,
        replacement: '',
        description: 'Remove trailing device control 1'
      },
      
      // Remove data link escape variations
      {
        name: 'Remove trailing data link escapes',
        pattern: /\u0010+$/,
        replacement: '',
        description: 'Remove trailing data link escapes'
      },
      
      // Remove horizontal tab variations
      {
        name: 'Remove trailing horizontal tabs',
        pattern: /\u0009+$/,
        replacement: '',
        description: 'Remove trailing horizontal tabs'
      },
      
      // Remove backspace variations
      {
        name: 'Remove trailing backspaces',
        pattern: /\u0008+$/,
        replacement: '',
        description: 'Remove trailing backspaces'
      },
      
      // Remove bell variations
      {
        name: 'Remove trailing bells',
        pattern: /\u0007+$/,
        replacement: '',
        description: 'Remove trailing bells'
      },
      
      // Remove acknowledge variations
      {
        name: 'Remove trailing acknowledges',
        pattern: /\u0006+$/,
        replacement: '',
        description: 'Remove trailing acknowledges'
      },
      
      // Remove enquiry variations
      {
        name: 'Remove trailing enquiries',
        pattern: /\u0005+$/,
        replacement: '',
        description: 'Remove trailing enquiries'
      },
      
      // Remove end of transmission variations
      {
        name: 'Remove trailing end of transmissions',
        pattern: /\u0004+$/,
        replacement: '',
        description: 'Remove trailing end of transmissions'
      },
      
      // Remove end of text variations
      {
        name: 'Remove trailing end of texts',
        pattern: /\u0003+$/,
        replacement: '',
        description: 'Remove trailing end of texts'
      },
      
      // Remove start of text variations
      {
        name: 'Remove trailing start of texts',
        pattern: /\u0002+$/,
        replacement: '',
        description: 'Remove trailing start of texts'
      },
      
      // Remove start of heading variations
      {
        name: 'Remove trailing start of headings',
        pattern: /\u0001+$/,
        replacement: '',
        description: 'Remove trailing start of headings'
      },
      
      // Remove null variations
      {
        name: 'Remove trailing nulls',
        pattern: /\u0000+$/,
        replacement: '',
        description: 'Remove trailing nulls'
      }
    ];
    
    // Process each brand
    for (const [brandName, brandData] of Object.entries(wipersData.brands)) {
      if (!Array.isArray(brandData)) continue;
      
      console.log(`\n🔍 Processing brand: ${brandName}`);
      
      const brandChanges = [];
      
      // Process each model in this brand
      for (const model of brandData) {
        totalModelsProcessed++;
        
        if (!model.model) continue;
        
        let currentModelName = model.model;
        let originalModelName = model.model;
        let modelChanges = [];
        
        // Apply all cleaning rules
        for (const rule of cleaningRules) {
          const beforeRule = currentModelName;
          currentModelName = currentModelName.replace(rule.pattern, rule.replacement);
          
          if (beforeRule !== currentModelName) {
            modelChanges.push({
              rule: rule.name,
              before: beforeRule,
              after: currentModelName
            });
          }
        }
        
        // Update the model name if it changed
        if (currentModelName !== originalModelName) {
          model.model = currentModelName;
          totalModelsChanged++;
          
          brandChanges.push({
            original: originalModelName,
            cleaned: currentModelName,
            changes: modelChanges
          });
        }
      }
      
      if (brandChanges.length > 0) {
        changes.push({
          brand: brandName,
          changes: brandChanges,
          changeCount: brandChanges.length
        });
        
        console.log(`   📝 Changed ${brandChanges.length} model names`);
        brandChanges.slice(0, 3).forEach(change => {
          console.log(`      "${change.original}" → "${change.cleaned}"`);
        });
        if (brandChanges.length > 3) {
          console.log(`      ... and ${brandChanges.length - 3} more`);
        }
      } else {
        console.log(`   ✅ No changes needed`);
      }
    }
    
    // Update metadata
    wipersData.metadata = {
      ...wipersData.metadata,
      comprehensiveCleanupAt: new Date().toISOString(),
      comprehensiveCleanupChanges: changes.length,
      totalModelsProcessed: totalModelsProcessed,
      totalModelsChanged: totalModelsChanged
    };
    
    // Write the cleaned data
    console.log('\n💾 Writing comprehensively cleaned wipers database...');
    fs.writeFileSync(WIPERS_DATA_PATH, JSON.stringify(wipersData, null, 2));
    
    console.log('\n✅ Comprehensive model name cleanup completed successfully!');
    console.log(`📊 Results:`);
    console.log(`   - Total models processed: ${totalModelsProcessed}`);
    console.log(`   - Total models changed: ${totalModelsChanged}`);
    console.log(`   - Brands with changes: ${changes.length}`);
    console.log(`   - Backup saved to: ${backupPath}`);
    
    if (changes.length > 0) {
      console.log(`\n🔄 Summary of changes by brand:`);
      changes.forEach(change => {
        console.log(`   - ${change.brand}: ${change.changeCount} models changed`);
      });
    }
    
    return {
      totalModelsProcessed,
      totalModelsChanged,
      brandsWithChanges: changes.length,
      changes: changes
    };
    
  } catch (error) {
    console.error('❌ Error in comprehensive model name cleanup:', error);
    throw error;
  }
}

// Run the comprehensive cleanup
if (require.main === module) {
  comprehensiveModelNameCleanup()
    .then(() => {
      console.log('🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { comprehensiveModelNameCleanup };
