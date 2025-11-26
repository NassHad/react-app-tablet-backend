# 🧽 Wipers Implementation Guide

## 📋 Overview

This document explains the new Wipers implementation that follows the same pattern as the Lights category. The structure provides comprehensive organization, relationships, and API endpoints for managing wiper products and positions.

## 🏗️ Entity Structure

### **WipersProduct Entity**
```json
{
  "name": "string (required)",           // Product name (e.g., "ABARTH 124 Spider - Wipers")
  "ref": "string (required)",           // Wiper reference (e.g., "WIPERS-abarth-124-spider")
  "description": "text",                 // Optional description
  "brand": "relation",                   // Many-to-One with api::brand.brand (EXISTING)
  "model": "relation",                   // Many-to-One with api::model.model (EXISTING)
  "wipersPositions": "json",             // Array of wiper positions
  "slug": "uid",                        // Auto-generated from name
  "constructionYearStart": "string",     // Vehicle construction year start
  "constructionYearEnd": "string",       // Vehicle construction year end
  "direction": "string",                 // LHD/RHD
  "partNumber": "string",               // Part number
  "notes": "text",                      // Additional notes
  "source": "string",                   // Data source
  "category": "string",                 // wipers
  "isActive": "boolean"                 // Active status
}
```

### **WipersPosition Entity**
```json
{
  "name": "string (required)",           // Position name (e.g., "Côté Conducteur")
  "slug": "uid",                        // Auto-generated from name
  "description": "text",                 // Optional description
  "category": "string",                 // multiconnexion/standard/arriere
  "ref": "string",                      // Position reference
  "sortOrder": "integer",               // Display order
  "sort": "integer",                    // Sort field
  "usageCount": "integer",              // Usage count
  "isActive": "boolean"                 // Active status
}
```

### **Relationships**
```
Brand (1) ←→ (Many) WipersProduct
Model (1) ←→ (Many) WipersProduct
WipersPosition (1) ←→ (Many) WipersProduct (via JSON field)
```

## 🚀 Import Process

### **Step 1: Update Schema**
The schemas have been created. Restart Strapi to apply changes:

```bash
# Stop Strapi (Ctrl+C)
npm run develop
```

### **Step 2: Populate Master Positions**
First, populate the master wipers positions:

```bash
npx strapi console
```

Then run:
```javascript
// Copy and paste the entire content of scripts/populate-master-wipers-positions.js
```

### **Step 3: Import Wipers Products**
Import the wipers products from the database:

```bash
npx strapi console
```

Then run:
```javascript
// Copy and paste the entire content of scripts/import-wipers-products.js
```

## 📊 Data Structure

### **Wipers Categories:**
- **multiconnexion**: "Balais plat avant multiconnexion"
- **standard**: "Balais avant standard" 
- **arriere**: "Arriere"

### **Wiper Positions:**
- **Kit Avant**: Front kit
- **Côté Conducteur**: Driver side
- **Mono Balais**: Single wiper
- **Côté Passager**: Passenger side
- **Arrière**: Rear wiper

### **Product References:**
- Format like "VS 32+", "VS 33+", "VS 77", "VS 70", "VS 06"

## 🔌 API Endpoints

### **Wipers Selection API**

#### **Get Brands and Models by Category**
```
GET /api/wipers-selection/brands-and-models/:categoryId
```

#### **Get Brands by Category**
```
GET /api/wipers-selection/brands/:categoryId
```

#### **Get Models by Category and Brand**
```
GET /api/wipers-selection/models/:categoryId/:brandId
```

#### **Get Positions by Model**
```
GET /api/wipers-selection/positions/:modelId
```

#### **Get Wiper Data by Position**
```
GET /api/wipers-selection/wiper-data/:positionId
```

#### **Get All Brands**
```
GET /api/wipers-selection/brands
```

#### **Get Models by Brand ID**
```
GET /api/wipers-selection/models/:brandId
```

