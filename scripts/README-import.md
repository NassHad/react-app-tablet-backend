# Purflux Filter System Import Guide

This guide explains how to import the Purflux filter data into your Strapi backend.

## 📋 Prerequisites

- Node.js 18+ (for fetch API)
- Strapi backend running
- CSV files in `scripts/liste_affectation/` directory

## 🚀 Quick Start

### 1. Setup Dependencies
```bash
node scripts/setup-import.js
```

### 2. Start Strapi
```bash
npm run develop
```

Wait for Strapi to fully start and register the new content types.

### 3. Run Import
```bash
node scripts/import-to-strapi.js
```

## 📊 What Gets Imported

### Filter Products (55 records)
- **Source**: `recap_data_purflux.csv`
- **Content**: Purflux filter catalog
- **Types**: Oil, Air, Diesel, Cabin filters
- **Fields**: Brand, Reference, EAN, SKU, Category

### Filter Compatibility (8,819 records)
- **Source**: `Applications_borne_20240118_Purflux.csv`
- **Content**: Vehicle-to-filter compatibility
- **Consolidation**: 12,153 → 8,819 records (27.4% reduction)
- **Fields**: Brand, Model, Variant, Engine, Filters (JSON)

### Brands & Models (Auto-created)
- **Brands**: Extracted from compatibility data
- **Models**: Extracted from vehicle data
- **Relations**: Proper foreign key relationships

## 🔧 Configuration

### Environment Variables
```bash
# Optional: Custom Strapi URL
export STRAPI_URL=http://localhost:1337

# Optional: API Token for authentication
export STRAPI_API_TOKEN=your_token_here
```

### Import Scripts
- `scripts/import-to-strapi.js` - Complete import (recommended)
- `scripts/import-filter-products.js` - Products only
- `scripts/import-filter-compatibility.js` - Compatibility only

## 📈 Import Process

### Step 1: Filter Products
1. Parse `recap_data_purflux.csv`
2. Extract filter references and metadata
3. Create 55 FilterProduct records
4. Map categories to filter types

### Step 2: Brands & Models
1. Extract unique brands from compatibility data
2. Create Brand records with slugs
3. Extract unique models per brand
4. Create Model records with brand relations

### Step 3: Filter Compatibility
1. Parse `Applications_borne_20240118_Purflux.csv`
2. Consolidate duplicate vehicle records
3. Extract vehicle variants for dropdown optimization
4. Create 8,819 FilterCompatibility records
5. Link to Brand and Model relations

## 🎯 Data Structure

### FilterProduct
```json
{
  "brand": "PURFLUX",
  "filterType": "oil",
  "reference": "L358AY",
  "fullName": "PURFLUX FILTRE HUILE L358AY -2",
  "ean": "3286064234934",
  "internalSKU": "902000",
  "category": "FILTRE A HUILE"
}
```

### FilterCompatibility
```json
{
  "brand": 1, // Brand ID
  "model": 5, // Model ID
  "vehicleModel": "500 II / 595 / 695 1.4 Turbo 135",
  "vehicleVariant": "595 / 695 1.4 Turbo 135",
  "engineCode": "312A1000",
  "power": "99KW(135PS/HP)",
  "filters": {
    "oil": [{"ref": "37-L330", "notes": []}],
    "air": [],
    "diesel": [],
    "cabin": [{"ref": "233-AH233", "notes": ["Date: -->09/11"]}]
  }
}
```

## 🚀 API Endpoints

After import, these endpoints are available:

### Get Vehicle Variants
```bash
GET /api/filter-compatibility/variants?brand=ABARTH&model=500 II
```

### Search Compatibility
```bash
GET /api/filter-compatibility/search?brand=ABARTH&model=500 II&engine=312A1000
```

### Get Available Products
```bash
GET /api/filter-compatibility/:id/available-products?filterType=oil
```

### Smart Product Matching
```bash
POST /api/filter-compatibility/match-product
{
  "compatibilityRef": "37-L330",
  "filterType": "oil"
}
```

## 🔍 Verification

### Check Import Success
```bash
# Check products
curl "http://localhost:1337/api/filter-products?pagination[limit]=5"

# Check compatibility
curl "http://localhost:1337/api/filter-compatibilities?pagination[limit]=5"

# Check brands
curl "http://localhost:1337/api/brands?pagination[limit]=5"
```

### Test Vehicle Variants
```bash
curl "http://localhost:1337/api/filter-compatibility/variants?brand=ABARTH&model=500 II"
```

## 🐛 Troubleshooting

### Common Issues

1. **Strapi not running**
   ```bash
   npm run develop
   ```

2. **Content types not registered**
   - Restart Strapi
   - Check for TypeScript errors

3. **CSV files missing**
   - Ensure files are in `scripts/liste_affectation/`
   - Check file permissions

4. **Import fails**
   - Check Strapi logs
   - Verify API endpoints are accessible
   - Check network connectivity

### Performance Notes

- **Import time**: ~5-10 minutes for full dataset
- **Memory usage**: ~200MB during import
- **Database size**: ~50MB for complete dataset
- **Query performance**: Optimized with indexes

## 📚 Next Steps

1. **Test API endpoints** with sample queries
2. **Verify data quality** in Strapi admin
3. **Configure tablet sync** for offline usage
4. **Set up monitoring** for import processes

## 🎉 Success!

Your Purflux Filter System is now ready for:
- ✅ Fast vehicle variant lookups
- ✅ Smart filter matching
- ✅ Offline tablet deployment
- ✅ Scalable architecture

Happy filtering! 🚗🔧