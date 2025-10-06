# 🔦 LightsProduct Implementation Guide

## 📋 Overview

This document explains the new LightsProduct implementation that replaces the previous LightPositionData approach. The new structure provides better organization, relationships, and API endpoints for managing light bulb products.

## 🏗️ Entity Structure

### **LightsProduct Entity**
```json
{
  "name": "string (required)",           // Position name (e.g., "Feu de croisement")
  "ref": "string (required)",           // Light reference (e.g., "H11", "H15")
  "description": "text",                 // Optional description
  "lights_model": "relation",            // Many-to-One with LightsModel
  "lights_position": "relation",         // Many-to-One with LightsPosition
  "slug": "uid",                        // Auto-generated from name
  "constructionYearStart": "string",     // Vehicle construction year start
  "constructionYearEnd": "string",       // Vehicle construction year end
  "typeConception": "string",           // Light type (e.g., "Halogen")
  "partNumber": "string",               // Part number
  "notes": "text",                      // Additional notes
  "source": "string",                   // Data source
  "category": "string",                 // Light category
  "isActive": "boolean"                 // Active status
}
```

### **Relationships**
```
LightsBrand (1) ←→ (Many) LightsModel
LightsModel (1) ←→ (Many) LightsProduct
LightsPosition (1) ←→ (Many) LightsProduct
```

## 🚀 Import Process

### **Step 1: Update Schema**
The schema has been updated with the new fields and relationships. Restart Strapi to apply changes:

```bash
# Stop Strapi (Ctrl+C)
npm run develop
```

### **Step 2: Test Import (Recommended)**
Before running the full import, test with a small sample:

```bash
npx strapi console
```

Then run:
```javascript
// Copy and paste the entire content of scripts/test-lights-products-import.js
```

### **Step 3: Full Import**
Once testing is successful, run the full import:

```bash
npx strapi console
```

Then run:
```javascript
// For batched import (recommended for large datasets)
// Copy and paste the entire content of scripts/import-lights-products-batched.js

// OR for regular import
// Copy and paste the entire content of scripts/import-lights-products.js
```

### **Step 4: Verify Import**
Check the import results:

```javascript
// Copy and paste the entire content of scripts/check-lights-products.js
```

## 🔌 API Endpoints

### **Get Brands and Models by Category**
```
GET /api/lights-selection/category/:categoryId
```
Returns all available brands and models from lights products.

### **Get Brands by Category**
```
GET /api/lights-selection/category/:categoryId/brands
```
Returns all unique brands that have lights products.

### **Get Models by Category and Brand**
```
GET /api/lights-selection/category/:categoryId/brand/:brandId/models
```
Returns all models for a specific brand that have lights products.

### **Get Positions by Model**
```
GET /api/lights-selection/model/:modelId/positions
```
Returns all light positions available for a specific model.

### **Get Light Data by Position**
```
GET /api/lights-selection/position/:positionId/data
```
Returns all lights products for a specific position.

## 📊 Data Transformation

### **From osram_bulbs_with_slugs.json**
Each record with multiple light positions becomes multiple LightsProduct entries:

```json
// Input (osram_bulbs_with_slugs.json)
{
  "brandSlug": "abarth",
  "modelSlug": "124-spider",
  "lightType": {
    "position1": {
      "ref": "H11",
      "position": "Feu de croisement",
      "category": "feu_croisement"
    },
    "position2": {
      "ref": "H15", 
      "position": "Feu de route",
      "category": "feu_route"
    }
  }
}

// Output (Multiple LightsProduct entries)
[
  {
    "name": "Feu de croisement",
    "ref": "H11",
    "lights_model": { id: modelId },
    "lights_position": { id: positionId1 },
    "category": "feu_croisement"
  },
  {
    "name": "Feu de route", 
    "ref": "H15",
    "lights_model": { id: modelId },
    "lights_position": { id: positionId2 },
    "category": "feu_route"
  }
]
```

## 🎯 Benefits

### **1. Better Organization**
- Each light position is a separate product
- Clear relationships between models, positions, and products
- Easier to manage and query

### **2. UI-Friendly Structure**
- Positions can be displayed as selectable lists
- Products can be filtered by position, model, or brand
- Supports the BulbsQuestions.tsx component requirements

### **3. Scalable API**
- Efficient queries with proper relationships
- Support for complex filtering
- Easy to extend with additional fields

### **4. Data Integrity**
- Proper foreign key relationships
- Consistent data structure
- Easy to validate and maintain

## 🔧 Scripts Available

1. **`scripts/test-lights-products-import.js`** - Test import with sample data
2. **`scripts/import-lights-products.js`** - Full import (regular)
3. **`scripts/import-lights-products-batched.js`** - Full import (batched for large datasets)
4. **`scripts/check-lights-products.js`** - Verify import results

## 📈 Expected Results

After successful import:
- **LightsProduct entries**: ~1,000,000+ (one per light position per vehicle)
- **LightsPosition entries**: ~50+ (unique light positions)
- **Proper relationships**: All products linked to models and positions
- **API functionality**: All endpoints working with new structure

## 🚨 Important Notes

1. **Backup your database** before running the import
2. **Test with sample data** before full import
3. **Monitor memory usage** during import (use batched version for large datasets)
4. **Verify relationships** after import completion
5. **Update frontend** to use new API structure if needed

## 🔍 Troubleshooting

### **Import Errors**
- Check that LightsBrand and LightsModel entities exist
- Verify the osram_bulbs_with_slugs.json file is accessible
- Check Strapi logs for detailed error messages

### **Relationship Issues**
- Run the check script to identify orphaned products
- Verify that models and positions are properly linked
- Check that the schema relationships are correctly defined

### **API Issues**
- Ensure all endpoints are updated to use LightsProduct
- Check that the populate parameters are correct
- Verify that the data transformation is working properly
