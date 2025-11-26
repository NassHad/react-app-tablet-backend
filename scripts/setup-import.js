/**
 * Setup script for Purflux Filter System Import
 * Installs required dependencies and checks environment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up Purflux Filter System Import...');
console.log('=' .repeat(50));

// Check if we're in the right directory
if (!fs.existsSync('package.json')) {
  console.error('❌ Please run this script from the project root directory');
  process.exit(1);
}

// Check if Strapi is installed
if (!fs.existsSync('src/index.ts')) {
  console.error('❌ This doesn\'t appear to be a Strapi project');
  console.log('💡 Make sure you\'re in the correct directory');
  process.exit(1);
}

// Install required dependencies
console.log('\n📦 Installing required dependencies...');
try {
  execSync('npm install csv-parse', { stdio: 'inherit' });
  console.log('✅ csv-parse installed');
} catch (error) {
  console.error('❌ Failed to install csv-parse:', error.message);
  process.exit(1);
}

// Check if fetch is available (Node 18+)
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));

if (majorVersion < 18) {
  console.log('\n⚠️  Node.js version 18+ required for fetch API');
  console.log(`   Current version: ${nodeVersion}`);
  console.log('   Please upgrade Node.js or install node-fetch');
  
  try {
    execSync('npm install node-fetch', { stdio: 'inherit' });
    console.log('✅ node-fetch installed as fallback');
  } catch (error) {
    console.error('❌ Failed to install node-fetch:', error.message);
  }
}

// Check CSV files
console.log('\n📁 Checking CSV files...');
const csvFiles = [
  'scripts/liste_affectation/recap_data_purflux.csv',
  'scripts/liste_affectation/Applications_borne_20240118_Purflux.csv'
];

let allFilesExist = true;
csvFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - NOT FOUND`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log('\n⚠️  Some CSV files are missing');
  console.log('   Please ensure the CSV files are in the correct location');
}

// Check content types
console.log('\n🏗️  Checking content types...');
const contentTypes = [
  'src/api/filter-product/content-types/filter-product/schema.json',
  'src/api/filter-compatibility/content-types/filter-compatibility/schema.json'
];

let allContentTypesExist = true;
contentTypes.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - NOT FOUND`);
    allContentTypesExist = false;
  }
});

if (!allContentTypesExist) {
  console.log('\n⚠️  Some content types are missing');
  console.log('   Please ensure the content types are created');
}

// Final status
console.log('\n🎯 Setup Summary:');
console.log('=' .repeat(30));

if (allFilesExist && allContentTypesExist) {
  console.log('✅ All dependencies installed');
  console.log('✅ CSV files found');
  console.log('✅ Content types created');
  console.log('\n🚀 Ready to import!');
  console.log('\nNext steps:');
  console.log('1. Start Strapi: npm run develop');
  console.log('2. Wait for Strapi to fully start');
  console.log('3. Run import: node scripts/import-to-strapi.js');
} else {
  console.log('⚠️  Setup incomplete');
  console.log('   Please fix the issues above before running the import');
}

console.log('\n💡 For help, check the documentation in db_structure.md');
