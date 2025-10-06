# Brand and Model Import Scripts

This directory contains multiple scripts to import brand and model data into your Strapi application, each designed for different scenarios.

## Files

### Import Scripts
- `import-brands-and-models.cjs` - Main import script using Strapi's internal API (requires ts-node)
- `import-http.js` - HTTP-based import script (works with running Strapi instance)
- `import-simple.js` - Simple import script using axios (requires axios dependency)
- `import-brands.cjs` - Individual brand import script
- `import-models.cjs` - Individual model import script

### Test Scripts
- `test-import.cjs` - Test script to verify the import worked correctly
- `import.bat` - Windows batch file for easy script execution

### Data Files
- `json_data/final_brands.json` - Brand data file
- `json_data/cleaned_models.json` - Model data file

## Usage

### Option 1: HTTP-based Import (Recommended)

This method works with a running Strapi instance and doesn't require ts-node:

```bash
# Start Strapi in development mode (in one terminal)
npm run develop

# Import brands and models (in another terminal)
node scripts/import-http.js

# Import and auto-publish entries
PUBLISH=true node scripts/import-http.js
```

### Option 2: Internal API Import

This method uses Strapi's internal API but requires ts-node:

```bash
# Import brands and models (draft mode)
node scripts/import-brands-and-models.cjs

# Import and auto-publish entries
PUBLISH=true node scripts/import-brands-and-models.cjs

# Clear existing data and import fresh
CLEAR_EXISTING=true node scripts/import-brands-and-models.cjs

# Clear existing data, import and auto-publish
CLEAR_EXISTING=true PUBLISH=true node scripts/import-brands-and-models.cjs
```

### Option 3: Individual Imports

```bash
# Import only brands
node scripts/import-brands.cjs data/brands.json

# Import only models
node scripts/import-models.cjs scripts/models.json
```

### Option 4: Windows Batch File

```bash
# Run the interactive batch file
scripts/import.bat
```

### Test Import

```bash
# Test the import results
node scripts/test-import.cjs
```

## Environment Variables

- `PUBLISH` - Set to `true` to auto-publish imported entries (default: false)
- `CLEAR_EXISTING` - Set to `true` to clear existing data before import (default: false)

## Data Structure

### Brands (final_brands.json)
```json
{
  "id": 1,
  "name": "ABARTH",
  "slug": "abarth",
  "isActive": true
}
```

### Models (cleaned_models.json)
```json
{
  "id": 1,
  "name": "124 Spider",
  "brandSlug": "abarth",
  "modelSlug": "124-spider"
}
```

## Features

- **Deduplication**: Automatically removes duplicate entries based on slug
- **Error Handling**: Continues processing even if individual entries fail
- **Progress Reporting**: Shows detailed progress during import
- **Relationship Mapping**: Automatically links models to their brands
- **Batch Processing**: Efficiently processes large datasets
- **Validation**: Validates data before import

## Prerequisites

Make sure you have the required dependencies:

```bash
npm install -D ts-node typescript @types/node
```

## Troubleshooting

1. **ts-node missing**: Run `npm i -D ts-node typescript @types/node`
2. **File not found**: Ensure the JSON files exist in the correct paths
3. **Brand not found**: Make sure brands are imported before models
4. **Permission errors**: Ensure Strapi is not running when importing

## Notes

- The script imports brands first, then models (due to foreign key relationships)
- Models are linked to brands using the `brandSlug` field
- All entries are created in draft mode unless `PUBLISH=true` is set
- The script skips existing entries to avoid duplicates
