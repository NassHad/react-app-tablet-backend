# 🔦 Lights Import Guide

## 📋 Overview

This guide explains how to import and use the lights data from `osram_bulbs_parsed.json` into your Strapi application.

## 🏗️ Data Structure

### Entities Created:

1. **LightsBrand** - Vehicle brands (ABARTH, AUDI, BMW, etc.)
2. **LightsModel** - Vehicle models with year ranges (124 Spider, A3, etc.)
3. **LightsPosition** - Light positions per model (Feu de croisement, Feu de route, etc.)
4. **LightPositionData** - Actual light bulb data (H11, H15, etc.)

### Relationships:
```
LightsBrand (1) ←→ (Many) LightsModel
LightsModel (1) ←→ (Many) LightsPosition
LightsPosition (1) ←→ (Many) LightPositionData
```

## 🚀 Import Process

### Step 1: Restart Strapi
```bash
# Stop current Strapi instance (Ctrl+C)
npm run develop
```

### Step 2: Import Data (in order)

#### 2.1 Import Brands
```bash
npx strapi console
```
Then run:
```javascript
// Copy and paste the entire content of public/strapi-console-import-lights-brands.js
```

#### 2.2 Import Models
```javascript
// Copy and paste the entire content of public/strapi-console-import-lights-models.js
```

#### 2.3 Import Positions
```javascript
// Copy and paste the entire content of public/strapi-console-import-lights-positions.js
```

#### 2.4 Import Light Data
```javascript
// Copy and paste the entire content of public/strapi-console-import-light-position-data.js
```

## 📊 Data Statistics

- **436,930 total records** in osram_bulbs_parsed.json
- **67 unique brands** (ABARTH, ALFA ROMEO, AUDI, BMW, etc.)
- **12 light categories** (feu_croisement, feu_route, eclairage_jour, etc.)
- **Multiple light types per position** (H11, H15, WY21W, etc.)

## 🔌 API Endpoints

### Get Brands and Models by Category
```
GET /api/lights-selection/category/:categoryId
```

### Get Brands by Category
```
GET /api/lights-selection/category/:categoryId/brands
```

### Get Models by Category and Brand
```
GET /api/lights-selection/category/:categoryId/brand/:brandId/models
```

### Get Positions by Model
```
GET /api/lights-selection/model/:modelId/positions
```

### Get Light Data by Position
```
GET /api/lights-selection/position/:positionId/data
```

## 🎯 Demo Page

Test the lights selection at:
```
http://localhost:1337/lights-form-demo.html
```

## 📝 Example Data Flow

1. **Select Category** → Load available brands
2. **Select Brand** → Load available models for that brand
3. **Select Model** → Load available light positions for that model
4. **Select Position** → Show all available light bulbs for that position

## 🔧 Troubleshooting

### If import fails:
1. Check that Strapi is running
2. Verify the data file exists at `scripts/osram_bulbs_parsed.json`
3. Check console for error messages
4. Ensure all previous steps completed successfully

### If API returns empty results:
1. Verify data was imported successfully
2. Check that relationships are properly set up
3. Ensure `isActive` fields are set to `true`

## 📈 Performance Notes

- The light data import processes 436,930 records
- Progress is shown every 1,000 records
- Import may take several minutes to complete
- Consider running imports during off-peak hours

## 🎉 Success!

Once imported, you'll have a complete lights selection system with:
- ✅ 67 vehicle brands
- ✅ Thousands of vehicle models with year ranges
- ✅ Multiple light positions per model
- ✅ Complete light bulb specifications
- ✅ API endpoints for frontend integration
- ✅ Demo page for testing
