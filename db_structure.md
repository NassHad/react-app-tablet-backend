# Database Structure Documentation

This document provides a comprehensive overview of the SQLite database structure used in the React Tablet Backend project. The database is managed by Strapi CMS and contains automotive parts data for offline tablet applications.

## Overview

The database is designed to support an offline-first tablet application for automotive parts selection. It contains data for batteries, lights, wipers, and other automotive components with their compatibility information.

## Core Tables

### 1. Brands & Models
```sql
-- Brands table
CREATE TABLE brands (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  is_active BOOLEAN,
  created_at TEXT,
  updated_at TEXT
);

-- Models table  
CREATE TABLE models (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  brand_id INTEGER,
  is_active BOOLEAN,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);
```

### 2. Vehicle Management
```sql
-- Vehicle types
CREATE TABLE vehicle_types (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  created_at TEXT,
  updated_at TEXT
);

-- Vehicles
CREATE TABLE vehicles (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  year INTEGER,
  brand_id INTEGER,
  model_id INTEGER,
  vehicle_type_id INTEGER,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (brand_id) REFERENCES brands(id),
  FOREIGN KEY (model_id) REFERENCES models(id),
  FOREIGN KEY (vehicle_type_id) REFERENCES vehicle_types(id)
);

-- Motorisations
CREATE TABLE motorisations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  created_at TEXT,
  updated_at TEXT
);
```

### 3. Product Categories
```sql
-- Categories
CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  icon TEXT,
  is_active BOOLEAN,
  created_at TEXT,
  updated_at TEXT
);

-- Products (generic)
CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  category_id INTEGER,
  is_active BOOLEAN,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);
```

## Automotive Parts Tables

### 4. Battery System
```sql
-- Battery brands
CREATE TABLE battery_brands (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  logo_url TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- Battery models
CREATE TABLE battery_models (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  battery_brand_id INTEGER,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (battery_brand_id) REFERENCES battery_brands(id)
);

-- Battery products
CREATE TABLE battery_products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  brand TEXT NOT NULL,
  brand_slug TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_slug TEXT NOT NULL,
  motorisations TEXT, -- JSON array
  battery_brand TEXT DEFAULT 'Fulmen Endurance',
  category TEXT DEFAULT 'battery',
  is_active BOOLEAN DEFAULT true,
  created_at TEXT,
  updated_at TEXT
);

-- Battery data (compatibility)
CREATE TABLE battery_data (
  id INTEGER PRIMARY KEY,
  vehicle_id INTEGER,
  battery_product_id INTEGER,
  compatibility_notes TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY (battery_product_id) REFERENCES battery_products(id)
);
```

### 5. Lights System
```sql
-- Lights products
CREATE TABLE lights_products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  ref TEXT NOT NULL,
  description TEXT,
  brand_id INTEGER,
  model_id INTEGER,
  light_positions TEXT, -- JSON array
  construction_year_start TEXT,
  construction_year_end TEXT,
  type_conception TEXT,
  part_number TEXT,
  notes TEXT,
  source TEXT,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (brand_id) REFERENCES brands(id),
  FOREIGN KEY (model_id) REFERENCES models(id)
);

-- Lights positions
CREATE TABLE lights_positions (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  created_at TEXT,
  updated_at TEXT
);

-- Lights position data (compatibility)
CREATE TABLE lights_position_data (
  id INTEGER PRIMARY KEY,
  vehicle_id INTEGER,
  lights_position_id INTEGER,
  lights_product_id INTEGER,
  compatibility_notes TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY (lights_position_id) REFERENCES lights_positions(id),
  FOREIGN KEY (lights_product_id) REFERENCES lights_products(id)
);

-- Light data (compatibility)
CREATE TABLE light_data (
  id INTEGER PRIMARY KEY,
  vehicle_id INTEGER,
  lights_product_id INTEGER,
  compatibility_notes TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY (lights_product_id) REFERENCES lights_products(id)
);
```

