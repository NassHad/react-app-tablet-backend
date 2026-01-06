# Export Brands & Models - Usage Guide

This guide explains how to export all brands and models from your Strapi database into structured JSON files.

## Quick Start (Recommended)

The easiest way is to use the shell script:

```bash
./scripts/run-export.sh
```

Or run the Strapi console command directly:

```bash
npm run strapi -- console < scripts/export-all-brands-models.js
```

That's it! The script will export all data to `scripts/exported_data/`.

---

## Three Ways to Run the Export

### Option 1: Shell Script (Easiest ✅)

**File:** `run-export.sh`

**Usage:**
```bash
# From project root
./scripts/run-export.sh
```

**Pros:**
- Simplest to run
- Single command
- Works from command line
- Proper Strapi integration

**How it works:**
- Uses Strapi's built-in console command
- Runs the export script
- Exits cleanly

---

### Option 2: Strapi Console Command (Recommended)

**Usage:**
```bash
# From project root, pipe the script to Strapi console
npm run strapi -- console < scripts/export-all-brands-models.js
```

**Pros:**
- Direct Strapi console integration
- No manual copy-paste
- Can be run from terminal

---

### Option 3: Browser Console (Manual)

**File:** `export-all-brands-models.js`

**Usage:**
1. Start Strapi in development mode:
   ```bash
   npm run develop
   ```

2. Open Strapi admin in browser: `http://localhost:1337/admin`

3. Open browser console (F12 or Cmd+Option+I)

4. Copy the ENTIRE contents of `scripts/export-all-brands-models.js`

5. Paste into browser console and press Enter

**Pros:**
- Can run while Strapi is already running
- Useful for debugging in browser context

**Cons:**
- Requires manual copy-paste
- Browser console limitations

---

## Configuration

Edit the configuration at the top of the script:

```javascript
const DRY_RUN = false;           // Set to true to test without writing files
const PAGE_SIZE = 1000;          // Database pagination size
const BATCH_SIZE = 1000;         // Models per no-brand file
const PARALLEL_WRITES = 10;      // Concurrent brand file writes
```

### Dry Run Mode

To test the export without creating any files:

1. Open the script file
2. Change `DRY_RUN = false` to `DRY_RUN = true`
3. Run the script
4. Review the console output to see what would be created

---

## Output Structure

The script creates the following structure:

```
scripts/exported_data/
├── all-brands.json              # All brands with metadata
├── summary.json                 # Export statistics
├── brands/                      # One file per brand
│   ├── toyota.json
│   ├── bmw.json
│   ├── honda.json
│   └── ... (~70-100 files)
└── no-brand/                    # Models without brand
    ├── car-no-brand-1.json      # First 1000 car models
    ├── car-no-brand-2.json      # Next 1000 car models
    ├── moto-no-brand-1.json     # First 1000 moto models
    └── ...
```

### File Formats

#### all-brands.json
```json
{
  "exportDate": "2026-01-06T19:45:00.000Z",
  "totalBrands": 98,
  "brands": [
    {
      "id": 1,
      "name": "Toyota",
      "slug": "toyota",
      "vehicle_type": "car",
      "isActive": true,
      "modelCount": 145
    }
  ]
}
```

#### brands/{slug}.json
```json
{
  "brandInfo": {
    "id": 1,
    "name": "Toyota",
    "slug": "toyota",
    "vehicle_type": "car",
    "isActive": true
  },
  "modelCount": 145,
  "exportDate": "2026-01-06T19:45:00.000Z",
  "models": [
    {
      "id": 101,
      "name": "Corolla",
      "slug": "corolla",
      "vehicle_type": "car",
      "isActive": true
    }
  ]
}
```

#### no-brand/{type}-no-brand-{n}.json
```json
{
  "vehicleType": "car",
  "batchNumber": 1,
  "totalInBatch": 1000,
  "exportDate": "2026-01-06T19:45:00.000Z",
  "models": [
    {
      "id": 5001,
      "name": "Unknown Model",
      "slug": "unknown-model",
      "vehicle_type": "car",
      "isActive": false
    }
  ]
}
```

#### summary.json
```json
{
  "exportDate": "2026-01-06T19:45:00.000Z",
  "executionTime": "45.2 seconds",
  "statistics": {
    "totalBrands": 98,
    "totalModels": 5016,
    "modelsWithBrand": 3450,
    "modelsWithoutBrand": 1566,
    "byVehicleType": {
      "car": 2360,
      "moto": 2656
    }
  },
  "topBrandsByModelCount": [
    { "brand": "Toyota", "modelCount": 145 }
  ]
}
```

---

## Adding to package.json

You can add the export as an npm script for easier access:

```json
{
  "scripts": {
    "export:brands": "node scripts/export-all-brands-models-node.js"
  }
}
```

Then run with:
```bash
npm run export:brands
```

---

## Performance

Expected execution time for typical dataset:
- ~100 brands
- ~5000 models
- **Total time: 45-60 seconds**

The script uses:
- Pagination to avoid memory issues
- Parallel writes for faster file creation
- Progress logging to track status

---

## Troubleshooting

### "Strapi not found" error
Make sure you're running from the project root directory where `package.json` is located.

### "Permission denied" error
Check that you have write permissions in the `scripts/` directory.

### Memory issues
If you have a very large database:
1. Reduce `PAGE_SIZE` from 1000 to 500
2. Reduce `PARALLEL_WRITES` from 10 to 5

### Incomplete export
Check `scripts/exported_data/export-errors.json` for error details.

---

## Validation

After export, verify the results:

1. **Check summary.json** for statistics
   ```bash
   cat scripts/exported_data/summary.json
   ```

2. **Count brand files**
   ```bash
   ls scripts/exported_data/brands/ | wc -l
   ```

3. **Validate JSON files**
   ```bash
   # Check a random brand file
   cat scripts/exported_data/brands/toyota.json | jq '.'
   ```

4. **Check for errors**
   ```bash
   cat scripts/exported_data/export-errors.json
   ```

---

## Next Steps

After exporting:

1. Review `summary.json` for statistics
2. Check if there are models without brands in `no-brand/` folder
3. Use the exported data for:
   - Backup/migration
   - External processing
   - Data analysis
   - Integration with other systems

---

## Support

If you encounter issues:
1. Check the console output for error messages
2. Review `export-errors.json` if it exists
3. Try running with `DRY_RUN = true` first
4. Ensure Strapi dependencies are installed: `npm install`