#### **Get Models by Brand Slug**
```
GET /api/wipers-selection/models-by-brand-slug/:brandSlug
```

#### **Get Models from Products**
```
GET /api/wipers-selection/models-from-products?brandSlug=abarth
```

#### **Get Positions by Slugs**
```
GET /api/wipers-selection/positions-by-slugs?brandSlug=abarth&modelSlug=124-spider
```

#### **Get All Positions**
```
GET /api/wipers-selection/all-positions
```

#### **Get Products by Slugs**
```
GET /api/wipers-selection/products-by-slugs?brandSlug=abarth&modelSlug=124-spider&positionSlug=cote-conducteur
```

## 🗄️ Database Tables

### **Wipers Products Table**
```sql
CREATE TABLE IF NOT EXISTS wipers_products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  ref TEXT,
  description TEXT,
  brand_id INTEGER,
  model_id INTEGER,
  wipers_positions TEXT,
  construction_year_start TEXT,
  construction_year_end TEXT,
  direction TEXT,
  part_number TEXT,
  notes TEXT,
  source TEXT,
  category TEXT,
  is_active BOOLEAN,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (brand_id) REFERENCES brands(id),
  FOREIGN KEY (model_id) REFERENCES models(id)
);
```

### **Wipers Positions Table**
```sql
CREATE TABLE IF NOT EXISTS wipers_positions (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  category TEXT,
  ref TEXT,
  sort_order INTEGER,
  sort INTEGER,
  usage_count INTEGER,
  is_active BOOLEAN,
  created_at TEXT,
  updated_at TEXT
);
```

## 🔄 Sync Integration

The wipers data is integrated into the sync service and will be included in:
- Offline database generation
- API sync endpoints
- SQLite seed generation

## 📁 File Structure

```
src/api/
├── wipers-product/
│   ├── content-types/wipers-product/schema.json
│   ├── controllers/wipers-product.ts
│   ├── services/wipers-product.ts
│   └── routes/wipers-product.ts
├── wipers-position/
│   ├── content-types/wipers-position/schema.json
│   ├── controllers/wipers-position.ts
│   ├── services/wipers-position.ts
│   └── routes/wipers-position.ts
└── wipers-selection/
    ├── controllers/wipers-selection.ts
    ├── services/wipers-selection.ts
    └── routes/wipers-selection.ts

scripts/
├── import-wipers-products.js
└── populate-master-wipers-positions.js
```

## 🎯 Usage Examples

### **Frontend Integration**
```javascript
// Get all brands for wipers
const brands = await fetch('/api/wipers-selection/brands');

// Get models for a specific brand
const models = await fetch('/api/wipers-selection/models-from-products?brandSlug=abarth');

// Get positions for a specific model
const positions = await fetch('/api/wipers-selection/positions-by-slugs?brandSlug=abarth&modelSlug=124-spider');

// Get wiper data for a specific position
const wiperData = await fetch('/api/wipers-selection/wiper-data/pos-0');
```

## ✅ Features

- ✅ **Complete API Structure**: Full CRUD operations for wipers products and positions
- ✅ **Selection API**: Comprehensive selection endpoints for frontend integration
- ✅ **Data Import**: Automated import from wipers_database.json
- ✅ **Sync Integration**: Included in offline sync and SQLite generation
- ✅ **Relationship Management**: Proper relationships with existing Brand and Model entities
- ✅ **Position Management**: Master positions with categories and sorting
- ✅ **Error Handling**: Comprehensive error handling and logging
- ✅ **Batch Processing**: Efficient batch processing for large datasets

## 🚀 Next Steps

1. **Test the Implementation**: Run the import scripts and test the API endpoints
2. **Frontend Integration**: Integrate the wipers selection API into your frontend
3. **Data Validation**: Validate the imported data and adjust as needed
4. **Performance Optimization**: Monitor performance and optimize if needed
5. **Documentation**: Update frontend documentation with wipers integration

The wipers category is now fully implemented and ready for use! 🎉