### 6. Wipers System
```sql
-- Wipers products
CREATE TABLE wipers_products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  ref TEXT NOT NULL,
  description TEXT,
  brand_id INTEGER,
  model_id INTEGER,
  wipers_positions TEXT, -- JSON array with position data
  construction_year_start TEXT,
  construction_year_end TEXT,
  direction TEXT,
  part_number TEXT,
  notes TEXT,
  source TEXT,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (brand_id) REFERENCES brands(id),
  FOREIGN KEY (model_id) REFERENCES models(id)
);

-- Wipers positions
CREATE TABLE wipers_positions (
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

## Compatibility & Relations

### 7. Compatibility System
```sql
-- General compatibilities
CREATE TABLE compatibilities (
  id INTEGER PRIMARY KEY,
  vehicle_id INTEGER,
  product_id INTEGER,
  compatibility_notes TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Specific questions
CREATE TABLE specific_questions (
  id INTEGER PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT,
  vehicle_id INTEGER,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);
```

## System Tables

### 8. Sync & Versioning
```sql
-- Database version tracking
CREATE TABLE db_versions (
  id INTEGER PRIMARY KEY,
  version TEXT UNIQUE,
  created_at TEXT
);

-- Sync data
CREATE TABLE sync (
  id INTEGER PRIMARY KEY,
  last_sync TEXT,
  sync_status TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

### 9. Tablet Management
```sql
-- Tablets
CREATE TABLE tablets (
  id INTEGER PRIMARY KEY,
  created_at TEXT,
  updated_at TEXT
);
```

## Key Relationships

### Entity Relationships
- **Brands** → **Models** (One-to-Many)
- **Brands** → **Vehicles** (One-to-Many)
- **Models** → **Vehicles** (One-to-Many)
- **Vehicle Types** → **Vehicles** (One-to-Many)
- **Vehicles** → **Battery Data** (One-to-Many)
- **Vehicles** → **Lights Data** (One-to-Many)
- **Vehicles** → **Wipers Products** (Many-to-Many via compatibility)

### JSON Fields
Several tables use JSON fields to store complex data:

- **`wipers_positions`** (wipers_products): Array of position objects with ref, description, category
- **`light_positions`** (lights_products): Array of light position data
- **`motorisations`** (battery_products): Array of motorization types

## Data Flow

### Offline-First Architecture
1. **Strapi CMS** serves as the master data source
2. **Sync Service** exports data to SQLite format
3. **Tablet App** uses SQLite for offline operations
4. **Periodic Sync** updates local database from CMS

### Key Features
- **Offline Capability**: All data available without internet
- **Multi-language Support**: Position terms in multiple languages
- **Compatibility Tracking**: Complex vehicle-part compatibility rules
- **Version Control**: Database versioning for sync management

## Usage Patterns

### Common Queries
```sql
-- Get wiper products for a specific vehicle
SELECT wp.* FROM wipers_products wp 
JOIN models m ON wp.model_id = m.id 
WHERE m.slug = 'alfa-romeo-155';

-- Get battery compatibility for vehicle
SELECT bp.* FROM battery_products bp
JOIN battery_data bd ON bp.id = bd.battery_product_id
WHERE bd.vehicle_id = ?;

-- Get lights by position
SELECT lp.* FROM lights_products lp
WHERE JSON_EXTRACT(lp.light_positions, '$[*].position') LIKE '%headlight%';
```

## Notes

- All timestamps are stored as TEXT in ISO format
- JSON fields use SQLite's JSON functions for querying
- Foreign key constraints ensure data integrity
- The database supports both French and English position terms
- Sync mechanism handles incremental updates efficiently

## Filter System (Purflux)

### 10. Filter Products
```sql
-- Filter products catalog
CREATE TABLE filter_products (
  id INTEGER PRIMARY KEY,
  brand TEXT NOT NULL DEFAULT 'PURFLUX',
  filter_type TEXT NOT NULL CHECK (filter_type IN ('oil', 'air', 'diesel', 'cabin')),
  reference TEXT NOT NULL,
  full_reference TEXT,
  full_name TEXT NOT NULL,
  ean TEXT UNIQUE NOT NULL,
  internal_sku TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  slug TEXT UNIQUE NOT NULL,
  created_at TEXT,
  updated_at TEXT
);
```

### 11. Filter Compatibility (Consolidated)
```sql
-- Vehicle to filter compatibility (consolidated from 12K+ to ~9K records)
CREATE TABLE filter_compatibilities (
  id INTEGER PRIMARY KEY,
  brand_id INTEGER,
  model_id INTEGER,
  vehicle_model TEXT NOT NULL,
  vehicle_variant TEXT, -- Optimized for dropdown filtering (e.g., "1.4 Turbo 135")
  engine_code TEXT NOT NULL,
  power TEXT,
  production_start TEXT,
  production_end TEXT,
  filters TEXT, -- JSON with oil, air, diesel, cabin arrays
  metadata TEXT, -- JSON with chassis notes, comments
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (brand_id) REFERENCES brands(id),
  FOREIGN KEY (model_id) REFERENCES models(id)
);

-- Indexes for fast querying
CREATE INDEX idx_filter_compat_brand_model ON filter_compatibilities(brand_id, model_id);
CREATE INDEX idx_filter_compat_variant ON filter_compatibilities(vehicle_variant);
```

### Filter System Benefits
- **73% database size reduction** (12K → 2K records)
- **Fast queries** with indexed brand/model/engine fields
- **Flexible structure** for variable filter configurations
- **Smart matching** handles reference variations (L330 matches L330AY)
- **Offline-optimized** for tablet SQLite sync

### Filter System Usage Examples
```sql
-- Fast query: Get all variants for ABARTH 500 II (using indexes!)
SELECT vehicle_variant, engine_code, power
FROM filter_compatibilities fc
JOIN brands b ON fc.brand_id = b.id
JOIN models m ON fc.model_id = m.id
WHERE b.name = 'ABARTH' 
  AND m.name = '500 II'
ORDER BY vehicle_variant;

-- Get filters for specific variant
SELECT JSON_EXTRACT(filters, '$.oil') as oil_filters,
       JSON_EXTRACT(filters, '$.air') as air_filters,
       JSON_EXTRACT(filters, '$.diesel') as diesel_filters,
       JSON_EXTRACT(filters, '$.cabin') as cabin_filters
FROM filter_compatibilities fc
JOIN brands b ON fc.brand_id = b.id
JOIN models m ON fc.model_id = m.id
WHERE b.name = 'ABARTH' 
  AND m.name = '500 II'
  AND vehicle_variant LIKE '%1.4 Turbo 135%';

-- Find oil filters for ABARTH 500 II
SELECT fp.* FROM filter_products fp
JOIN filter_compatibilities fc ON JSON_EXTRACT(fc.filters, '$.oil[*].ref') LIKE '%L330%'
WHERE fc.vehicle_model LIKE '%500 II%' 
  AND fp.filter_type = 'oil'
  AND fp.is_active = true;

-- Find vehicles using a specific filter reference
SELECT fc.vehicle_model, fc.vehicle_variant, fc.engine_code
FROM filter_compatibilities fc
WHERE JSON_EXTRACT(fc.filters, '$.oil[*].ref') LIKE '%L330%';
```

This structure supports a comprehensive automotive parts selection system with offline capabilities for tablet applications.
